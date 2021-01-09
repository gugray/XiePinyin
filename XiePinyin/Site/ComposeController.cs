using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    public class ComposeController : Controller
    {
        public class ComposeResult
        {
            public string PinyinPretty { get; set; }
            public List<string> Words { get; set; }
        }

        readonly Composer composer;

        public ComposeController(Composer composer)
        {
            this.composer = composer;
        }

        public IActionResult Get(string query)
        {
            string pinyinPretty;
            var words = composer.Resolve(query, out pinyinPretty);
            ComposeResult res = new ComposeResult
            {
                PinyinPretty = pinyinPretty,
                Words = words,
            };
            return new JsonResult(res);
        }
    }
}
