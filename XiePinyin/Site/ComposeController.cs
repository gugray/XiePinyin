using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    public class ComposeController : Controller
    {
        public class ComposeResult
        {
            public List<string> PinyinSylls { get; set; }
            public List<List<string>> Words { get; set; }
        }

        readonly Composer composer;

        public ComposeController(Composer composer)
        {
            this.composer = composer;
        }

        public IActionResult Get(string query)
        {
            var pinyinSylls = new List<string>();
            var words = composer.Resolve(query, out pinyinSylls);
            ComposeResult res = new ComposeResult
            {
                PinyinSylls = pinyinSylls,
                Words = words,
            };
            return new JsonResult(res);
        }
    }
}
