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

        public List<string> Resolve(string pinyinInput, out string pinyinPretty)
        {
            var res = new List<string>();
            var sylls = pinyin.SplitSyllables(pinyinInput.ToLowerInvariant());
            if (sylls.Count == 1)
            {
                foreach (var r in charReadingsSimp.ReadingsList)
                {
                    if (r.Pinyin == sylls[0])
                    {
                        res.Add(r.Char);
                    }
                }
                pinyinPretty = pinyin.NumsToSurf(sylls[0]);
            }
            else
            {
                res = polyDict.Lookup(sylls, true);
                pinyinPretty = pinyin.NumsToSurf(sylls[0]);
                if (res.Count == 0) pinyinPretty = null;
                for (int i = 1; i < sylls.Count && pinyinPretty != null; ++i)
                {
                    string nextPretty = pinyin.NumsToSurf(sylls[i]);
                    if (nextPretty != null)
                    {
                        if (vowels.IndexOf(sylls[i][0]) != -1) pinyinPretty += "'";
                        pinyinPretty += nextPretty;
                    }
                    else pinyinPretty = null;
                }
            }
            if (pinyinPretty != null) fixCasing(pinyinInput, pinyinPretty);
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
