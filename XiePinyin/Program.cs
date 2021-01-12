using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;

namespace XiePinyin
{
    public class Program
    {
        public static void Main(string[] args)
        {
            string port = Environment.GetEnvironmentVariable("PORT");
            if (string.IsNullOrEmpty(port)) port = "1313";
            var host = new WebHostBuilder()
               .UseUrls("http://0.0.0.0:" + port)
               .UseKestrel()
               .UseContentRoot(Directory.GetCurrentDirectory())
               .ConfigureLogging(x => { })
               .UseStartup<Startup>()
               .CaptureStartupErrors(true)
               .Build();
            host.Run();
        }
    }
}
