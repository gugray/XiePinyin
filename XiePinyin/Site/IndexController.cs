using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Reflection;

namespace XiePinyin.Site
{
    [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
    public class IndexController : Controller
    {
        readonly string baseUrl;
        readonly string ver;
 
        public IndexController(IConfiguration config, ILoggerFactory loggerFactory)
        {
            baseUrl = config["baseUrl"];
            ver = getVersionString();
        }

        static string getVersionString()
        {
            Assembly a = typeof(IndexController).GetTypeInfo().Assembly;
            using (Stream s = a.GetManifestResourceStream("XiePinyin.version.txt"))
            using (StreamReader sr = new StreamReader(s))
            {
                return sr.ReadLine();
            }
        }

        /// <summary>
        /// Serves single-page app's page requests.
        /// </summary>
        /// <param name="paras">The entire relative URL.</param>
        public IActionResult Index(string paras)
        {
            string rel = paras == null ? "" : paras;
            // Unknonwn path
            if (rel != "") return StatusCode(404, "甚麼?");
            // OK, return index
            IndexModel model = new IndexModel
            {
                BaseUrl = baseUrl,
                Rel = rel,
                Ver = ver,
            };
            return View("/Index.cshtml", model);
        }
    }
}

