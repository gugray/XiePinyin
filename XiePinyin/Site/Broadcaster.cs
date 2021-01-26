using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    internal class Broadcaster : IBroadcaster
    {

        readonly ConnectionManager connMgr;
        readonly Thread thread;
        readonly AutoResetEvent loopEvent = new AutoResetEvent(false);
        readonly List<ChangeToBroadcast> broadcastQueue = new List<ChangeToBroadcast>();
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

        public void TerminateSessions(List<string> sessionKeys)
        {

        }

        public void EnqueueChangeForBroadcast(ChangeToBroadcast ctb)
        {
            lock (broadcastQueue)
            {
                broadcastQueue.Add(ctb);
                loopEvent.Set();
            }
        }

        /// <summary>
        /// Broadcasts whatever is in the queue. Must be called from within lock.
        /// </summary>
        void broadcastFromQueue()
        {
            foreach (var ctb in broadcastQueue)
            {
                try { connMgr.BroadcastChange(ctb).Wait(); }
                catch { } // TO-DO: Log when we have, erm, logging
            }
            broadcastQueue.Clear();
        }

        void threadFun()
        {
            DateTime lastBeep = DateTime.UtcNow;
            while (true)
            {
                // Waking up to an event
                if (loopEvent.WaitOne(500))
                {
                    if (shuttingDown) break;
                    lock (broadcastQueue)
                    {
                        broadcastFromQueue();
                    }
                }
                // Whether we're here because event was signaled or we got tired waiting:
                // Let's look at the time and deal with recurring activities
                if (shuttingDown) break;
                int msecSinceLastBeep = (int)DateTime.UtcNow.Subtract(lastBeep).TotalMilliseconds;
                if (msecSinceLastBeep > 5000)
                {
                    // TO-DO: Turn back on
                    //connMgr.BeepToAllAsync().Wait();
                    connMgr.CloseNonPingingConnections().Wait();
                    lastBeep = DateTime.UtcNow;
                }
            }
        }
    }
}
