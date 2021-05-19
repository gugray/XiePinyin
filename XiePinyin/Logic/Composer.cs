using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    public class Composer
    {
        readonly Pinyin pinyin;
        readonly List<CharReading> readingsSimp = new List<CharReading>();
        readonly List<CharReading> readingsTrad = new List<CharReading>();

        public Composer(string sourcesFolder)
        {
            pinyin = new Pinyin(Path.Combine(sourcesFolder, "pinyin.txt"));
            JsonSerializer ser = new JsonSerializer();
            using (StreamReader sr = new StreamReader(Path.Combine("wwwroot", "simp-map.json")))
            {
                readingsSimp = ser.Deserialize(sr, typeof(List<CharReading>)) as List<CharReading>;
            }
            using (StreamReader sr = new StreamReader(Path.Combine("wwwroot", "trad-map.json")))
            {
                readingsTrad = ser.Deserialize(sr, typeof(List<CharReading>)) as List<CharReading>;
            }
            //addPunctReadings(readingsSimp, true);
            //addPunctReadings(readingsTrad, false);
        }

        void addPunctReadings(List<CharReading> readings, bool simp)
        {
            readings.Add(new CharReading { Hanzi = "。", Pinyin = "." });
            readings.Add(new CharReading { Hanzi = "·", Pinyin = "." });
            readings.Add(new CharReading { Hanzi = "，", Pinyin = "," });
            readings.Add(new CharReading { Hanzi = "、", Pinyin = "," });
            readings.Add(new CharReading { Hanzi = "？", Pinyin = "?" });
            readings.Add(new CharReading { Hanzi = "！", Pinyin = "!" });
            readings.Add(new CharReading { Hanzi = "：", Pinyin = ":" });
            readings.Add(new CharReading { Hanzi = "；", Pinyin = ";" });
            readings.Add(new CharReading { Hanzi = "……", Pinyin = ". . ." });
            readings.Add(new CharReading { Hanzi = "…", Pinyin = ". . ." });
            readings.Add(new CharReading { Hanzi = "【", Pinyin = "(" });
            readings.Add(new CharReading { Hanzi = "（", Pinyin = "(" });
            readings.Add(new CharReading { Hanzi = "】", Pinyin = ")" });
            readings.Add(new CharReading { Hanzi = "）", Pinyin = ")" });
            readings.Add(new CharReading { Hanzi = "《", Pinyin = "(" });
            readings.Add(new CharReading { Hanzi = "》", Pinyin = ")" });
            readings.Add(new CharReading { Hanzi = "——", Pinyin = "- -" });
            if (simp)
            {
                readings.Add(new CharReading { Hanzi = "“", Pinyin = "\"" });
                readings.Add(new CharReading { Hanzi = "”", Pinyin = "\"" });
                readings.Add(new CharReading { Hanzi = "‘", Pinyin = "'" });
                readings.Add(new CharReading { Hanzi = "’", Pinyin = "'" });
            }
            else
            {
                readings.Add(new CharReading { Hanzi = " 「", Pinyin = "\"" });
                readings.Add(new CharReading { Hanzi = "」", Pinyin = "\"" });
                readings.Add(new CharReading { Hanzi = "『", Pinyin = "'" });
                readings.Add(new CharReading { Hanzi = "』", Pinyin = "'" });
            }
        }

        public List<List<string>> Resolve(string pinyinInput, bool isSimp, out List<string> pinyinSylls)
        {
            var res = new List<List<string>>();
            List<CharReading> readings = isSimp ? readingsSimp : readingsTrad;
            string pinyinInputLo = pinyinInput.ToLowerInvariant();
            var loSylls = pinyin.SplitSyllables(pinyinInputLo);
            string loSyllsConcat = "";
            for (int i = 0; i < loSylls.Count; ++i) { if (i != 0) loSyllsConcat += ' '; loSyllsConcat += loSylls[i]; }
            foreach (var r in readings)
            {
                if (r.Pinyin == loSyllsConcat)
                {
                    var itm = new List<string>();
                    itm.Add(r.Hanzi);
                    res.Add(itm);
                }
            }
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

        public string PinyinNumsToSurf(string pyNums)
        {
            string pyNumsLo = pyNums.ToLowerInvariant();
            var loSylls = pinyin.SplitSyllables(pyNumsLo);
            var loSyllsPretty = new List<string>();
            foreach (var ls in loSylls)
            {
                string pretty = pinyin.NumsToSurf(ls);
                if (pretty == null) pretty = ls;
                loSyllsPretty.Add(pretty);
            }
            var origSylls = getOrigSylls(pyNums, pyNumsLo, loSylls);
            string res = "";
            for (int i = 0; i < loSyllsPretty.Count; ++i)
            {
                string loSyllPretty = loSyllsPretty[i];
                if (loSylls[i] == origSylls[i]) res += loSyllPretty;
                else
                {
                    string casedPretty = char.ToUpperInvariant(loSyllPretty[0]).ToString();
                    if (loSyllPretty.Length > 1) casedPretty += loSyllPretty.Substring(1);
                    res += casedPretty;
                }
            }
            return res;
        }
    }
}
