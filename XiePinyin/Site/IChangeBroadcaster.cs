using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Site
{
    interface IChangeBroadcaster
    {
        void SendToKeysAsync(List<string> sessionKeys, string change);
    }
}
