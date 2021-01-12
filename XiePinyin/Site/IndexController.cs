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
            string fn = a.FullName;
            int ix1 = fn.IndexOf("Version=") + "Version=".Length;
            int ix2 = fn.IndexOf('.', ix1);
            int ix3 = fn.IndexOf('.', ix2 + 1);
            int ix4 = fn.IndexOf('.', ix3 + 1);
            string strMajor = fn.Substring(ix1, ix2 - ix1);
            string strMinor = fn.Substring(ix2 + 1, ix3 - ix2 - 1);
            string strBuild = fn.Substring(ix3 + 1, ix4 - ix3 - 1);
            return strMajor + "." + strMinor + "." + strBuild;
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
                Ver = "v" + ver,
            };
            return View("/Index.cshtml", model);
        }
    }
}

