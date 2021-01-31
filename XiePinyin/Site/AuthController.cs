using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System;
using System.Linq;

using XiePinyin.Logic;

namespace XiePinyin.Site
{
    public class AuthController : Controller
    {
        const string authCookieName = "xieauth";

        readonly AuthSessionManager asm;
        
        public static string AuthCookieName
        {
            get { return authCookieName; }
        }

        public AuthController(AuthSessionManager asm)
        {
            this.asm = asm;
        }

        [HttpPost]
        public IActionResult Login([FromForm] string secret)
        {
            AuthSessionCookie asc = new AuthSessionCookie();
            asm.Login(secret, out asc.ID, out asc.ExpiresUtc);
            if (asc.ID == null) return StatusCode(401, "Your secret is wrong.");
            var copt = new CookieOptions
            {
                Expires = new DateTimeOffset(asc.ExpiresUtc),
                HttpOnly = false,
                IsEssential = true,
                SameSite = SameSiteMode.Lax,
            };
            Response.Cookies.Append(authCookieName, asc.ToJson(), copt);
            return StatusCode(200, "OK");
        }


        [HttpPost]
        [Authorize(AuthenticationSchemes = "XieAuth")]
        public IActionResult Logout()
        {
            var sessionId = User.Claims.FirstOrDefault(x => x.Type == "SessionId");
            if (sessionId != null) asm.Logout(sessionId.Value);
            Response.Cookies.Delete(authCookieName);
            return StatusCode(200, "OK");
        }
    }
}
