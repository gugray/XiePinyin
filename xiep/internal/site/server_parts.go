package site

import (
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
)

type Config struct {
	SourcesFolder string
	DocsFolder string
	ExportsFolder string
	SecretsFile string
	LogFile string
	ServicePort uint
	BaseUrl string
	WebSocketAllowedOrigins string
}

const (
	EnvVarName     = "XIE_ENV"
	ConfigVarName  = "CONFIG"
	DevConfigPath  = "../config.dev.json"
	LogSrcApp      = "Xie"
	authCookieName = "xiepauth"
	baseurl        = "localhost"
)

func XieLogf(prefix string, format string, v ...interface{}) {
	var msg string
	if v != nil {
		msg = fmt.Sprintf(format, v)
	} else {
		msg = format
	}
	msg = fmt.Sprintf("[%s] %s\n", prefix, msg)
	log.Printf(msg)
}

func XieLogFatal(prefix string, msg string) {
	msg = fmt.Sprintf("[%s] %s\n", prefix, msg)
	log.Fatal(msg)
}

func AppendTimestamp(p string) (string, error) {
	info, err := os.Stat(path.Join("static", p))
	if err != nil {
		return "", err
	}
	res := p + "?v=" + fmt.Sprintf("%v", info.ModTime().Unix())
	return res, nil
}

func InitHandlers(r *gin.Engine) {
	// Login and logout handlers
	r.GET("/api/auth/login", login)
	r.GET("/api/auth/logout", logout)
	// api/doc enpoints
	rDoc := r.Group("/api/doc")
	rDoc.Use(checkAuth)
	rDoc.GET("/boo", boo)
}

func InitContent(r *gin.Engine) {
	r.SetFuncMap(template.FuncMap{"appendTimestamp": AppendTimestamp})
	r.LoadHTMLFiles("index.tmpl")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{"Ver": "1.2.3"})
	})
	r.Use(static.Serve("/", static.LocalFile("./static", true)))
}

func InitInfra(r *gin.Engine) {

	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		msg := fmt.Sprintf("%s %s %s %d %s",
			//param.TimeStamp.Format("2006/01/02 15:04:05.000"),
			param.ClientIP,
			param.Method,
			param.Path,
			param.StatusCode,
			param.Latency,
		)
		return msg
	}))

	r.Use(gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		msg := fmt.Sprintf("panic in handler for %s: %v", c.FullPath(), recovered)
		for _, hn := range c.HandlerNames() {
			msg += "\n -> " + hn
		}
		XieLogf(LogSrcApp, msg)
		c.String(http.StatusInternalServerError, "internal server error")
		c.AbortWithStatus(http.StatusInternalServerError)
	}))
}

func checkAuth(c *gin.Context) {
	cookie, err := c.Request.Cookie(authCookieName)
	if err != nil {
		c.Data(http.StatusUnauthorized, "text/html; charset=utf-8", []byte("access denied"))
		c.Abort()
		//c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	val, _ := url.QueryUnescape(cookie.Value)
	c.Set("sessionId", val)
	// Continue down the chain to handler etc
	c.Next()
}
