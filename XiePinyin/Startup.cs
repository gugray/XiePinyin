using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using Serilog;

using XiePinyin.Logic;
using XiePinyin.Site;

namespace XiePinyin
{
    public class Startup
    {
        readonly IWebHostEnvironment env;
        readonly IConfigurationRoot config;
        Broadcaster broadcaster;
        DocumentJuggler docJuggler;
        AuthSessionManager asm;

        public Startup(IWebHostEnvironment env)
        {
            this.env = env;
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
            services.AddSingleton(Log.Logger);

            //services.AddAuthentication(options =>
            //{
            //    options.DefaultScheme= "XieAuthScheme";
            //}).AddScheme<XieAuthenticationSchemeOptions, XieAuthenticationHandler>("XieAuthScheme", op => { });

            services.AddAuthentication("XieAuth").AddScheme<XieAuthenticationSchemeOptions, XieAuthenticationHandler>("XieAuth", null);


            // MVC for serving pages and REST
            services.AddMvc(x => { x.EnableEndpointRouting = true; }).AddRazorRuntimeCompilation();
            // Configuration singleton
            services.AddSingleton<IConfiguration>(sp => { return config; });
            // Input conversion
            var composer = new Composer(config["sourcesFolder"]);
            services.AddSingleton(composer);

            asm = new AuthSessionManager(config["secretsFile"], Log.Logger);
            var dopt = new DocumentJuggler.Options
            {
                DocsFolder = config["docsFolder"],
                ExportsFolder = config["exportsFolder"],
            };
            docJuggler = new DocumentJuggler(dopt, Log.Logger, composer);
            var connMgr = new ConnectionManager(docJuggler, Log.Logger);
            broadcaster = new Broadcaster(connMgr, Log.Logger);
            docJuggler.Broadcaster = broadcaster;

            services.AddSingleton(asm);
            services.AddSingleton(docJuggler);
            services.AddSingleton(connMgr);
            services.AddSingleton(broadcaster);
        }

        public void Configure(IApplicationBuilder app, IHostApplicationLifetime appLife)
        {
            appLife.ApplicationStopping.Register(onAppStopping);
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

            app.UseMiddleware<ErrorHandlerMiddleware>();

            WebSocketMiddlewareOptions wsmo = new Site.WebSocketMiddlewareOptions
            {
                AllowedOrigins = new HashSet<string>(),
                SendSegmentSize = 4 * 1024,
                ReceivePayloadBufferSize = 4 * 1024,
            };
            var wsao = config["webSocketAllowedOrigins"];
            foreach (var x in wsao.Split(',')) wsmo.AllowedOrigins.Add(x.Trim());
            app.UseWebSockets().MapWebSocketConnections("/sock", wsmo);

            app.UseRouting();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllerRoute("api-compose", "api/compose/{*query}", new { controller = "Compose", action = "Get" });
                endpoints.MapControllerRoute("api-doc", "api/doc/{action}/{*paras}", new { controller = "Document", paras = "" });
                endpoints.MapControllerRoute("api-auth", "api/auth/{action}/{*paras}", new { controller = "Auth", paras = "" });
                endpoints.MapControllerRoute("default", "{*paras}", new { controller = "Index", action = "Index", paras = "" });
                //routes.MapRoute("default", "{*paras}", new { controller = "Index", action = "Index", paras = "" });
            });
        }

        private void onAppStopping()
        {
            if (broadcaster != null) broadcaster.Shutdown();
            if (docJuggler != null) docJuggler.Shutdown();
        }
    }
}
