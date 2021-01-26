using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    internal interface IBroadcaster
    {
        void EnqueueChangeForBroadcast(ChangeToBroadcast ctb);
        void TerminateSessions(List<string> sessionKeys);
    }
}
