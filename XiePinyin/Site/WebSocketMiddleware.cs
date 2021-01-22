using System;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;

namespace XiePinyin.Site
{
    internal class WebSocketMiddleware
    {
        WebSocketMiddlewareOptions options;
        ConnectionManager connMgr;

        public WebSocketMiddleware(RequestDelegate next, WebSocketMiddlewareOptions options, ConnectionManager connectionManager)
        {
            this.options = options ?? throw new ArgumentNullException(nameof(options));
            connMgr = connectionManager ?? throw new ArgumentNullException(nameof(connectionManager));
        }

        public async Task Invoke(HttpContext context)
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }
            if (!validateOrigin(context))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
            WebSocketConnection webSocketConnection = new WebSocketConnection(webSocket, options.ReceivePayloadBufferSize);
            connMgr.AddConnection(webSocketConnection);
            await webSocketConnection.ReceiveMessagesUntilCloseAsync();
            if (webSocket.State != WebSocketState.Closed)
                await webSocket.CloseAsync(webSocketConnection.CloseStatus.Value,
                    webSocketConnection.CloseStatusDescription, CancellationToken.None);
            connMgr.RemoveConnection(webSocketConnection.Id);
        }

        bool validateOrigin(HttpContext context)
        {
            return (options.AllowedOrigins == null) ||
                (options.AllowedOrigins.Count == 0) || 
                (options.AllowedOrigins.Contains(context.Request.Headers["Origin"].ToString()));
        }
    }
}
