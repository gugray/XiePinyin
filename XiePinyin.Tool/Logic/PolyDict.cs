using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Text;

namespace XiePinyin.Logic
{
    public class PolyDict
    {
        public Dictionary<string, List<string>> DictSimp = new Dictionary<string, List<string>>();
        public Dictionary<string, List<string>> DictTrad = new Dictionary<string, List<string>>();
        Dictionary<string, List<string>> charReadingsSimp = new Dictionary<string, List<string>>();
        Dictionary<string, List<string>> charReadingsTrad = new Dictionary<string, List<string>>();

        public PolyDict(string fn, Pinyin pinyin)
        {
            string line;
            // 玩意兒 玩意儿 [wan2 yi4 r5] /erhua variant of 玩意[wan2 yi4]/
            var re = new Regex(@"^([^ ]+) ([^ ]+) \[([^\]]+)\]");
            using (var sr = new StreamReader(fn))
            {
                while ((line = sr.ReadLine()) != null)
                {
                    var m = re.Match(line);
                    if (!m.Success) continue;
                    string pinyinStr = m.Groups[3].Value;
                    pinyinStr = pinyinStr.Replace("u:", "v").Replace("5", "").ToLowerInvariant();
                    var sylls = pinyinStr.Split(' ');
                    string trad = m.Groups[1].Value;
                    string simp = m.Groups[2].Value;
                    var usimp = new List<string>();
                    var utrad = new List<string>();
                    foreach (string chr in asUniChars(simp)) usimp.Add(chr);
                    foreach (string chr in asUniChars(trad)) utrad.Add(chr);

                    trad = "";
                    simp = "";
                    for (int i = 0; i < utrad.Count; ++i) { if (i != 0) trad += ' '; trad += utrad[i]; }
                    for (int i = 0; i < usimp.Count; ++i) { if (i != 0) simp += ' '; simp += usimp[i]; }

                    bool skip = false;
                    skip |= (sylls.Length != utrad.Count || utrad.Count != usimp.Count);
                    foreach (var syll in sylls) skip |= !pinyin.IsNumSyllable(syll);
                    foreach (string ts in utrad) skip |= !isHanzi(ts);
                    if (skip) continue;

                    if (!DictSimp.ContainsKey(pinyinStr)) DictSimp[pinyinStr] = new List<string>();
                    if (!DictTrad.ContainsKey(pinyinStr)) DictTrad[pinyinStr] = new List<string>();
                    if (usimp.Count > 1)
                    {
                        DictSimp[pinyinStr].Add(simp);
                        DictTrad[pinyinStr].Add(trad);
                    }
                    for (int i = 0; i < sylls.Length; ++i)
                    {
                        if (!charReadingsSimp.ContainsKey(usimp[i])) charReadingsSimp[usimp[i]] = new List<string>();
                        if (!charReadingsTrad.ContainsKey(utrad[i])) charReadingsTrad[utrad[i]] = new List<string>();
                        charReadingsSimp[usimp[i]].Add(sylls[i]);
                        charReadingsTrad[utrad[i]].Add(sylls[i]);
                    }
                }
            }
        }

        static bool isHanzi(string str)
        {
            int cp = char.ConvertToUtf32(str, 0);
            return cp >= 0x2e80 && cp <= 0x2eff ||
                cp >= 0x3000 && cp <= 0x303f ||
                cp >= 0x3200 && cp <= 0x9fff ||
                cp >= 0xf900 && cp <= 0xfaff ||
                cp >= 0xfe30 && cp <= 0xfe4f ||
                cp >= 0x20000 && cp <= 0x2a6df ||
                cp >= 0x2f800 && cp <= 0x2fa1f;
        }

        static IEnumerable<string> asUniChars(string s)
        {
            for (int i = 0; i < s.Length; ++i)
            {
                string res = s.Substring(i, 1);
                if (char.IsHighSurrogate(s[i]))
                {
                    res += s.Substring(i + 1, 1);
                    ++i;
                }
                yield return res;
            }
        }
        public bool HasReading(string chr, string pinyin, bool isSImp)
        {
            Dictionary<string, List<string>> readings = isSImp ? charReadingsSimp : charReadingsTrad;
            if (!readings.ContainsKey(chr)) return false;
            return readings[chr].Contains(pinyin);
        }

        public List<List<string>> Lookup(List<string> sylls, bool simp)
        {
            var res = new List<List<string>>();
            string pinyinStr = sylls[0];
            for (int i = 1; i < sylls.Count; ++i) pinyinStr += ' ' + sylls[i];
            var dict = simp ? DictSimp : DictTrad;
            if (!dict.ContainsKey(pinyinStr)) return res;
            foreach (var hanzi in dict[pinyinStr])
            {
                List<string> itm = new List<string>();
                foreach (char c in hanzi) itm.Add(c.ToString());
                res.Add(itm);
            }
            return res;
        }
    }
}
