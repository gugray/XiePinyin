using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    class ChangeSet
    {
        public int LengthBefore;
        public int LengthAfter;
        /// <summary>
        /// Boxed integers for kept indexes, or <see cref="XieChar"/>s for insertions.
        /// </summary>
        public readonly List<object> Items = new List<object>();

        public static ChangeSet CreateIdent(int length)
        {
            var res = new ChangeSet { LengthBefore = length, LengthAfter = length };
            res.Items.Capacity = length;
            for (int i = 0; i < length; ++i) res.Items.Add(i);
            return res;
        }

        public static ChangeSet FromJson(string json)
        {
            // TO-DO
            return null;
        }

        public string SerializeJson()
        {
            // TO-DO
            return "change";
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
                        res.Items.Add(vala);
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
