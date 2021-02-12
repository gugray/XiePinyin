using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using Serilog;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    internal class ConnectionManager
    {
        public class Options
        {
            /// <summary>
            /// We terminate sockets that haven't pinged us or sent other messages for this long.
            /// </summary>
            public int SocketInactivitySeconds = 120;
        }

        class ManagedConnection
        {
            public WebSocketConnection WSC;
            public DateTime LastActiveUtc = DateTime.UtcNow;
            public string SessionKey = null;
        }

        readonly ILogger logger;
        readonly Options options;
        readonly List<ManagedConnection> conns = new List<ManagedConnection>();
        readonly DocumentJuggler docJuggler;

        public ConnectionManager(DocumentJuggler docJuggler, ILogger logger, Options options = null)
        {
            this.logger = logger;
            this.options = options ?? new Options();
            this.docJuggler = docJuggler;
        }

        public void AddConnection(WebSocketConnection wsc)
        {
            lock (conns)
            {
                conns.Add(new ManagedConnection { WSC = wsc });
                wsc.MessageReceived += async (sender, msg) => {
                    try { await messageFrom(wsc, msg); }
                    catch { await wsc.CloseIfNotClosedAsync("We messed up"); } // TO-DO: Log error
                };
            }
        }

        private async Task messageFrom(WebSocketConnection wsc, string msg)
        {
            ManagedConnection mc = null;
            lock (conns)
            {
                mc = conns.Find(x => x.WSC.Id == wsc.Id);
            }
            if (mc == null)
            {
                await wsc.CloseIfNotClosedAsync("Where did this websocket connection come from?");
                return;
            }
            mc.LastActiveUtc = DateTime.UtcNow;
            // Diagnostic: see what happens when message handling code throws
            if (msg == "BOO") throw new Exception("up");
            // Client announcing their session key as the first message
            if (msg.StartsWith("SESSIONKEY "))
            {
                if (mc.SessionKey != null)
                {
                    await wsc.CloseIfNotClosedAsync("Client already sent their session key");
                    return;
                }
                var sessionKey = msg.Substring(11);
                var startStr = docJuggler.StartSession(sessionKey);
                if (startStr == null)
                {
                    await wsc.CloseIfNotClosedAsync("We're not expecting a session with this key");
                    return;
                }
                mc.SessionKey = sessionKey;
                await wsc.SendAsync("HELLO " + startStr, CancellationToken.None);
                return;
            }
            // Anything else: client must be past sessionkey check
            if (mc.SessionKey == null)
            {
                await wsc.CloseIfNotClosedAsync("Don't talk until you've announced your session key");
                return;
            }
            // Just a keepalive ping: see if session is still open?
            if (msg == "PING")
            {
                if (!docJuggler.IsSessionOpen(mc.SessionKey))
                    await wsc.CloseIfNotClosedAsync("This is not an open session");
                return;
            }
            // Client announced a change
            if (msg.StartsWith("CHANGE "))
            {
                int ix1 = msg.IndexOf(' ', 7);
                int ix2 = msg.IndexOf(' ', ix1 + 1);
                if (ix2 == -1) ix2 = msg.Length;
                int revId = int.Parse(msg.Substring(7, ix1 - 7));
                string selStr = msg.Substring(ix1 + 1, ix2 - ix1 - 1);
                string changeStr = null;
                if (ix2 != msg.Length) changeStr = msg.Substring(ix2 + 1);
                if (!docJuggler.ChangeReceived(mc.SessionKey, revId, selStr, changeStr))
                    await wsc.CloseIfNotClosedAsync("We don't like this change; your session might have expired, the doc may be gone, or the change may be invalid.");
                return;
            }
            // Anything else: No.
            await wsc.CloseIfNotClosedAsync("You shouldn't have said that");
        }

        public void RemoveConnection(Guid connId)
        {
            ManagedConnection mc = null;
            lock (conns)
            {
                mc = conns.Find(x => x.WSC.Id == connId);
                if (mc != null) conns.Remove(mc);
            }
            if (mc != null && mc.SessionKey != null) docJuggler.SessionClosed(mc.SessionKey);
        }

        public Task TerminateConnections(List<string> sessionKeys)
        {
            List<Task> tasks = new List<Task>();
            lock (conns)
            {
                foreach (var x in conns)
                    if (sessionKeys.Contains(x.SessionKey))
                        tasks.Add(x.WSC.CloseIfNotClosedAsync("Terminating because session has been idle for too long"));
            }
            return Task.WhenAll(tasks);
        }

        public Task BeepToAllAsync()
        {
            List<Task> tasks = new List<Task>();
            lock (conns)
            {
                foreach (var x in conns)
                    tasks.Add(x.WSC.SendAsync("BEEP", CancellationToken.None));
            }
            return Task.WhenAll(tasks);
        }
        
        public Task BroadcastChange(ChangeToBroadcast ctb)
        {
            List<Task> tasks = new List<Task>();
            string updMsg = "UPDATE " + ctb.NewDocRevisionId + " " + ctb.SourceSessionKey + " " + ctb.SelJson;
            if (ctb.ChangeJson != null) updMsg += " " + ctb.ChangeJson;
            string ackMsg = "ACKCHANGE " + ctb.SourceBaseDocRevisionId + " " + ctb.NewDocRevisionId;
            lock (conns)
            {
                // Propagate to all provided session keys, except sender herself
                ManagedConnection senderConn = null;
                foreach (var x in conns)
                {
                    if (x.SessionKey == ctb.SourceSessionKey)
                        senderConn = x;
                    if (!ctb.ReceiverSessionKeys.Contains(x.SessionKey) || x.SessionKey == ctb.SourceSessionKey)
                        continue;
                    tasks.Add(x.WSC.SendAsync(updMsg, CancellationToken.None));
                }
                // Acknowledge change to sender: but only for actual content changes!
                // We're not acknowledging selection changes, as those don't change revision ID
                if (senderConn != null && ctb.ChangeJson != null)
                    tasks.Add(senderConn.WSC.SendAsync(ackMsg, CancellationToken.None));
            }
            return Task.WhenAll(tasks);
        }

        /// <summary>
        /// Terminates sockets that haven't sent any message to us for too long.
        /// </summary>
        /// <returns></returns>
        public Task CloseNonPingingConnections()
        {
            List<Task> tasks = new List<Task>();
            DateTime utcNow = DateTime.UtcNow;
            lock (conns)
            {
                foreach (var x in conns)
                {
                    if (utcNow.Subtract(x.LastActiveUtc).TotalSeconds > options.SocketInactivitySeconds)
                        tasks.Add(x.WSC.CloseIfNotClosedAsync("Haven't heard from your in a long time"));
                }
            }
            return Task.WhenAll(tasks);
        }
    }
}
