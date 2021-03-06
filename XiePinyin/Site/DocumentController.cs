﻿using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.StaticFiles;
using Serilog;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    public class DocumentController : Controller
    {
        readonly ILogger logger;
        readonly DocumentJuggler docJuggler;
        readonly string exportsFolder;

        public DocumentController(DocumentJuggler docJuggler, ILogger logger, IConfiguration config)
        {
            this.logger = logger;
            this.docJuggler = docJuggler;
            this.exportsFolder = config["exportsFolder"];
        }

        class ResultWrapper
        {
            public string Result { get; set; } = "OK";
            public object Data { get; set; } = null;
            public ResultWrapper() { }
            public ResultWrapper(object data) { Data = data; }
        }

        [HttpGet]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public IActionResult Open([FromQuery] string docId)
        {
            var sessionKey = docJuggler.RequestSession(docId);
            if (sessionKey == null) return StatusCode(404, "Document not found.");
            return new JsonResult(new ResultWrapper(sessionKey));
        }

        [HttpPost]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public IActionResult Create([FromForm] string name)
        {
            var docId = docJuggler.CreateDocument(name);
            return new JsonResult(new ResultWrapper(docId));
        }

        [HttpPost]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public async Task<IActionResult> ExportDocx([FromForm] string docId)
        {
            var downloadId = await docJuggler.ExportDocx(docId);
            if (downloadId == null) return StatusCode(404, "Document not found.");
            return new JsonResult(new ResultWrapper(downloadId));
        }

        [HttpGet]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public async Task<IActionResult> Download([FromQuery] string name)
        {
            // Verify input, extract doc ID
            string docId = null;
            if (name.Length <= 32)
            {
                var re = new Regex(@"([a-zA-Z0-9]{7})\-[a-zA-Z0-9]{7}\.docx");
                var m = re.Match(name);
                if (m.Success) docId = m.Groups[1].Value;
            }
            if (docId == null) return StatusCode(400, "We don't serve files like that.");

            var filePath = Path.Combine(exportsFolder, name);
            
            if (!System.IO.File.Exists(filePath))
                return StatusCode(404, "File does not exist.");

            var cpProv = new FileExtensionContentTypeProvider();
            string contentType;
            if (!cpProv.TryGetContentType(filePath, out contentType))
                contentType = "application/octet-stream";

            byte[] fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);

            var res = new FileContentResult(fileBytes, contentType);
            res.FileDownloadName = docJuggler.GetDocumentName(docId);
            if (res.FileDownloadName == null) res.FileDownloadName = docId;
            res.FileDownloadName += ".docx";

            return res;
        }

        [HttpPost]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public IActionResult Delete([FromForm] string docId)
        {
            docJuggler.DeleteDocument(docId);
            return new JsonResult(new ResultWrapper());
        }
    }
}
