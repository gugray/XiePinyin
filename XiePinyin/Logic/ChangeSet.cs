﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace XiePinyin.Logic
{
    [DebuggerDisplay("{DebugStr}")]
    class ChangeSet
    {
        [JsonProperty("lengthBefore")]
        public int LengthBefore;

        [JsonProperty("lengthAfter")]
        public int LengthAfter;

        /// <summary>
        /// Boxed integers for kept indexes, or <see cref="XieChar"/>s for insertions.
        /// </summary>
        [JsonProperty("items")]
        public readonly List<object> Items = new List<object>();

        [JsonIgnore]
        public string DebugStr
        {
            get { return ToDiagStr(); }
        }

        public static ChangeSet CreateIdent(int length)
        {
            var res = new ChangeSet { LengthBefore = length, LengthAfter = length };
            res.Items.Capacity = length;
            for (int i = 0; i < length; ++i) res.Items.Add(i);
            return res;
        }

        public static ChangeSet FromJson(string json)
        {
            var res = new ChangeSet();
            var obj = JObject.Parse(json);
            res.LengthBefore = (int)obj.GetValue("lengthBefore");
            res.LengthAfter = (int)obj.GetValue("lengthAfter");
            foreach (var itm in obj.GetValue("items"))
            {
                if (itm.Type == JTokenType.Integer) res.Items.Add((int)itm);
                else
                {
                    string hanzi = (string)(itm as JObject).GetValue("hanzi");
                    string pinyin = (string)(itm as JObject).GetValue("pinyin");
                    if (pinyin != null) res.Items.Add(new XieChar(hanzi, pinyin));
                    else res.Items.Add(new XieChar(hanzi));
                }    
            }
            return res;
        }

        public string SerializeJson()
        {
            return JsonConvert.SerializeObject(this);
        }

        public static ChangeSet FromDiagStr(string str)
        {
            var markIx = str.IndexOf('>');
            var lengthBeforeStr = str.Substring(0, markIx);
            int lengthBefore = int.Parse(lengthBeforeStr);
            if (markIx == str.Length - 1)
                return new ChangeSet { LengthBefore = lengthBefore, LengthAfter = 0 };
            var parts = str.Substring(markIx + 1).Split(',');
            var res = new ChangeSet { LengthBefore = lengthBefore, LengthAfter = parts.Length };
            foreach (string s in parts)
            {
                int val;
                if (int.TryParse(s, out val)) res.Items.Add(val);
                else res.Items.Add(new XieChar(s));
            }
            return res;
        }

        public string ToDiagStr()
        {
            var res = LengthBefore.ToString();
            res += '>';
            for (int i = 0; i < Items.Count; ++i)
            {
                if (i != 0) res += ',';
                if (Items[i] is XieChar)
                {
                    var hanzi = (Items[i] as XieChar).Hanzi;
                    res += hanzi == "\n" ? "\\n" : hanzi;
                }
                else res += ((int)Items[i]).ToString();
            }
            return res;
        }

        public bool IsValid()
        {
            if (LengthAfter != Items.Count) return false;
            int last = -1;
            foreach (var o in Items)
            {
                if (o is XieChar) continue;
                int val = (int)o;
                if (val < 0) return false;
                if (val > LengthBefore - 1) return false;
                if (val <= last) return false;
                last = val;
            }
            return true;
        }
        
        public static XieChar[] Apply(XieChar[] text, ChangeSet cs)
        {
            if (text.Length != cs.LengthBefore)
                throw new ArgumentException("Change set's lengthBefore must match text length");
            List<XieChar> items = new List<XieChar>(cs.LengthAfter);
            for (int ix = 0; ix < cs.Items.Count; ++ix)
            {
                if (cs.Items[ix] is XieChar) items.Add(cs.Items[ix] as XieChar);
                else items.Add(text[(int)cs.Items[ix]]);
            }
            return items.ToArray();
        }

        public static void ForwardPositions(ChangeSet cs, int[] poss)
        {
            var pp = new List<int>(poss.Length);
            foreach (int x in poss) pp.Add(x);
            int length = 0;
            for (int i = 0; i < cs.Items.Count; ++i)
            {
                if (cs.Items[i] is XieChar) ++length;
                else
                {
                    int ix = (int)cs.Items[i];
                    for (int j = 0; j < pp.Count; ++j)
                    {
                        if (pp[j] == -1) continue;
                        if (ix + 1 == pp[j])
                        {
                            poss[j] = length + 1;
                            pp[j] = -1;
                        }
                        else if (ix >= pp[j])
                        {
                            poss[j] = length;
                            pp[j] = -1;
                        }
                    }
                    ++length;
                }
            }
            for (int j = 0; j < pp.Count; ++j)
                if (pp[j] != -1)
                    poss[j] = length;
        }

        public static ChangeSet Compose(ChangeSet a, ChangeSet b)
        {
            if (a.LengthAfter != b.LengthBefore)
                throw new ArgumentException("LengthAfter of LHS must equal LengthBefore of RHS.");
            var res = new ChangeSet { LengthBefore = a.LengthBefore, LengthAfter = b.LengthAfter };
            res.Items.Capacity = res.LengthAfter;
            for (int i = 0; i < b.LengthAfter; ++i)
            {
                if (b.Items[i] is XieChar) res.Items.Add(b.Items[i]);
                else
                {
                    int ix = (int)b.Items[i];
                    res.Items.Add(a.Items[ix]);
                }
            }
            return res;
        }

        public static ChangeSet Merge(ChangeSet a, ChangeSet b)
        {
            if (a.LengthBefore != b.LengthBefore)
                throw new ArgumentException("Two change sets must have same LengthBefore.");
            ChangeSet res = new ChangeSet { LengthBefore = a.LengthBefore };
            int ixa = 0, ixb = 0;
            while (ixa < a.Items.Count || ixb < b.Items.Count)
            {
                if (ixa == a.Items.Count)
                {
                    if (b.Items[ixb] is XieChar) res.Items.Add(b.Items[ixb]);
                    ++ixb;
                    continue;
                }
                if (ixb == b.Items.Count)
                {
                    if (a.Items[ixa] is XieChar) res.Items.Add(a.Items[ixa]);
                    ++ixa;
                    continue;
                }
                // We got stuff in both
                XieChar ca = a.Items[ixa] as XieChar;
                XieChar cb = b.Items[ixb] as XieChar;
                // Both are kept characters: sync up position, and keep what's kept in both
                if (ca == null && cb == null)
                {
                    int vala = (int)a.Items[ixa];
                    int valb = (int)b.Items[ixb];
                    if (vala == valb)
                    {
                        res.Items.Add(vala);
                        ++ixa; ++ixb;
                        continue;
                    }
                    else if (vala < valb) ++ixa;
                    else ++ixb;
                    continue;
                }
                // Both are insertions: insert both, in lexicographical order (so merge is commutative)
                if (ca != null && cb != null)
                {
                    if (ca.CompareTo(cb) < 0)
                    {
                        res.Items.Add(ca);
                        res.Items.Add(cb);
                    }
                    else
                    {
                        res.Items.Add(cb);
                        res.Items.Add(ca);
                    }
                    ++ixa; ++ixb;
                    continue;
                }
                // If only one is an insertion, keep that, and advance in that changeset
                if (ca != null)
                {
                    res.Items.Add(ca);
                    ++ixa;
                }
                else
                {
                    res.Items.Add(cb);
                    ++ixb;
                }
            }
            res.LengthAfter = res.Items.Count;
            return res;
        }

        public static ChangeSet Follow(ChangeSet a, ChangeSet b)
        {
            if (a.LengthBefore != b.LengthBefore)
                throw new ArgumentException("Two change sets must have same LengthBefore.");
            ChangeSet res = new ChangeSet { LengthBefore = a.LengthAfter };
            int ixa = 0, ixb = 0;
            //int ofs = 0;
            while (ixa < a.Items.Count || ixb < b.Items.Count)
            {
                if (ixa == a.Items.Count)
                {
                    // Insertions in B become insertions
                    if (b.Items[ixb] is XieChar) res.Items.Add(b.Items[ixb]);
                    ++ixb;
                    continue;
                }
                if (ixb == b.Items.Count)
                {
                    // Insertions in A become retained characters
                    //if (a.Items[ixa] is XieChar) res.Items.Add(ixa + ofs);
                    if (a.Items[ixa] is XieChar) res.Items.Add(ixa);
                    ++ixa;
                    continue;
                }
                // We got stuff in both
                XieChar ca = a.Items[ixa] as XieChar;
                XieChar cb = b.Items[ixb] as XieChar;
                // Both are kept characters: sync up position, and keep what's kept in both
                if (ca == null && cb == null)
                {
                    int vala = (int)a.Items[ixa];
                    int valb = (int)b.Items[ixb];
                    if (vala == valb)
                    {
                        //res.Items.Add(vala + ofs);
                        res.Items.Add(ixa);
                        ++ixa; ++ixb;
                        continue;
                    }
                    else if (vala < valb) ++ixa;
                    else ++ixb;
                    continue;
                }
                // Insertions in A become retained characters
                // We consume A first
                if (ca != null)
                {
                    res.Items.Add(ixa);
                    ++ixa;
                    continue;
                }
                // Insertions in B become insertions
                else
                {
                    res.Items.Add(b.Items[ixb]);
                    ++ixb;
                    continue;
                }
            }
            res.LengthAfter = res.Items.Count;
            return res;
        }
    }
}
