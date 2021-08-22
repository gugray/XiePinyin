package main

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

const (
	authCookieName = "xiepauth"
	baseurl        = "localhost"
)

func appendTimestamp(p string) (string, error) {

	info, err := os.Stat(path.Join("static", p))
	if err != nil {
		return "", err
	}
	res := p + "?v=" + fmt.Sprintf("%v", info.ModTime().Unix())
	return res, nil
}

func main() {
	r := gin.New()
	r.GET("/api/auth/login", login)
	r.GET("/api/auth/logout", logout)

	rDoc := r.Group("/api/doc")
	rDoc.Use(checkAuth)
	rDoc.GET("/boo", boo)

	r.Use(gin.Logger())
	r.SetFuncMap(template.FuncMap{"appendTimestamp": appendTimestamp})
	r.LoadHTMLFiles("index.tmpl")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{"Ver": "1.2.3"})
	})
	r.Use(static.Serve("/", static.LocalFile("./static", true)))

	if err := r.Run(); err != nil {
		log.Fatal("Failed to start:", err)
	}
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

// login is a handler that parses a form and checks for specific data
func login(c *gin.Context) {

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    url.QueryEscape("{barf}"),
		MaxAge:   60 * 60,
		Path:     "/",
		Domain:   baseurl,
		Secure:   false,
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
	})
}

func logout(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: false,
	})
}

func boo(c *gin.Context) {
	sessionId := c.Value("sessionId")
	c.JSON(http.StatusOK, gin.H{"sessionId": sessionId})
}
