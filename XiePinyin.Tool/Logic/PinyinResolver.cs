using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    public class PinyinResolver
    {
        readonly Pinyin pinyin;
        readonly Dictionary<string, int> ranksSimp = new Dictionary<string, int>();
        readonly Dictionary<string, int> ranksTrad = new Dictionary<string, int>();
        readonly CharReadings charReadingsSimp;
        readonly CharReadings charReadingsTrad;
        readonly PolyDict polyDict;
        const string vowels = "aeiou";

        public PinyinResolver(string sourcesFolder)
        {
            readRanks(Path.Combine(sourcesFolder, "junda-freq.txt"), true);
            readRanks(Path.Combine(sourcesFolder, "tsai-freq.txt"), false);
            pinyin = new Pinyin(Path.Combine(sourcesFolder, "pinyin.txt"));
            polyDict = new PolyDict(Path.Combine(sourcesFolder, "cedict_ts.u8"), pinyin);
            charReadingsSimp = new CharReadings(Path.Combine(sourcesFolder, "Unihan_Readings.txt"), ranksSimp, pinyin, polyDict, true);
            charReadingsTrad = new CharReadings(Path.Combine(sourcesFolder, "Unihan_Readings.txt"), ranksTrad, pinyin, polyDict, false);
        }

        public void WriteMap(string fn, bool isSimp)
        {
            List<CharReading> fullList = new List<CharReading>();
            CharReadings readings = isSimp ? charReadingsSimp : charReadingsTrad;
            foreach (var rdg in readings.ReadingsList) fullList.Add(rdg);
            Dictionary<string, List<string>> dict = isSimp ? polyDict.DictSimp : polyDict.DictTrad;
            foreach (var x in dict)
            {
                foreach (var hanzi in x.Value)
                {
                    fullList.Add(new CharReading
                    {
                        Hanzi = hanzi,
                        Pinyin = x.Key,
                    });
                }
            }
            using (StreamWriter sw = new StreamWriter(fn))
            {
                sw.NewLine = "\r";
                JsonSerializer serializer = new JsonSerializer();
                serializer.Formatting = Formatting.Indented;
                serializer.Serialize(sw, fullList);
            }
        }

        public List<List<string>> Resolve(string pinyinInput, out List<string> pinyinSylls)
        {
            var res = new List<List<string>>();
            string pinyinInputLo = pinyinInput.ToLowerInvariant();
            var loSylls = pinyin.SplitSyllables(pinyinInputLo);
            if (loSylls.Count == 1)
            {
                foreach (var r in charReadingsSimp.ReadingsList)
                {
                    if (r.Pinyin == loSylls[0])
                    {
                        var itm = new List<string>();
                        itm.Add(r.Hanzi);
                        res.Add(itm);
                    }
                }
            }
            else res = polyDict.Lookup(loSylls, true);
            pinyinSylls = getOrigSylls(pinyinInput, pinyinInputLo, loSylls);
            return res;
        }

        List<string> getOrigSylls(string orig, string lo, List<string> loSylls)
        {
            var res = new List<string>();
            int ix = 0;
            for (int i = 0; i < loSylls.Count; ++i)
            {
                ix = lo.IndexOf(loSylls[i], ix);
                string origSyll = orig.Substring(ix, loSylls[i].Length);
                ix += origSyll.Length;
                res.Add(origSyll);
            }
            return res;
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
