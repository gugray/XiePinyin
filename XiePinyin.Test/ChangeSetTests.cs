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

        [TestCase("1>0,Z", "{\"lengthBefore\":1,\"lengthAfter\":2,\"items\":[0,{\"hanzi\":\"Z\"}]}")]
        public void Object_Serialized_Deserialized(string csStr, string jsonStr)
        {
            var cs2 = ChangeSet.FromJson(jsonStr);
            Assert.AreEqual(toFriendlyStr(cs2), csStr);

            var cs = fromFriendlyStr(csStr);
            var jsonRes = cs.SerializeJson();
            Assert.AreEqual(jsonStr, jsonRes);
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
            var csRes = ChangeSet.Compose(csa, csb);
            Assert.AreEqual(csResStr, toFriendlyStr(csRes));
        }

        [TestCase("8>1,s,i,7", "8>1,a,x,2", "8>1,a,s,i,x")]
        [TestCase("8>0,1,s,i,7", "8>0,e,i,x,6,7", "8>0,e,i,x,s,i,7")]
        [TestCase("8>0,1,s,i,7", "8>0,e,6,o,w", "8>0,e,s,i,o,w")]
        public void Merge_Correct(string csaStr, string csbStr, string csResStr)
        {
            var csa = fromFriendlyStr(csaStr);
            var csb = fromFriendlyStr(csbStr);
            var csM1 = ChangeSet.Merge(csa, csb);
            var csM2 = ChangeSet.Merge(csb, csa);
            Assert.AreEqual(csResStr, toFriendlyStr(csM1));
            Assert.AreEqual(csResStr, toFriendlyStr(csM2));
        }

        [TestCase("8>0,e,6,o,w", "8>0,1,s,i,7", "5>0,1,s,i,3,4")]
        [TestCase("8>0,1,s,i,7", "8>0,e,6,o,w", "5>0,e,2,3,o,w")]
        public void Follow_Correct(string csaStr, string csbStr, string csResStr)
        {
            var csa = fromFriendlyStr(csaStr);
            var csb = fromFriendlyStr(csbStr);
            var csF = ChangeSet.Follow(csa, csb);
            Assert.AreEqual(csResStr, toFriendlyStr(csF));
        }
    }
}