using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.IO;
using Newtonsoft.Json;
using Serilog;

namespace XiePinyin.Logic
{
    public class DocumentJuggler
    {
        public class Options
        {
            public string DocsFolder;
            public string ExportsFolder;
            public int UnloadDocAfterSeconds = 7800; // 2:10h; MUST BE GREATER THAN SessionIdleEndSeconds
            public int SessionRequestExpirySeconds = 10;
            public int SessionIdleEndSeconds = 7200; // 2h
        }

        class Session
        {
            // Session's short random key
            public readonly string SessionKey;
            // ID of document the session is editing
            public readonly string DocId;
            // Last communication from the session (either change or ping)
            public DateTime LastActiveUtc = DateTime.UtcNow;
            // Time the session was requested. Equals DateTime.MinValue once session has started.
            public DateTime RequestedUtc = DateTime.UtcNow;
            // This editor's selection, as it applies to the current head text.
            public Selection Selection = null;
            // Ctor: init values.
            public Session(string sessionKey, string docId)
            {
                SessionKey = sessionKey;
                DocId = docId;
            }
        }

        class SessionSelection
        {
            [JsonProperty("sessionKey")]
            public string SessionKey;
            [JsonProperty("start")]
            public int Start;
            [JsonProperty("end")]
            public int End;
            [JsonProperty("caretAtStart")]
            public bool CaretAtStart;
        }

        class SessionStartMessage
        {
            [JsonProperty("name")]
            public string Name;
            [JsonProperty("revisionId")]
            public int RevisionId;
            [JsonProperty("text")]
            public XieChar[] Text;
            [JsonProperty("peerSelections")]
            public List<SessionSelection> PeerSelections;
        }

        const int saveFunCycleMsec = 200;
        const int saveFunLoopSec = 2;

        readonly object lockObject = new object();
        readonly List<Session> sessions = new List<Session>();
        readonly List<Document> docs = new List<Document>();

        readonly Thread housekeepingThread;
        readonly Options options;
        readonly ILogger logger;
        bool shuttingDown = false;

        internal IBroadcaster Broadcaster;

        public DocumentJuggler(Options options, ILogger logger)
        {
            this.options = options;
            this.logger = logger.ForContext("XieSource", "DocJuggler");
            housekeepingThread = new Thread(housekeep);
            housekeepingThread.Start();
        }

        public void Shutdown()
        {
            shuttingDown = true;
        }

        void housekeep()
        {
            DateTime lastRun = DateTime.UtcNow;
            while (!shuttingDown)
            {
                Thread.Sleep(saveFunCycleMsec);
                var sinceLast = DateTime.UtcNow.Subtract(lastRun);
                if (sinceLast.TotalSeconds < saveFunLoopSec) continue;
                lastRun = DateTime.UtcNow;
                housekeepDocuments();
                housekeepSessions();
            }
        }

        void housekeepDocuments()
        {
            // Save all dirty documents
            // Unload stale documents
            // But release lock after each action, so other requests can edge in sideways
            bool keepWorking = true;
            while (keepWorking)
            {
                keepWorking = false;
                lock (lockObject)
                {
                    Document docToUnload = null;
                    foreach (var doc in docs)
                    {
                        // If we come across a dirty document, save it
                        if (doc.Dirty)
                        {
                            doc.SaveToFile(getDocFileName(doc.DocId));
                            keepWorking = true;
                            break;
                        }
                        // If we come across a stale document, unload it.
                        else if (DateTime.UtcNow.Subtract(doc.LastAccessedUtc).TotalSeconds > options.UnloadDocAfterSeconds)
                        {
                            docToUnload = doc;
                            keepWorking = true;
                            break;
                        }
                    }
                    if (docToUnload != null) docs.Remove(docToUnload);
                }
            }
        }

