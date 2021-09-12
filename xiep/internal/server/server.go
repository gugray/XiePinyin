package server

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
var config *common.Config
var baseDomain string

// Initializes the server, sets up middlewares, handlers etc.
func InitServer(r *gin.Engine, logger common.XieLogger, cfg *common.Config) {
	config = cfg
	initInfra(r, logger)
	initContent(r)
	initHandlers(r)
}

func initHandlers(r *gin.Engine) {
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false
	// Login and logout handlers. Logout requires authentication; login does not
	r.POST("/api/auth/login/", handleAuthLogin)
	rAuth := r.Group("/api/auth")
	rAuth.Use(checkAuth)
	rAuth.POST("/logout/", handleAuthLogout)
	// api/doc enpoints
	rDoc := r.Group("/api/doc/")
	rDoc.Use(checkAuth)
	rDoc.GET("/open/", handleDocOpen)
	rDoc.POST("/create/", handleDocCreate)
	rDoc.POST("/delete/", handleDocDelete)
	// api/compose endpoint
	r.GET("/api/compose/", handleCompose)
	// Websocket at /sock
	r.GET("/sock/", handleSock).Use(checkAuth)
}

func initContent(r *gin.Engine) {
	r.Use(addCacheHeaders)
	r.SetFuncMap(template.FuncMap{"appendTimestamp": appendTimestamp})
	r.LoadHTMLFiles("index.tmpl")
	versionStr := determineVersion()
	serveIndex := func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{"Ver": versionStr})
	}
	r.GET("/", serveIndex)
	r.GET("/doc/*id", serveIndex)
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

	if ix := strings.Index(config.BaseUrl, ":"); ix == -1 {
		baseDomain = config.BaseUrl
	} else {
		baseDomain = config.BaseUrl[:ix]
	}
}

func appendTimestamp(p string) (string, error) {
	info, err := os.Stat(path.Join("static", p))
	if err != nil {
		return "", err
	}
	res := p + "?v=" + fmt.Sprintf("%v", info.ModTime().Unix())
	return res, nil
}

func addCacheHeaders(c *gin.Context) {

	reqPath := c.Request.URL.Path
	if reqPath == "/" || strings.HasPrefix(reqPath, "/doc") || strings.HasPrefix(reqPath, "/api") {
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
	var asc authSessionCookie
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

// Retrieves a POST or GET param. If param is not present, sets BadRequest and returns false.
func requireParam(c *gin.Context, paramName string, isPost bool) (val string, ok bool) {
	if isPost {
		val, ok = c.GetPostForm(paramName)
	} else {
		val, ok = c.GetQuery(paramName)
	}
	if !ok {
		c.String(http.StatusBadRequest, "Missing parameter: "+paramName)
		return
	}
	return
}

// Reads version from version.txt if present in working directory, or returns 0.0.0
func determineVersion() string {
	res := "0.0.0"

	if bytes, err := os.ReadFile(common.VersionFileName); err == nil {
		lines := strings.Split(string(bytes), "\n")
		if len(lines) > 0 {
			trimmed := strings.TrimSpace(lines[0])
			if len(trimmed) > 0 {
				res = trimmed
			}
		}
	}
	return res
}
