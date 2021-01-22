using System;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Builder;

namespace XiePinyin.Site
{
    internal static class WebSocketMiddlewareExtensions
    {
        public static IApplicationBuilder MapWebSocketConnections(this IApplicationBuilder app, 
            PathString pathMatch, WebSocketMiddlewareOptions options)
        {
            if (app == null) throw new ArgumentNullException(nameof(app));
            return app.Map(pathMatch, branchedApp => branchedApp.UseMiddleware<WebSocketMiddleware>(options));
        }
    }
}
