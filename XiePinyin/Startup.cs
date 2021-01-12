using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;

using XiePinyin.Logic;

namespace XiePinyin
{
    public class Startup
    {
        private readonly IWebHostEnvironment env;
        private readonly ILoggerFactory loggerFactory;
        private readonly IConfigurationRoot config;

        public Startup(IWebHostEnvironment env, ILoggerFactory loggerFactory)
        {
            this.env = env;
            this.loggerFactory = loggerFactory;
            var builder = new ConfigurationBuilder()
                .SetBasePath(env.ContentRootPath)
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile("appsettings.devenv.json", optional: true)
                .AddEnvironmentVariables();
            string configPath = Environment.GetEnvironmentVariable("CONFIG");
            if (!string.IsNullOrEmpty(configPath)) builder.AddJsonFile(configPath, optional: false);
            config = builder.Build();
        }

        public void ConfigureServices(IServiceCollection services)
        {
            // MVC for serving pages and REST
            services.AddMvc(x =>
            {
                x.EnableEndpointRouting = false;
            }).AddRazorRuntimeCompilation();
            // Configuration singleton
            services.AddSingleton<IConfiguration>(sp => { return config; });
            // Input conversion
            services.AddSingleton(new Composer(config["sourcesFolder"]));
        }

        public void Configure(IApplicationBuilder app, IHostApplicationLifetime appLife)
        {
            // Sign up to application shutdown so we can do proper cleanup
            //appLife.ApplicationStopping.Register(onApplicationStopping);
            // Static file options: inject caching info for all static files.
            StaticFileOptions sfo = new StaticFileOptions
            {
                OnPrepareResponse = (context) =>
                {
                    // For everything coming from "/files/**", disable caching
                    if (context.Context.Request.Path.Value.StartsWith("/files/"))
                    {
                        context.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                        context.Context.Response.Headers["Pragma"] = "no-cache";
                        context.Context.Response.Headers["Expires"] = "0";
                    }
                    // Cache everything else
                    else
                    {
                        context.Context.Response.Headers["Cache-Control"] = "private, max-age=31536000";
                        context.Context.Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");
                    }
                }
            };
            // Static files (JS, CSS etc.) served directly.
            app.UseStaticFiles(sfo);
            // Serve our (single) .cshtml file, and serve API requests.
            app.UseMvc(routes =>
            {
                routes.MapRoute("api-compose", "api/compose/{*query}", new { controller = "Compose", action="Get" });
                //routes.MapRoute("files", "files/{name}", new { controller = "Files", action = "Get" });
                routes.MapRoute("default", "{*paras}", new { controller = "Index", action = "Index", paras = "" });
            });
        }
    }
}
