using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    class ChangeToBroadcast
    {
        public string SourceSessionKey;
        public int SourceBaseDocRevisionId;
        public int NewDocRevisionId;
        public List<string> ReceiverSessionKeys;
        public string ChangeJson;
    }
}