        void housekeepSessions()
        {
            lock (lockObject)
            {
                List<Session> sessToDel = new List<Session>();
                foreach (var sess in sessions)
                {
                    // Requested too long ago, and not claimed yet
                    if (sess.RequestedUtc != DateTime.MinValue &&
                        DateTime.UtcNow.Subtract(sess.RequestedUtc).TotalSeconds > options.SessionRequestExpirySeconds)
                        sessToDel.Add(sess);
                    // Inactive for too long
                    else if (DateTime.UtcNow.Subtract(sess.LastActiveUtc).TotalSeconds > options.SessionIdleEndSeconds)
                        sessToDel.Add(sess);
                }
                List<string> sessionKeysToTerminate = new List<string>();
                foreach (var sess in sessToDel)
                {
                    sessions.Remove(sess);
                    if (sess.RequestedUtc == DateTime.MinValue) sessionKeysToTerminate.Add(sess.SessionKey);
                }
                Broadcaster.TerminateSessions(sessionKeysToTerminate);
            }
        }

        string getDocFileName(string docId)
        {
            return Path.Combine(options.DocsFolder, docId + ".json");
        }

        public string CreateDocument(string name)
        {
            string docId;
            lock(lockObject)
            {
                while (true)
                {
                    docId = ShortIdGenerator.Next();
                    if (docs.Exists(x => x.DocId == docId)) continue;
                    if (File.Exists(getDocFileName(docId))) continue;
                    break;
                }
                var newDoc = new Document(docId, name);
                docs.Add(newDoc);
                newDoc.SaveToFile(getDocFileName(docId));

            }
            return docId;
        }

        public void DeleteDocument(string docId)
        {
            lock (lockObject)
            {
                var doc = docs.Find(x => x.DocId == docId);
                if (doc != null)
                {
                    docs.Remove(doc);
                    var sessionsToDel = new List<Session>();
                    foreach (var x in sessions) if (x.DocId == docId) sessionsToDel.Add(x);
                    foreach (var x in sessionsToDel) sessions.Remove(x);
                }
                string fn = getDocFileName(docId);
                if (File.Exists(fn)) File.Delete(fn);
            }
        }

        /// <summary>
        /// <para>Loads a doc from disk if it exists but no currently in memory.</para>
        /// <para>Must be called from within lock!</para>
        /// </summary>
        void ensureDocLoaded(string docId)
        {
            if (docs.Exists(x => x.DocId == docId)) return;
            string fn = getDocFileName(docId);
            if (File.Exists(fn))
            {
                var doc = Document.LoadFromFile(fn);
                docs.Add(doc);
            }
        }

        public async Task<string> ExportDocx(string docId)
        {
            XieChar[] text = null;
            lock (lockObject)
            {
                ensureDocLoaded(docId);
                var doc = docs.Find(x => x.DocId == docId);
                if (doc == null) return null;
                text = new XieChar[doc.HeadText.Length];
                for (int i = 0; i < text.Length; ++i) text[i] = doc.HeadText[i];
            }
            var exportFileName = docId + "-" + ShortIdGenerator.Next() + ".docx";
            var exportFilePath = Path.Combine(options.ExportsFolder, exportFileName);
            var exporter = new DocxExporter(text, exportFilePath);
            await exporter.Export();
            return exportFileName;
        }

        public string RequestSession(string docId)
        {
            string sessionKey = null;
            lock(lockObject)
            {
                ensureDocLoaded(docId);
                if (!docs.Exists(x => x.DocId == docId)) return null;
                while (true)
                {
                    sessionKey = ShortIdGenerator.Next();
                    if (!sessions.Exists(x => x.SessionKey == sessionKey)) break;
                }
                sessions.Add(new Session(sessionKey, docId));
            }
            return sessionKey;
        }

        public string StartSession(string sessionKey)
        {
            SessionStartMessage ssm = null;
            lock (lockObject)
            {
                var sess = sessions.Find(x => x.SessionKey == sessionKey);
                if (sess == null || sess.RequestedUtc == DateTime.MinValue) return null;
                ensureDocLoaded(sess.DocId);
                var doc = docs.Find(x => x.DocId == sess.DocId);
                if (doc == null) return null;
                ssm = new SessionStartMessage
                {
                    Name = doc.Name,
                    RevisionId = doc.Revisions.Count - 1,
                    Text = doc.HeadText,
                    PeerSelections = getDocSels(doc.DocId),
                };
                sess.RequestedUtc = DateTime.MinValue;
                sess.Selection = new Selection { Start = 0, End = 0 };
            }
            return JsonConvert.SerializeObject(ssm);
        }

