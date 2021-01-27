using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using Serilog;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    public class DocumentController : Controller
    {
        readonly ILogger logger;
        readonly DocumentJuggler docJuggler;

        public DocumentController(DocumentJuggler docJuggler, ILogger logger)
        {
            this.logger = logger;
            this.docJuggler = docJuggler;
        }

        class ResultWrapper
        {
            public string Result { get; set; } = "OK";
            public object Data { get; set; } = null;
            public ResultWrapper() { }
            public ResultWrapper(object data) { Data = data; }
        }

        [HttpGet]
        public IActionResult Open([FromQuery] string docId)
        {
            var sessionKey = docJuggler.RequestSession(docId);
            if (sessionKey == null) return StatusCode(404, "Document not found.");
            return new JsonResult(new ResultWrapper(sessionKey));
        }

        [HttpPost]
        public IActionResult Create([FromForm] string name)
        {
            var docId = docJuggler.CreateDocument(name);
            return new JsonResult(new ResultWrapper(docId));
        }

        [HttpPost]
        public IActionResult Delete([FromForm] string docId)
        {
            docJuggler.DeleteDocument(docId);
            return new JsonResult(new ResultWrapper());
        }
    }
}
