package server

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/url"
	"time"
	"xiep/internal/common"
	"xiep/internal/logic"
)

type authSessionCookie struct {
	ID         string
	ExpiresUtc time.Time
}

// Deserializes auth session cookie object from JSON
func (asc *authSessionCookie) UnmarshalJSON(data []byte) error {
	type envelope struct {
		ID     string `json:"id"`
		Expiry string `json:"expiry"`
	}
	var val envelope
	var err error
	if err = json.Unmarshal(data, &val); err != nil {
		return err
	}
	asc.ID = val.ID
	if asc.ExpiresUtc, err = time.Parse(common.Iso8601Layout, val.Expiry); err != nil {
		return err
	}
	return nil
}

// Serializes auth session cookie object into JSON
func (asc *authSessionCookie) MarshalJSON() ([]byte, error) {
	type envelope struct {
		ID     string `json:"id"`
		Expiry string `json:"expiry"`
	}
	val := envelope{
		ID:     asc.ID,
		Expiry: asc.ExpiresUtc.Format(common.Iso8601Layout),
	}
	return json.Marshal(&val)
}

func handleAuthLogin(c *gin.Context) {

	secret, ok := c.GetPostForm("secret")
	if !ok {
		c.String(http.StatusBadRequest, "Missing parameter: secret")
		return
	}
	var asc authSessionCookie
	asc.ID, asc.ExpiresUtc = logic.TheApp.ASM.Login(secret)
	if len(asc.ID) == 0 {
		c.String(http.StatusUnauthorized, "Bad secret")
		return
	}
	var err error
	var ascJson []byte
	if ascJson, err = asc.MarshalJSON(); err != nil {
		panic(fmt.Sprintf("Failed to serialize session cookie: %v", err))
	}
	cookieDuration := int(asc.ExpiresUtc.Sub(time.Now().UTC()).Seconds())
	if cookieDuration < 0 {
		panic("ASM gave us session expiry in the past")
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     common.AuthCookieName,
		Value:    url.QueryEscape(string(ascJson)),
		MaxAge:   cookieDuration,
		Path:     "/",
		Domain:   baseDomain,
		Secure:   false,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	})
	c.String(http.StatusOK, "welcome")
}

func deleteAuthCookie(writer http.ResponseWriter) {
	http.SetCookie(writer, &http.Cookie{
		Name:     common.AuthCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: false,
	})
}

func handleAuthLogout(c *gin.Context) {
	if sessionId, ok := c.Get(common.SessionIdKey); ok {
		logic.TheApp.ASM.Logout(sessionId.(string))
	}
	deleteAuthCookie(c.Writer)
	c.String(http.StatusOK, "bye")
}
