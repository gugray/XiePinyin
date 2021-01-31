using System;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using XiePinyin.Logic;

namespace XiePinyin.Site
{

    public class XieAuthenticationSchemeOptions : AuthenticationSchemeOptions
    { }

    public class XieAuthenticationHandler : AuthenticationHandler<XieAuthenticationSchemeOptions>
    {
        readonly AuthSessionManager asm;
    
        public XieAuthenticationHandler(IOptionsMonitor<XieAuthenticationSchemeOptions> options,
            ILoggerFactory logger, UrlEncoder encoder, ISystemClock clock, AuthSessionManager asm)
            : base(options, logger, encoder, clock)
        {
            this.asm = asm;
        }

        private Task<AuthenticateResult> fail(string message)
        {
            Response.Cookies.Delete(AuthController.AuthCookieName);
            return Task.FromResult(AuthenticateResult.Fail(message));
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            string authCookieJson = Request.Cookies[AuthController.AuthCookieName];
            if (authCookieJson == null)
                return fail("No authentication cookie.");
            AuthSessionCookie asc = null;
            try { asc = AuthSessionCookie.FromJson(authCookieJson); }
            catch { }
            if (asc == null)
                return fail("Invalid authentication cookie.");
            asc.ExpiresUtc = asm.Check(asc.ID);
            if (asc.ExpiresUtc == DateTime.MinValue)
                return fail("Session expired.");

            var copt = new CookieOptions
            {
                Expires = new DateTimeOffset(asc.ExpiresUtc),
                HttpOnly = false,
                IsEssential = true,
                SameSite = SameSiteMode.Lax,
            };
            Response.Cookies.Append(AuthController.AuthCookieName, asc.ToJson(), copt);
            var claims = new[]
            {
                new Claim("SessionId", asc.ID),
            };

            var claimsIdentity = new ClaimsIdentity(claims, nameof(XieAuthenticationHandler));
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(claimsIdentity), Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
