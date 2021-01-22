using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    class DocumentJuggler
    {
        class Session
        {
            public readonly string SessionKey;
            public readonly string DocId;
            public DateTime LastActiveUtc = DateTime.UtcNow;
            public bool Started = false;
            public Session(string sessionKey, string docId)
            {
                SessionKey = sessionKey;
                DocId = docId;
            }
        }

        class SessionStartMessage
        {
            [JsonProperty("name")]
            public string Name;
            [JsonProperty("revisionId")]
            public int RevisionId;
            [JsonProperty("text")]
            public XieChar[] Text;
        }

        readonly object lockObject = new object();
        readonly List<Session> sessions = new List<Session>();
        readonly List<Document> docs = new List<Document>();

        public IChangeBroadcaster Broadcaster;

        public DocumentJuggler()
        {
        }

        public string CreateDocument(string name)
        {
            string docId;
            lock(lockObject)
            {
                while (true)
                {
                    docId = ShortIdGenerator.Next();
                    if (!docs.Exists(x => x.DocId == docId)) break;
                }
                docs.Add(new Document(docId, name));
            }
            return docId;
        }

        public string RequestSession(string docId)
        {
            string sessionKey = null;
            lock(lockObject)
            {
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
                if (sess == null || sess.Started) return null;
                var doc = docs.Find(x => x.DocId == sess.DocId);
                if (doc == null) return null;
                ssm = new SessionStartMessage
                {
                    Name = doc.Name,
                    RevisionId = doc.Revisions.Count - 1,
                    Text = doc.HeadText,
                };
                sess.Started = true;
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
            return sess != null && sess.Started;
        }

        public void SessionClosed(string sessionKey)
        {
            lock (lockObject)
            {
                var sess = sessions.Find(x => x.SessionKey == sessionKey);
                if (sess != null) sessions.Remove(sess);
            }
        }

        public bool ChangeReceived(string sessionKey, int clientRevisionId, string change)
        {
            lock (lockObject)
            {
                var sess = sessions.Find(x => x.SessionKey == sessionKey);
                if (sess == null) return false;
                var doc = docs.Find(x => x.DocId == sess.DocId);
                if (doc == null) return false;
                string changeToPropagateStr;
                ChangeSet cs = ChangeSet.FromJson(change);
                var csToProp = doc.ApplyChange(cs, clientRevisionId);
                changeToPropagateStr = csToProp.SerializeJson();
                List<string> receivers = new List<string>();
                foreach (var x in sessions)
                    if (x.Started && x.DocId == doc.DocId)
                        receivers.Add(x.SessionKey);
                Broadcaster.SendToKeysAsync(sessionKey, clientRevisionId, receivers, changeToPropagateStr);
            }
            return true;
        }
    }
}
