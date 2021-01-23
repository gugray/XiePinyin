using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace XiePinyin.Site
{
    internal class Broadcaster : IChangeBroadcaster
    {
        readonly ConnectionManager connMgr;
        readonly Thread thread;
        readonly AutoResetEvent loopEvent = new AutoResetEvent(false);
        bool shuttingDown = false;

        public Broadcaster(ConnectionManager connectionManager)
        {
            connMgr = connectionManager;
            thread = new Thread(threadFun);
            thread.Start();
        }

        public void Shutdown()
        {
            shuttingDown = true;
            loopEvent.Set();
        }

        public void SendToKeysAsync(string sourceSessionKey, int clientRevisionId, List<string> sessionKeys, string change)
        {
            // TO-DO: Implement this
            // Also, this must not be a plain send:
            // - internal queue needed
            // - this function only enqueues message.
            return;
        }

        private void threadFun()
        {
            DateTime lastBeep = DateTime.UtcNow;
            while (true)
            {
                // Waking up to an event
                if (loopEvent.WaitOne(1000))
                {
                    // Let's see whats up?
                    if (shuttingDown) break;
                    // TO-DO: broadcast from queue
                    continue;
                }
                int msecSinceLastBeep = (int)DateTime.UtcNow.Subtract(lastBeep).TotalMilliseconds;
                if (msecSinceLastBeep > 5000)
                {
                    connMgr.BeepToAllAsync().Wait();
                    connMgr.CloseStaleConnections().Wait();
                    lastBeep = DateTime.UtcNow;
                }
            }
        }
    }
}
