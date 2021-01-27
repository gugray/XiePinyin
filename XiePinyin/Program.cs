using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using Serilog;
using Serilog.AspNetCore;
using Serilog.Settings.Configuration;

namespace XiePinyin
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var config = new ConfigurationBuilder()
                .AddJsonFile("appsettings.devenv.json", true)
                .AddJsonFile("appsettings.json")
                .Build();

            Log.Logger = new LoggerConfiguration()
                .ReadFrom.Configuration(config)
                .Enrich.FromLogContext()
                .CreateLogger();

            try
            {
                Log.Information("XiePinyin starting up");
                string port = Environment.GetEnvironmentVariable("PORT");
                if (string.IsNullOrEmpty(port)) port = "1313";
                var builder = createHostBuilder(port);
                var host = builder.Build();
                host.Run();
            }
            catch (Exception ex)
            {
                Log.Fatal(ex, "Application start-up failed");
            }
            finally
            {
                Log.CloseAndFlush();
            }
        }

        static IWebHostBuilder createHostBuilder(string port)
        {
            return new WebHostBuilder()
               .UseUrls("http://0.0.0.0:" + port)
               .UseKestrel()
               .UseContentRoot(Directory.GetCurrentDirectory())
               .UseSerilog()
               .UseStartup<Startup>()
               .CaptureStartupErrors(true);
        }
    }
}
