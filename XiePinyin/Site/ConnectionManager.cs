using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Collections.Concurrent;

namespace XiePinyin.Site
{
    internal class ConnectionManager : IChangeBroadcaster
    {
        private class ManagedConnection
        {
            public WebSocketConnection WSC;
            public DateTime LastActiveUtc = DateTime.UtcNow;
            public string SessionKey = null;
        }

        readonly List<ManagedConnection> conns = new List<ManagedConnection>();
        readonly DocumentJuggler docJuggler;

        public ConnectionManager(DocumentJuggler docJuggler)
        {
            this.docJuggler = docJuggler;
        }

        public void AddConnection(WebSocketConnection wsc)
        {
            lock (conns)
            {
                conns.Add(new ManagedConnection { WSC = wsc });
                wsc.MessageReceived += async (sender, msg) => await messageFrom(wsc, msg);
            }
        }

        private async Task messageFrom(WebSocketConnection wsc, string msg)
        {
            ManagedConnection mc = null;
            lock (conns)
            {
                mc = conns.Find(x => x.WSC.Id == wsc.Id);
                mc.LastActiveUtc = DateTime.UtcNow;
            }
            if (mc == null)
            {
                await wsc.CloseAsync("Where did this websocket connection come from?");
                return;
            }
            // Client announcing their session key as the first message
            if (msg.StartsWith("SESSIONKEY "))
            {
                if (mc.SessionKey != null)
                {
                    await wsc.CloseAsync("Client already sent their session key");
                    return;
                }
                var sessionKey = msg.Substring(11);
                var headStr = docJuggler.OpenSession(sessionKey);
                if (headStr == null)
                {
                    await wsc.CloseAsync("We're not expecting a session with this key");
                    return;
                }
                mc.SessionKey = sessionKey;
                await wsc.SendAsync("HEAD " + headStr, CancellationToken.None);
                return;
            }
            // Anything else: client must be past sessionkey check
            if (mc.SessionKey == null)
            {
                await wsc.CloseAsync("Don't talk until you've announced your session key");
                return;
            }
            // Just a keepalive ping
            if (msg == "PING") return;
            // Client announced a change
            if (msg.StartsWith("CHANGE "))
            {
                docJuggler.ChangeReceived(mc.SessionKey, msg.Substring(7));
                return;
            }
            // Anything else: No.
            await wsc.CloseAsync("You shouldn't have said that");
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

        public Task BeepToAllAsync(CancellationToken cancellationToken)
        {
            List<Task> tasks = new List<Task>();
            lock (conns)
            {
                foreach (var x in conns)
                    tasks.Add(x.WSC.SendAsync("BEEP", cancellationToken));
            }
            return Task.WhenAll(tasks);
        }

        public Task CloseStaleConnections()
        {
            List<Task> tasks = new List<Task>();
            DateTime utcNow = DateTime.UtcNow;
            lock (conns)
            {
                foreach (var x in conns)
                {
                    if (utcNow.Subtract(x.LastActiveUtc) > TimeSpan.FromMinutes(10))
                        tasks.Add(x.WSC.CloseAsync("Haven't heard from your in a long time"));
                }
            }
            return Task.WhenAll(tasks);
        }

        public async void SendToKeysAsync(List<string> sessionKeys, string change)
        {
            throw new NotImplementedException();
        }
    }
}
