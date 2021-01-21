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

        public static ChangeSet operator*(ChangeSet a, ChangeSet b)
        {
            if (a.LengthAfter != b.LengthBefore)
                throw new ArgumentException("LengthAfter of LHS must equalLengthBefore of RHS.");
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
    }
}
