using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Site
{
    class DocumentJuggler
    {
        public IChangeBroadcaster Broadcaster;

        public DocumentJuggler()
        {
        }

        public string OpenSession(string sessionKey)
        {
            return "babboo";
        }

        public void SessionClosed(string sessionKey)
        {

        }

        public void ChangeReceived(string sessionkey, string change)
        {
            Broadcaster.SendToKeysAsync(null, null);
        }
    }
}
