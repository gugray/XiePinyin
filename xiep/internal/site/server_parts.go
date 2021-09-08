package site

import (
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"html/template"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
	"xiep/internal/common"
	"xiep/internal/logic"
)

var xlog common.XieLogger

func Init(r *gin.Engine, logger common.XieLogger) {
	initInfra(r, logger);
	initContent(r)
	initHandlers(r)
}

func AppendTimestamp(p string) (string, error) {
	info, err := os.Stat(path.Join("static", p))
	if err != nil {
		return "", err
	}
	res := p + "?v=" + fmt.Sprintf("%v", info.ModTime().Unix())
	return res, nil
}

func initHandlers(r *gin.Engine) {
	// Login and logout handlers. Logout requires authentication; login does not
	r.POST("/api/auth/login", handleAuthLogin)
	rAuth := r.Group("/api/auth")
	rAuth.Use(checkAuth)
	rAuth.POST("/logout", handleAuthLogout)
	// api/doc enpoints
	rDoc := r.Group("/api/doc")
	rDoc.Use(checkAuth)
	rDoc.GET("/open", handleDocOpen)
	rDoc.POST("/create", handleDocCreate)
	rDoc.POST("/delete", handleDocDelete)
	// Websocket at /sock
	rSock := r.GET("/sock", handleSock)
	rSock.Use(checkAuth)
}

func initContent(r *gin.Engine) {
	r.Use(addCacheHeaders)
	r.SetFuncMap(template.FuncMap{"appendTimestamp": AppendTimestamp})
	r.LoadHTMLFiles("index.tmpl")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{"Ver": "1.2.3"})
	})
	r.Use(static.Serve("/", static.LocalFile("./static", true)))
}

func initInfra(r *gin.Engine, logger common.XieLogger) {

	xlog = logger

	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		msg := fmt.Sprintf("%d %s %s %s %s",
			//param.TimeStamp.Format("2006/01/02 15:04:05.000"),
			param.StatusCode,
			param.ClientIP,
			param.Method,
			param.Path,
			param.Latency,
		)
		return msg
	}))

	r.Use(gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		msg := fmt.Sprintf("panic in handler for %s: %v", c.FullPath(), recovered)
		for _, hn := range c.HandlerNames() {
			msg += "\n -> " + hn
		}
		xlog.Logf(common.LogSrcApp, msg)
		c.String(http.StatusInternalServerError, "internal server error")
		c.AbortWithStatus(http.StatusInternalServerError)
	}))
}

func addCacheHeaders(c *gin.Context) {

	path := c.Request.URL.Path;
	if path == "/" || strings.HasPrefix(path, "/doc") {
		// No chaching for API and index files
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate	")
		c.Header("Expires", "0")
		c.Header("Pragma", "no-cache")
	} else {
		// Cache static files (everything else)
		c.Header("Cache-Control", "private, max-age=31536000")
		c.Header("Expires", time.Now().AddDate(1, 0, 0).Format(time.RFC1123))
	}

}

func checkAuth(c *gin.Context) {

	fail := func(msg string) {
		//c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		deleteAuthCookie(c.Writer)
		c.String(http.StatusUnauthorized, msg)
		c.Abort()
	}

	cookie, err := c.Request.Cookie(common.AuthCookieName)
	if err != nil {
		fail("missing cookie")
		return
	}
	cookieVal, err := url.QueryUnescape(cookie.Value)
	if err != nil {
		fail("cannot query-unescape cookie value")
		return
	}
	var asc AuthSessionCookie
	if err := asc.UnmarshalJSON([]byte(cookieVal)); err != nil {
		fail("cannot parse json in cookie")
		return
	}
	expiry := logic.TheApp.ASM.Check(asc.ID)
	if expiry.IsZero() {
		fail("session expired")
		return
	}
	c.Set(common.SessionIdKey, asc.ID)
	c.Next()
}
