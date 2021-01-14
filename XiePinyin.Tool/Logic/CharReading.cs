using System;
using System.Collections.Generic;
using System.Text;
using System.Diagnostics;
using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    [DebuggerDisplay("{Hanzi}: {Pinyin}")]
    public class CharReading
    {
        [JsonProperty("hanzi")]
        public string Hanzi;
        [JsonProperty("pinyin")]
        public string Pinyin;
    }

}
