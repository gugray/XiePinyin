using System;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Serilog;

namespace XiePinyin.Site
{
    public class ErrorHandlerMiddleware
    {
        readonly ILogger logger;
        readonly RequestDelegate next;

        public ErrorHandlerMiddleware(RequestDelegate next, ILogger logger)
        {
            this.logger = logger.ForContext("XieSource", "ErrorHandlerMiddleware");
            this.next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            try { await next(context); }
            catch (Exception ex)
            {
                logger.Error(ex, "Unhandled exception");
                context.Response.ContentType = "text/plain; charset=utf-8";
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                await context.Response.WriteAsync("Unhandled exception. 对不起!");
            }
        }
    }
}