        public bool IsSessionOpen(string sessionKey)
        {
            Session sess = null;
            lock(lockObject)
            {
                sess = sessions.Find(x => x.SessionKey == sessionKey);
            }
            return sess != null && sess.RequestedUtc == DateTime.MinValue;
        }

        public void SessionClosed(string sessionKey)
        {
            lock (lockObject)
            {
                var sess = sessions.Find(x => x.SessionKey == sessionKey);
                if (sess != null) sessions.Remove(sess);
            }
        }

        List<SessionSelection> getDocSels(string docId)
        {
            var ssels = new List<SessionSelection>();
            foreach (var sess in sessions)
            {
                if (sess.DocId != docId || sess.Selection == null) continue;
                ssels.Add(new SessionSelection
                {
                    SessionKey = sess.SessionKey,
                    Start = sess.Selection.Start,
                    End = sess.Selection.End,
                    CaretAtStart = sess.Selection.CaretAtStart,
                });
            }
            return ssels;
        }

        public bool ChangeReceived(string sessionKey, int clientRevisionId, string selStr, string changeStr)
        {
            try
            {
                lock (lockObject)
                {
                    var sess = sessions.Find(x => x.SessionKey == sessionKey);
                    if (sess == null) return false;
                    sess.LastActiveUtc = DateTime.UtcNow;
                    ensureDocLoaded(sess.DocId);
                    var doc = docs.Find(x => x.DocId == sess.DocId);
                    if (doc == null) return false;
                    var sel = JsonConvert.DeserializeObject<Selection>(selStr);
                    ChangeSet cs = changeStr != null ? ChangeSet.FromJson(changeStr) : null;
                    logger.Verbose("Change received from session {sessionKey}: client rev {clientRevisionId}, sel: {sel} , change: \n{change}",
                        sessionKey, clientRevisionId, selStr, changeStr);

                    // Who are we broadcasting to?
                    List<string> receivers = new List<string>();
                    foreach (var x in sessions)
                        if (x.RequestedUtc == DateTime.MinValue && x.DocId == doc.DocId)
                            receivers.Add(x.SessionKey);

                    // What are we broadcasting?
                    ChangeToBroadcast ctb = new ChangeToBroadcast
                    {
                        SourceSessionKey = sessionKey,
                        SourceBaseDocRevisionId = clientRevisionId,
                        NewDocRevisionId = doc.Revisions.Count - 1,
                        ReceiverSessionKeys = receivers,
                    };
                    // This is only about a changed selection
                    if (cs == null)
                    {
                        sess.Selection = doc.ForwardSelection(sel, clientRevisionId);
                        ctb.SelJson = JsonConvert.SerializeObject(getDocSels(sess.DocId));
                        logger.Verbose("Propagating selection update: {sels}", ctb.SelJson);
                    }
                    // We got us a real change set
                    else
                    {
                        if (!cs.IsValid())
                        {
                            logger.Warning("Change is invalid. Ending this session.");
                            return false;
                        }
                        ChangeSet csToProp;
                        doc.ApplyChange(cs, sel, clientRevisionId, out csToProp, out sess.Selection);
                        ctb.NewDocRevisionId = doc.Revisions.Count - 1;
                        ctb.SelJson = JsonConvert.SerializeObject(getDocSels(sess.DocId));
                        ctb.ChangeJson = csToProp.SerializeJson();
                        logger.Verbose("Propagating changeset and selection update:\n{change}\n{sels}", ctb.ChangeJson, ctb.SelJson);
                    }
                    // Showtime!
                    Broadcaster.EnqueueChangeForBroadcast(ctb);
                }
                return true;
            }
            catch (Exception ex)
            {
                logger.Error(ex, "Error in ChangeReceived");
                throw;
            }
        }
    }
}
