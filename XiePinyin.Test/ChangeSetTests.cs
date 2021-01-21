using NUnit.Framework;
using XiePinyin.Logic;

namespace XiePinyin.Test
{
    public class ChangeSetTests
    {
        static ChangeSet fromFriendlyStr(string friendlyString)
        {
            var markIx = friendlyString.IndexOf('>');
            var lengthBeforeStr = friendlyString.Substring(0, markIx);
            int lengthBefore = int.Parse(lengthBeforeStr);
            if (markIx == friendlyString.Length - 1)
                return new ChangeSet { LengthBefore = lengthBefore, LengthAfter = 0 };
            var parts = friendlyString.Substring(markIx + 1).Split(',');
            var res = new ChangeSet { LengthBefore = lengthBefore, LengthAfter= parts.Length };
            foreach (string s in parts)
            {
                int val;
                if (int.TryParse(s, out val)) res.Items.Add(val);
                else res.Items.Add(new XieChar(s));
            }
            return res;
        }

        static string toFriendlyStr(ChangeSet cs)
        {
            var res = cs.LengthBefore.ToString();
            res += '>';
            for (int i = 0;  i < cs.Items.Count; ++i)
            {
                if (i != 0) res += ',';
                if (cs.Items[i] is XieChar) res += (cs.Items[i] as XieChar).Hanzi;
                else res += ((int)cs.Items[i]).ToString();
            }
            return res;
        }

        [TestCase("0>0")]
        [TestCase("1>-1")]
        [TestCase("2>1,0")]
        [TestCase("2>1,1")]
        public void Invalid_Detected(string csStr)
        {
            var cs = fromFriendlyStr(csStr);
            Assert.IsFalse(cs.IsValid());
        }

        [TestCase("0>X,Y", "2>1,A", "0>Y,A")]
        [TestCase("0>X", "1>A", "0>A")]
        [TestCase("0>X", "1>Y,0", "0>Y,X")]
        [TestCase("0>X", "1>0,Y", "0>X,Y")]
        [TestCase("0>X", "1>0", "0>X")]
        [TestCase("0>", "0>X", "0>X")]
        public void Compose_Correct(string csaStr, string csbStr, string csResStr)
        {
            var csa = fromFriendlyStr(csaStr);
            var csb = fromFriendlyStr(csbStr);
            var csRes = csa * csb;
            Assert.AreEqual(csResStr, toFriendlyStr(csRes));
        }
    }
}