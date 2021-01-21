using NUnit.Framework;
using XiePinyin.Logic;

namespace XiePinyin.Test
{
    public class XieCharTests
    {
        [TestCase("A", "A", 0)]
        [TestCase("A", "B", -1)]
        [TestCase("B", "A", 1)]
        [TestCase("A:x", "A:x", 0)]
        [TestCase("A:x", "B:a", -1)]
        [TestCase("B:a", "A:x", 1)]
        [TestCase("A:x", "A", -1)]
        [TestCase("A", "A:x", 1)]
        public void Compare_Correct(string astr, string bstr, int res)
        {
            XieChar a, b;
            int ixa = astr.IndexOf(':');
            if (ixa == -1) a = new XieChar(astr);
            else a = new XieChar(astr.Substring(0, ixa), astr.Substring(ixa + 1));
            int ixb = bstr.IndexOf(':');
            if (ixb == -1) b = new XieChar(bstr);
            else b = new XieChar(bstr.Substring(0, ixb), bstr.Substring(ixb + 1));
            Assert.AreEqual(res, a.CompareTo(b));
        }
    }
}