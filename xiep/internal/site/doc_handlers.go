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
	sessionId := c.Value("sessionId").(string)
	sendDocSuccess(c, sessionId)
}

func handleDocCreate(c *gin.Context) {
	name, ok := c.GetPostForm("name")
	if !ok {
		c.String(http.StatusBadRequest, "Missing parameter: name")
		return
	}
	if docId, err := logic.TheApp.DocumentJuggler.CreateDocument(name); err != nil {
		panic(fmt.Sprintf("Failed to create document: %v", err))
	} else {
		sendDocSuccess(c, docId)
	}
}

func handleDocDelete(c *gin.Context) {

}

func sendDocSuccess(c *gin.Context, data string) {
	result := resultWrapper{
		Result: "OK",
		Data:   data,
	}
	c.JSON(http.StatusOK, result)
}
