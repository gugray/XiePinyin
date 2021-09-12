package server

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"net/http"
	"xiep/internal/common"
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

	xlog.Logf(common.LogSrcApp, "Incoming request at socket endpoint; upgrading to websocket")
	conn, err := wsupgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		panic(fmt.Sprintf("websocket upgrade failed: %v", err))
	}
	xlog.Logf(common.LogSrcApp, "Websocket established")
	defer func() {
		err := conn.Close()
		if err != nil {
			xlog.Logf(common.LogSrcSocketHandler, "Error closing socket: %v", err)
		}
	}()

	receive, send, closeConn := logic.TheApp.ConnectionManager.NewConnection(c.ClientIP())

	// Spawn separate goroutine for listening
	go func() {
		defer func() {
			if r := recover(); r != nil {
				xlog.Logf(common.LogSrcSocketHandler, "Panic while processing message: %v", r)
				conn.Close()
			}
		}()
		for {
			t, msg, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsCloseError(err, 1000, 1001, 1005) {
					xlog.Logf(common.LogSrcSocketHandler, "Socket closing with expected code: %v", err)
				} else {
					xlog.Logf(common.LogSrcSocketHandler, "Error reading from socket: %v", err)
				}
				// On any read error we indicate socket closure to connection manager
				receive(nil)
				break
			}
			if t != websocket.TextMessage {
				xlog.Logf(common.LogSrcSocketHandler, "Received message type %v on socket; only text messages expected", t)
				closeConn<- "Protocol violation: only text messages allowed"
				break
			}
			msgStr := string(msg)
			receive(&msgStr)
		}
	}()
	for {
		select {
		case msg := <-send:
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
				xlog.Logf(common.LogSrcSocketHandler, "Error writing to socket: %v", err)
				break
			}
		case msg := <-closeConn:
			if err := conn.WriteMessage(websocket.CloseMessage, []byte(msg)); err != nil {
				xlog.Logf(common.LogSrcSocketHandler, "Error sending close message to socket: %v", err)
			}
			break
		}
	}
}
