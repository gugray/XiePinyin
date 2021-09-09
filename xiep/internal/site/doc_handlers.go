package site

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"xiep/internal/logic"
)

type resultWrapper struct {
	Result string      `json:"result"`
	Data   interface{} `json:"data"`
}

func handleDocOpen(c *gin.Context) {
	//sessionId := c.Value("sessionId").(string)
	docId, ok := requirePostParam(c, "docId")
	if !ok {
		return
	}
	sessionKey := logic.TheApp.DocumentJuggler.RequestSession(docId)
	if sessionKey == "" {
		c.String(http.StatusNotFound, "Document not found.")
		return
	}
	sendDocSuccess(c, sessionKey)
}

func handleDocCreate(c *gin.Context) {
	name, ok := requirePostParam(c, "name")
	if !ok {
		return
	}
	if docId, err := logic.TheApp.DocumentJuggler.CreateDocument(name); err != nil {
		panic(fmt.Sprintf("Failed to create document: %v", err))
	} else {
		sendDocSuccess(c, docId)
	}
}

func handleDocDelete(c *gin.Context) {
	docId, ok := requirePostParam(c, "docId")
	if !ok {
		return
	}
	logic.TheApp.DocumentJuggler.DeleteDocument(docId)
	sendDocSuccess(c, docId)
}

func sendDocSuccess(c *gin.Context, data string) {
	result := resultWrapper{
		Result: "OK",
		Data:   data,
	}
	c.JSON(http.StatusOK, result)
}
