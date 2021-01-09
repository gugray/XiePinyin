using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace XiePinyin.Logic
{
    public class PolyDict
    {
        Dictionary<string, List<string>> dictSimp = new Dictionary<string, List<string>>();
        Dictionary<string, List<string>> dictTrad = new Dictionary<string, List<string>>();

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
                    bool skip = false;
                    foreach (var syll in sylls)
                        skip |= !pinyin.IsNumSyllable(syll);
                    if (skip) continue;
                    string trad = m.Groups[1].Value;
                    string simp = m.Groups[2].Value;
                    if (sylls.Length != trad.Length || sylls.Length == 1 || trad.Length != simp.Length) continue;
                    if (!dictSimp.ContainsKey(pinyinStr)) dictSimp[pinyinStr] = new List<string>();
                    if (!dictTrad.ContainsKey(pinyinStr)) dictTrad[pinyinStr] = new List<string>();
                    dictSimp[pinyinStr].Add(simp);
                    dictTrad[pinyinStr].Add(trad);
                }
            }
        }

        public List<string> Lookup(List<string> sylls, bool simp)
        {
            var res = new List<string>();
            string pinyinStr = sylls[0];
            for (int i = 1; i < sylls.Count; ++i) pinyinStr += ' ' + sylls[i];
            var dict = simp ? dictSimp : dictTrad;
            if (!dict.ContainsKey(pinyinStr)) return res;
            res.AddRange(dict[pinyinStr]);
            return res;
        }
    }
}
