using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Site
{
    interface IChangeBroadcaster
    {
        void SendToKeysAsync(string sourceSessionKey, int clientRevisionId, List<string> sessionKeys, string change);
    }
}
