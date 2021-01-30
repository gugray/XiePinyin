using System;
using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    class Selection
    {
        [JsonProperty("start")]
        public int Start;
        [JsonProperty("end")]
        public int End;
        [JsonProperty("caretAtStart")]
        public bool CaretAtStart;
    }
}
