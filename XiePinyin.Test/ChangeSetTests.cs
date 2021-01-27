using NUnit.Framework;
using XiePinyin.Logic;

namespace XiePinyin.Test
{
    public class ChangeSetTests
    {
        [TestCase("1>0,Z", "{\"lengthBefore\":1,\"lengthAfter\":2,\"items\":[0,{\"hanzi\":\"Z\"}]}")]
        public void Object_Serialized_Deserialized(string csStr, string jsonStr)
        {
            var cs2 = ChangeSet.FromJson(jsonStr);
            Assert.AreEqual(cs2.ToDiagStr(), csStr);

            var cs = ChangeSet.FromDiagStr(csStr);
            var jsonRes = cs.SerializeJson();
            Assert.AreEqual(jsonStr, jsonRes);
        }

        [TestCase("0>0")]
        [TestCase("1>-1")]
        [TestCase("2>1,0")]
        [TestCase("2>1,1")]
        public void Invalid_Detected(string csStr)
        {
            var cs = ChangeSet.FromDiagStr(csStr);
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
            var csa = ChangeSet.FromDiagStr(csaStr);
            var csb = ChangeSet.FromDiagStr(csbStr);
            var csRes = ChangeSet.Compose(csa, csb);
            Assert.AreEqual(csResStr, csRes.ToDiagStr());
        }

        [TestCase("8>1,s,i,7", "8>1,a,x,2", "8>1,a,s,i,x")]
        [TestCase("8>0,1,s,i,7", "8>0,e,i,x,6,7", "8>0,e,i,x,s,i,7")]
        [TestCase("8>0,1,s,i,7", "8>0,e,6,o,w", "8>0,e,s,i,o,w")]
        public void Merge_Correct(string csaStr, string csbStr, string csResStr)
        {
            var csa = ChangeSet.FromDiagStr(csaStr);
            var csb = ChangeSet.FromDiagStr(csbStr);
            var csM1 = ChangeSet.Merge(csa, csb);
            var csM2 = ChangeSet.Merge(csb, csa);
            Assert.AreEqual(csResStr, csM1.ToDiagStr());
            Assert.AreEqual(csResStr, csM2.ToDiagStr());
        }

        [TestCase("2>Q,0,1", "2>0,1", "3>0,1,2")]
        [TestCase("2>Q,0,1", "2>W,0,1", "3>0,W,1,2")]
        [TestCase("8>0,e,6,o,w", "8>0,1,s,i,7", "5>0,1,s,i,3,4")]
        [TestCase("8>0,1,s,i,7", "8>0,e,6,o,w", "5>0,e,2,3,o,w")]
        public void Follow_Correct(string csaStr, string csbStr, string csResStr)
        {
            var csa = ChangeSet.FromDiagStr(csaStr);
            var csb = ChangeSet.FromDiagStr(csbStr);
            var csF = ChangeSet.Follow(csa, csb);
            Assert.AreEqual(csResStr, csF.ToDiagStr());
        }
    }
}