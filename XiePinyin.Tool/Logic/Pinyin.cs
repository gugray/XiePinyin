using System;
using System.Collections.Generic;
using System.IO;

namespace XiePinyin.Logic
{
    public class Pinyin
    {
        /// <summary>
        /// Info about a single pinyin syllable for splitting words written w/o spaces
        /// </summary>
        class PinyinParseSyllable
        {
            /// <summary>
            /// Syllable text (no tone mark, but may include trailing r)
            /// </summary>
            public readonly string Text;
            /// <summary>
            /// True if syllable starts with a vowel (cannot be inside word: apostrophe would be needed)
            /// </summary>
            public readonly bool VowelStart;
            /// <summary>
            /// Ctor: initialize immutable instance.
            /// </summary>
            public PinyinParseSyllable(string text, bool vowelStart)
            {
                Text = text;
                VowelStart = vowelStart;
            }
        }

        /// <summary>
        /// List of known pinyin syllables; longer first.
        /// </summary>
        readonly List<PinyinParseSyllable> syllList = new List<PinyinParseSyllable>();

        /// <summary>
        /// Maps surface form syllables (with diacritics) to numbered form: hái -> hai2, nǚ -> nv3
        /// </summary>
        readonly Dictionary<string, string> surfToNum = new Dictionary<string, string>();

        /// Maps from numbered form to surface with diacriticts: hai2 -> hái, nv3 -> nǚ
        readonly Dictionary<string, string> numToSurf = new Dictionary<string, string>();

        public Pinyin(string fn)
        {
            // Syllables for interpreting query
            using (StreamReader sr = new StreamReader(fn))
            {
                string line;
                while ((line = sr.ReadLine()) != null)
                {
                    if (line == string.Empty) continue;
                    string[] parts = line.Split(new char[] { '\t' });
                    PinyinParseSyllable ps = new PinyinParseSyllable(parts[0], parts[1] == "v");
                    syllList.Add(ps);
                    surfToNum[parts[1]] = parts[0];
                    surfToNum[parts[2]] = parts[0] + '1';
                    surfToNum[parts[3]] = parts[0] + '2';
                    surfToNum[parts[4]] = parts[0] + '3';
                    surfToNum[parts[5]] = parts[0] + '4';
                    numToSurf[parts[0]] = parts[1];
                    numToSurf[parts[0] + '1'] = parts[2];
                    numToSurf[parts[0] + '2'] = parts[3];
                    numToSurf[parts[0] + '3'] = parts[4];
                    numToSurf[parts[0] + '4'] = parts[5];
                }
            }
            surfToNum["r"] = "r";
            numToSurf["r"] = "r";
            syllList.Sort((a, b) => b.Text.Length.CompareTo(a.Text.Length));
        }

        public string SurfToNums(string pinyinSurf)
        {
            if (!surfToNum.ContainsKey(pinyinSurf)) return null;
            return surfToNum[pinyinSurf];
        }

        public string NumsToSurf(string pinyinNums)
        {
            if (!numToSurf.ContainsKey(pinyinNums)) return null;
            else return numToSurf[pinyinNums];
        }

        public bool IsNumSyllable(string pinyinNum)
        {
            return numToSurf.ContainsKey(pinyinNum);
        }

        /// <summary>
        /// Recursively match pinyin syllables from start position in string.
        /// </summary>
        bool matchSylls(string str, int pos, List<int> ends)
        {
            // Reach end of string: good
            if (pos == str.Length) return true;
            // Get rest of string to match
            string rest = pos == 0 ? str : str.Substring(pos);
            // Try all syllables in syllabary
            foreach (PinyinParseSyllable ps in syllList)
            {
                // Syllables starting with a vowel not allowed inside text
                if (pos != 0 && ps.VowelStart) continue;
                // Find matching syllable
                if (rest.StartsWith(ps.Text))
                {
                    int endPos = pos + ps.Text.Length;
                    // We have a tone mark (digit 1-5) after syllable: got to skip that
                    if (rest.Length > ps.Text.Length)
                    {
                        char nextChr = rest[ps.Text.Length];
                        if (nextChr >= '1' && nextChr <= '5') ++endPos;
                    }
                    // Record end of syllable
                    ends.Add(endPos);
                    // If rest matches, we're done
                    if (matchSylls(str, endPos, ends)) return true;
                    // Otherwise, backtrack, move on to next syllable
                    ends.RemoveAt(ends.Count - 1);
                }
            }
            // If we're here, failed to resolve syllables
            return false;
        }

        /// <summary>
        /// Split string into possible multiple pinyin syllables, or return as whole if not possible.
        /// </summary>
        public List<string> SplitSyllables(string str)
        {
            List<string> res = new List<string>();
            // Sanity check
            if (str == string.Empty) return res;
            // Ending positions of syllables
            List<int> ends = new List<int>();
            // Recursive matching
            matchSylls(str, 0, ends);
            // Failed to match: return original string in one
            if (ends.Count == 0)
            {
                res.Add(str);
                return res;
            }
            // Split
            int pos = 0;
            foreach (int i in ends)
            {
                string part = str.Substring(pos, i - pos);
                res.Add(part);
                pos = i;
            }
            // Done.
            return res;
        }
    }
}

