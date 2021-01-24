﻿using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    internal class ConnectionManager
    {
        class ManagedConnection
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
                wsc.MessageReceived += async (sender, msg) => {
                    try { await messageFrom(wsc, msg); }
                    catch { await wsc.CloseIfNotClosedAsync("We messed up"); }
                };
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
                await wsc.CloseIfNotClosedAsync("Where did this websocket connection come from?");
                return;
            }
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
                    await wsc.CloseIfNotClosedAsync("This session has expired; you need to type sometimes, you know");
                return;
            }
            // Client announced a change
            if (msg.StartsWith("CHANGE "))
            {
                int ix = msg.IndexOf(' ', 7);
                int revId = int.Parse(msg.Substring(7, ix - 7));
                if (!docJuggler.ChangeReceived(mc.SessionKey, revId, msg.Substring(ix + 1)))
                    await wsc.CloseIfNotClosedAsync("We don't like this change; your session might have expired, or the doc may be gone");
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
            string updMsg = "UPDATE " + ctb.NewDocRevisionId + " " + ctb.ChangeJson;
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
                // Acknowledge change to sender
                if (senderConn != null)
                    tasks.Add(senderConn.WSC.SendAsync(ackMsg, CancellationToken.None));
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
                        tasks.Add(x.WSC.CloseIfNotClosedAsync("Haven't heard from your in a long time"));
                }
            }
            return Task.WhenAll(tasks);
        }
    }
}
