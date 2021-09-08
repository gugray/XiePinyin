package site

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"net/http"
)

// http://arlimus.github.io/articles/gin.and.gorilla/
// https://developpaper.com/golang-gin-framework-with-websocket/

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TO-DO: Bring Config.WebSocketAllowedOrigins here
		return true
	},
}

func handleSock(c *gin.Context) {
	conn, err := wsupgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		panic(fmt.Sprintf("websocket upgrade failed: %v", err))
	}

	for {
		t, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		conn.WriteMessage(t, msg)
	}
}