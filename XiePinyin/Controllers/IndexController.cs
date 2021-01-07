using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PYX.Controllers
{
    [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
    public class IndexController : Controller
    {
        private readonly string baseUrl;
 
        public IndexController(IConfiguration config, ILoggerFactory loggerFactory)
        {
            baseUrl = config["baseUrl"];
        }

        /// <summary>
        /// Serves single-page app's page requests.
        /// </summary>
        /// <param name="paras">The entire relative URL.</param>
        public IActionResult Index(string paras)
        {
            string rel = paras == null ? "" : paras;
            IndexModel model = new IndexModel
            {
                BaseUrl = baseUrl,
                Rel = rel,
            };
            return View("/Index.cshtml", model);
        }
    }
}

