using System;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.IO;
using System.Text;

namespace XiePinyin.Site
{
    internal class WebSocketConnection
    {
        private WebSocket ws;
        private int rcvBufSize;

        public Guid Id { get; } = Guid.NewGuid();
        public WebSocketCloseStatus? CloseStatus { get; private set; } = null;
        public string CloseStatusDescription { get; private set; } = null;
        public event EventHandler<string> MessageReceived;

        public WebSocketConnection(WebSocket webSocket, int receivePayloadBufferSize)
        {
            ws = webSocket ?? throw new ArgumentNullException(nameof(webSocket));
            rcvBufSize = receivePayloadBufferSize;
        }

        public async Task SendAsync(string message, CancellationToken cancellationToken)
        {
            if (ws.State == WebSocketState.Open)
            {
                byte[] msgBytes = Encoding.UTF8.GetBytes(message);
                ArraySegment<byte> buffer = new ArraySegment<byte>(msgBytes, 0, msgBytes.Length);
                await ws.SendAsync(buffer, WebSocketMessageType.Text, true, cancellationToken);
            }
        }

        public async Task CloseIfNotClosedAsync(string statusDescription)
        {
            if (ws.State != WebSocketState.Closed)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, statusDescription, CancellationToken.None);
        }

        public async Task ReceiveMessagesUntilCloseAsync()
        {
            try
            {
                byte[] receivePayloadBuffer = new byte[rcvBufSize];
                WebSocketReceiveResult webSocketReceiveResult = 
                    await ws.ReceiveAsync(new ArraySegment<byte>(receivePayloadBuffer), CancellationToken.None);
                while (webSocketReceiveResult.MessageType != WebSocketMessageType.Close)
                {
                    byte[] webSocketMessage = await receiveMessagePayloadAsync(webSocketReceiveResult, receivePayloadBuffer);
                    MessageReceived?.Invoke(this, Encoding.UTF8.GetString(webSocketMessage));
                    webSocketReceiveResult =
                        await ws.ReceiveAsync(new ArraySegment<byte>(receivePayloadBuffer), CancellationToken.None);
                }
                CloseStatus = webSocketReceiveResult.CloseStatus.Value;
                CloseStatusDescription = webSocketReceiveResult.CloseStatusDescription;
            }
            catch //(WebSocketException wsex) when (wsex.WebSocketErrorCode == WebSocketError.ConnectionClosedPrematurely)
            { }
        }

        async Task<byte[]> receiveMessagePayloadAsync(WebSocketReceiveResult webSocketReceiveResult, byte[] receivePayloadBuffer)
        {
            byte[] messagePayload = null;
            if (webSocketReceiveResult.EndOfMessage)
            {
                messagePayload = new byte[webSocketReceiveResult.Count];
                Array.Copy(receivePayloadBuffer, messagePayload, webSocketReceiveResult.Count);
                return messagePayload;
            }
            using (MemoryStream messagePayloadStream = new MemoryStream())
            {
                messagePayloadStream.Write(receivePayloadBuffer, 0, webSocketReceiveResult.Count);
                while (!webSocketReceiveResult.EndOfMessage)
                {
                    webSocketReceiveResult =
                        await ws.ReceiveAsync(new ArraySegment<byte>(receivePayloadBuffer), CancellationToken.None);
                    messagePayloadStream.Write(receivePayloadBuffer, 0, webSocketReceiveResult.Count);
                }

                messagePayload = messagePayloadStream.ToArray();
            }
            return messagePayload;
        }
    }
}
