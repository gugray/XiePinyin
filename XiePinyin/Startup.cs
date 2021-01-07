using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Westwind.AspNetCore.LiveReload;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PYX
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
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.devenv.json", optional: true)
                .AddEnvironmentVariables();
            config = builder.Build();
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddLiveReload();
            // MVC for serving pages and REST
            services.AddMvc(x =>
            {
                x.EnableEndpointRouting = false;
            }).AddRazorRuntimeCompilation();
            // Configuration singleton
            services.AddSingleton<IConfiguration>(sp => { return config; });
        }

        public void Configure(IApplicationBuilder app, IHostApplicationLifetime appLife)
        {
            app.UseLiveReload();
            
            // Sign up to application shutdown so we can do proper cleanup
            //appLife.ApplicationStopping.Register(onApplicationStopping);
            // Static file options: inject caching info for all static files.
            StaticFileOptions sfo = new StaticFileOptions
            {
                OnPrepareResponse = (context) =>
                {
                    // Genuine static staff: tell browser to cache indefinitely
                    bool toCache = context.Context.Request.Path.Value.StartsWith("/static/");
                    toCache |= context.Context.Request.Path.Value.StartsWith("/prod-");
                    if (toCache)
                    {
                        context.Context.Response.Headers["Cache-Control"] = "private, max-age=31536000";
                        context.Context.Response.Headers["Expires"] = DateTime.UtcNow.AddYears(1).ToString("R");
                    }
                    // For everything coming from "/files/**", disable caching
                    else if (context.Context.Request.Path.Value.StartsWith("/files/"))
                    {
                        context.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                        context.Context.Response.Headers["Pragma"] = "no-cache";
                        context.Context.Response.Headers["Expires"] = "0";
                    }
                    // The rest of the content is served by IndexController, which adds its own cache directive.
                }
            };
            // Static files (JS, CSS etc.) served directly.
            app.UseStaticFiles(sfo);
            // Serve our (single) .cshtml file, and serve API requests.
            app.UseMvc(routes =>
            {
                //routes.MapRoute("api", "api/{controller}/{action}/{*paras}", new { paras = "" });
                //routes.MapRoute("files", "files/{name}", new { controller = "Files", action = "Get" });
                routes.MapRoute("default", "{*paras}", new { controller = "Index", action = "Index", paras = "" });
            });
        }
    }
}
