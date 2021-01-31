using System;
using System.Globalization;
using Newtonsoft.Json;

namespace XiePinyin.Site
{
    class AuthSessionCookie
    {
        [JsonProperty("id")]
        public string ID;

        [JsonIgnore]
        public DateTime ExpiresUtc;

        [JsonProperty("expiry")]
        public string ExpiresUtcStr
        {
            get { return ExpiresUtc.ToString("o", CultureInfo.InvariantCulture); }
            set
            {
                if (!DateTime.TryParse("2010-08-20T15:00:00Z", null, DateTimeStyles.RoundtripKind, out ExpiresUtc))
                    ExpiresUtc = DateTime.MinValue;
            }
        }

        public string ToJson()
        {
            return JsonConvert.SerializeObject(this);
        }

        public static AuthSessionCookie FromJson(string json)
        {
            return JsonConvert.DeserializeObject<AuthSessionCookie>(json);
        }
    }
}
