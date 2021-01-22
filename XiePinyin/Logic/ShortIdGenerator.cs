using System;
using System.Collections.Generic;
using System.Linq;
using Force.Crc32;

namespace XiePinyin.Logic
{
    static class ShortIdGenerator
    {
        static int counter = new Random((int)DateTime.Now.Ticks).Next();
        static readonly object lockObj = new object();

        public static string Next()
        {
            int val;
            lock(lockObj)
            {
                val = ++counter;
            }
            var buf = new byte[4];
            buf[0] = (byte)(val & 0xff);
            buf[1] = (byte)((val >> 8) & 0xff);
            buf[2] = (byte)((val >> 16) & 0xff);
            buf[3] = (byte)((val >> 24) & 0xff);
            uint hashVal = Crc32Algorithm.Compute(buf);
            return valToString(hashVal);
        }

        static string valToString(uint val)
        {
            // x00xx0x
            char[] res = new char[7];
            uint x = val;
            res[6] = numToChar(x % 52); x /= 52;
            res[5] = (char)((x % 10) + '0'); x /= 10;
            res[4] = numToChar(x % 52); x /= 52;
            res[3] = numToChar(x % 52); x /= 52;
            res[2] = (char)((x % 10) + '0'); x /= 10;
            res[1] = (char)((x % 10) + '0'); x /= 10;
            res[0] = numToChar(x % 52); x /= 52;
            if (x != 0) throw new Exception("Number cannot be represented: " + val.ToString());
            return new string(res);
        }

        static char numToChar(uint num)
        {
            if (num < 26) return (char)(num + 'a');
            if (num < 52) return (char)(num - 26 + 'A');
            throw new Exception("Invalid conversion to char: " + num.ToString());
        }

    }
}
