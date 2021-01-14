using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace XiePinyin.Logic
{
    public class CharReadings
    {
        public readonly List<CharReading> ReadingsList = new List<CharReading>();

        public CharReadings(string fn, Dictionary<string, int> ranks, Pinyin pinyin, PolyDict polyDict, bool isSimp)
        {
            var rdict = new Dictionary<string, HashSet<string>>();
            string line;
            Match m;
            // U+7684	kHanyuPinlu	de(75596) dì(157) dí(84)
            // U+7684	kHanyuPinyin	42644.160:dì,dí,de
            // U+5730	kMandarin	de dì
            var reHanyuPinlu = new Regex(@"U\+[^\t]+\tkHanyuPinlu\t(.+)");
            var reHanyuPinyin = new Regex(@"U\+[^\t]+\tkHanyuPinyin\t(.+)");
            var reMandarin = new Regex(@"U\+[^\t]+\tkMandarin\t(.+)");
            using (var sr = new StreamReader(fn))
            {
                while ((line = sr.ReadLine()) != null)
                {
                    if (!line.StartsWith("U+")) continue;
                    string charCode = line.Substring(2, line.IndexOf('\t') - 2);
                    string Char = char.ConvertFromUtf32(Convert.ToInt32(charCode, 16));
                    if (!rdict.ContainsKey(Char)) rdict[Char] = new HashSet<string>();
                    m = reHanyuPinlu.Match(line);
                    if (m.Success)
                    {
                        var parts = m.Groups[1].Value.Split(' ');
                        foreach (var itm in parts)
                            rdict[Char].Add(itm.Substring(0, itm.IndexOf('(')));
                        continue;
                    }
                    m = reHanyuPinyin.Match(line);
                    if (m.Success)
                    {
                        string[] vals = m.Groups[1].Value.Split(' ');
                        foreach (string val in vals)
                        {
                            var parts = val.Substring(val.IndexOf(':') + 1).Split(',');
                            foreach (var reading in parts)
                                rdict[Char].Add(reading);
                        }
                        continue;
                    }
                    m = reMandarin.Match(line);
                    if (m.Success)
                    {
                        // For now, we only consider characters that are on the (short-ish) frequency lists.
                        // This can be extended later, with Unihan-based decision to separate simplified from traditional.
                        if (!ranks.ContainsKey(Char)) continue;
                        var parts = m.Groups[1].Value.Split(' ');
                        foreach (var reading in parts)
                            rdict[Char].Add(reading);
                        continue;
                    }
                }
            }
            foreach (var x in rdict)
            {
                foreach (var reading in x.Value)
                {
                    var readingNums = pinyin.SurfToNums(reading);
                    if (readingNums == null) continue;
                    //if (reading == "hng" || reading == "ế" || reading == "ê" || reading == "ề" || reading == "ê" ||
                    //     reading == "ê̌" || reading == "ê̄" || reading == "wòng" || reading == "dìn" || reading == "hm") continue;
                    // Filter readings: only keep what we've seen in CEDICT
                    if (!polyDict.HasReading(x.Key, readingNums, isSimp))
                        continue;
                    // Remember reading
                    CharReading cr = new CharReading
                    {
                        Hanzi = x.Key,
                        Pinyin = readingNums,
                    };
                    ReadingsList.Add(cr);
                }
            }
            // Sort by rank (more frequent ones come first)
            ReadingsList.Sort((a, b) =>
            {
                if (ranks.ContainsKey(a.Hanzi))
                {
                    if (ranks.ContainsKey(b.Hanzi)) return ranks[a.Hanzi].CompareTo(ranks[b.Hanzi]);
                    else return -1;
                }
                else
                {
                    if (ranks.ContainsKey(b.Hanzi)) return 1;
                    else return 0;
                }
            });
        }
    }
}
