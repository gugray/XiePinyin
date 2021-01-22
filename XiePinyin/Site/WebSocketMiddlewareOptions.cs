using System.Collections.Generic;

namespace XiePinyin.Site
{
    internal class WebSocketMiddlewareOptions
    {
        public HashSet<string> AllowedOrigins { get; set; }
        public int? SendSegmentSize { get; set; }
        public int ReceivePayloadBufferSize { get; set; } = 4 * 1024;
    }
}
