using System;

using XiePinyin.Logic;

namespace XiePinyin
{
    class Program
    {
        static void Main(string[] args)
        {
            // Assemble info about mono- and polysyllabic character readings
            var resolver = new PinyinResolver("_sources");
            resolver.WriteMap("XiePinyin/wwwroot/simp-map.json", true);
            resolver.WriteMap("XiePinyin/wwwroot/trad-map.json", false);
        }
    }
}
