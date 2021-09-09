package site

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"net/http"
	"xiep/internal/logic"
)

// http://arlimus.github.io/articles/gin.and.gorilla/
// https://developpaper.com/golang-gin-framework-with-websocket/

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Bring Config.WebSocketAllowedOrigins here
		return true
	},
}

func handleSock(c *gin.Context) {
	conn, err := wsupgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		panic(fmt.Sprintf("websocket upgrade failed: %v", err))
	}

	receive, send, closeConn := logic.TheApp.ConnectionManager.NewConnection(c.ClientIP())

	defer conn.Close()
	defer close(receive)

	// Spawn separate goroutine for listening
	go func() {
		for {
			t, msg, err := conn.ReadMessage()
			if err != nil {
				// Log
				break
			}
			if t != websocket.TextMessage {
				// Log
				break
			}
			receive <- string(msg)
		}
	}()
	for {
		select {
		case msg := <-closeConn:
			if err := conn.WriteMessage(websocket.CloseMessage, []byte(msg)); err != nil {
				// Log
			}
			break
		case msg := <-send:
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
				// Log
				break
			}
		}
	}
}
