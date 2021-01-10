using System;
using System.Collections.Generic;
using System.IO;

namespace XiePinyin.Logic
{
    public class Composer
    {
        readonly Pinyin pinyin;
        readonly Dictionary<string, int> ranksSimp = new Dictionary<string, int>();
        readonly Dictionary<string, int> ranksTrad = new Dictionary<string, int>();
        readonly CharReadings charReadingsSimp;
        readonly CharReadings charReadingsTrad;
        readonly PolyDict polyDict;
        const string vowels = "aeiou";

        public Composer(string sourcesFolder)
        {
            readRanks(Path.Combine(sourcesFolder, "junda-freq.txt"), true);
            readRanks(Path.Combine(sourcesFolder, "tsai-freq.txt"), false);
            pinyin = new Pinyin(Path.Combine(sourcesFolder, "pinyin.txt"));
            charReadingsSimp = new CharReadings(Path.Combine(sourcesFolder, "Unihan_Readings.txt"), ranksSimp, pinyin);
            charReadingsTrad = new CharReadings(Path.Combine(sourcesFolder, "Unihan_Readings.txt"), ranksTrad, pinyin);
            polyDict = new PolyDict(Path.Combine(sourcesFolder, "cedict.u8"), pinyin);
        }

        public List<List<string>> Resolve(string pinyinInput, out List<string> pinyinSylls)
        {
            var res = new List<List<string>>();
            pinyinSylls = pinyin.SplitSyllables(pinyinInput.ToLowerInvariant());
            if (pinyinSylls.Count == 1)
            {
                foreach (var r in charReadingsSimp.ReadingsList)
                {
                    if (r.Pinyin == pinyinSylls[0])
                    {
                        var itm = new List<string>();
                        itm.Add(r.Char);
                        res.Add(itm);
                    }
                }
            }
            else
            {
                res = polyDict.Lookup(pinyinSylls, true);
            }
            return res;
        }

        void fixCasing(string pinyinInput, string pinyinPretty)
        {
            // TO-DO
        }

        void readRanks(string fn, bool isSimp)
        {
            string line;
            using (var sr = new StreamReader(fn))
            {
                int i = 0;
                while ((line = sr.ReadLine()) != null)
                {
                    if (line == "" || line.StartsWith("#")) continue;
                    var parts = line.Split('\t');
                    if (isSimp) ranksSimp[parts[1]] = i;
                    else ranksTrad[parts[0]] = i;
                    ++i;
                }
            }
        }
    }
}
