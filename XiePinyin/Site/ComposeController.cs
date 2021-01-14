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

        public IActionResult Get([FromForm]string prompt)
        {
            List<string> pinyinSylls;
            var words = composer.Resolve(prompt, false, out pinyinSylls);
            ComposeResult res = new ComposeResult
            {
                PinyinSylls = pinyinSylls,
                Words = words,
            };
            return new JsonResult(res);
        }
    }
}
