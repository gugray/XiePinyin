package site

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"net/url"
)

// login is a handler that parses a form and checks for specific data
func login(c *gin.Context) {

	XieLogf(LogSrcApp, "And a loggin-inna")

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

