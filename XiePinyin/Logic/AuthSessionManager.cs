using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Serilog;

namespace XiePinyin.Logic
{
    public class AuthSessionManager
    {
        const int sessionTimeoutMin = 60 * 72;

        readonly Dictionary<string, DateTime> sessions = new Dictionary<string, DateTime>();
        readonly string secretsFileName;
        readonly ILogger logger;

        public AuthSessionManager(string secretsFileName, ILogger logger)
        {
            this.secretsFileName = secretsFileName;
            this.logger = logger;
        }

        public void Login(string secret, out string sessionId, out DateTime sessionExpiryUtc)
        {
            sessionId = null;
            sessionExpiryUtc = DateTime.MinValue;
            lock (sessions)
            {
                HashSet<string> secrets = readSecrets();
                if (!secrets.Contains(secret)) return;
                sessionId = ShortIdGenerator.Next();
                while (sessions.ContainsKey(sessionId)) sessionId = ShortIdGenerator.Next();
                sessionExpiryUtc = DateTime.UtcNow.AddMinutes(sessionTimeoutMin);
                sessions[sessionId] = sessionExpiryUtc;
            }
        }

        public void Logout(string sessionId)
        {
            lock (sessions)
            {
                if (sessions.ContainsKey(sessionId))
                    sessions.Remove(sessionId);
            }
        }

        /// <summary>
        /// Checks if a session is still valid. If yes, returns new expiry. Otherwise, returns DateTime.MinValue.
        /// Extends expiry of still-valid sessions.
        /// </summary>
        public DateTime Check(string sessionId)
        {
            DateTime res = DateTime.MinValue;
            lock (sessions)
            {
                if (!sessions.ContainsKey(sessionId)) return res;
                res = sessions[sessionId];
                res.AddMinutes(sessionTimeoutMin);
                sessions[sessionId] = res;
                return res;
            }
        }

        HashSet<string> readSecrets()
        {
            HashSet<string> res = new HashSet<string>();
            using (StreamReader sr = new StreamReader(secretsFileName))
            {
                string line;
                while ((line = sr.ReadLine()) != null)
                {
                    if (line.Trim() == "" || line.StartsWith("#")) continue;
                    res.Add(line.Trim());
                }
            }
            return res;
        }
    }
}
