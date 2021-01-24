using System;
using System.Diagnostics;
using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    [DebuggerDisplay("{DebugStr}")]
    sealed class XieChar : IEquatable<XieChar>
    {
        [JsonProperty("hanzi")]
        public readonly string Hanzi;

        [JsonProperty("pinyin", NullValueHandling = NullValueHandling.Ignore)]
        public readonly string Pinyin;

        [JsonConstructor]
        public XieChar(string hanzi, string pinyin = null)
        {
            Hanzi = hanzi;
            Pinyin = pinyin;
        }

        [JsonIgnore]
        public string DebugStr
        {
            get
            {
                if (Pinyin == null) return Hanzi;
                else return Hanzi + ": " + Pinyin;
            }
        }

        public bool Equals(XieChar xc)
        {
            if (ReferenceEquals(xc, null)) return false;
            if (ReferenceEquals(this, xc)) return true;
            return Hanzi == xc.Hanzi && Pinyin == xc.Pinyin;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as XieChar);
        }

        public override int GetHashCode()
        {
            if (Pinyin == null) return Hanzi.GetHashCode();
            else return Hanzi.GetHashCode() + Pinyin.GetHashCode();
        }

        public static bool operator==(XieChar lhs, XieChar rhs)
        {
            if (ReferenceEquals(lhs, null))
            {
                if (ReferenceEquals(rhs, null)) return true;
                else return false;
            }
            else return lhs.Equals(rhs);
        }

        public static bool operator!=(XieChar lhs, XieChar rhs)
        {
            return !(lhs == rhs);
        }

        public int CompareTo(XieChar rhs)
        {
            if (Hanzi.CompareTo(rhs.Hanzi) != 0) return Hanzi.CompareTo(rhs.Hanzi);
            if (Pinyin == rhs.Pinyin) return 0;
            if (Pinyin == null) return 1;
            if (rhs.Pinyin == null) return -1;
            return Pinyin.CompareTo(rhs.Pinyin);
        }
    }
}
