package server

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"path"
	"regexp"
	"xiep/internal/logic"
)

type resultWrapper struct {
	Result string      `json:"result"`
	Data   interface{} `json:"data"`
}

func handleDocOpen(c *gin.Context) {
	//sessionId := c.Value("sessionId").(string)
	docId, ok := requireParam(c, "docId", false)
	if !ok {
		return
	}
	sessionKey := logic.TheApp.Orchestrator.RequestSession(docId)
	if sessionKey == "" {
		c.String(http.StatusNotFound, "Document not found.")
		return
	}
	sendDocSuccess(c, sessionKey)
}

func handleDocCreate(c *gin.Context) {
	name, ok := requireParam(c, "name", true)
	if !ok {
		return
	}
	if docId, err := logic.TheApp.Orchestrator.CreateDocument(name); err != nil {
		panic(fmt.Sprintf("Failed to create document: %v", err))
	} else {
		sendDocSuccess(c, docId)
	}
}

func handleDocDelete(c *gin.Context) {
	docId, ok := requireParam(c, "docId", true)
	if !ok {
		return
	}
	logic.TheApp.Orchestrator.DeleteDocument(docId)
	sendDocSuccess(c, docId)
}

func handleDocExportDocx(c *gin.Context) {
	docId, ok := requireParam(c, "docId", true)
	if !ok {
		return
	}
	downloadId := logic.TheApp.Orchestrator.ExportDocx(docId)
	if downloadId == "" {
		c.String(http.StatusNotFound, "Document not found.")
		return
	}
	sendDocSuccess(c, downloadId)
}

func handleDocDownload(c *gin.Context) {
	name, ok := requireParam(c, "name", false)
	if !ok {
		return
	}
	var docId string
	if len(name) <= 32 {
		match, _ := regexp.MatchString(`^([a-zA-Z0-9]{7})-[a-zA-Z0-9]{7}\.docx$`, name)
		if match {
			docId = name[:7]
		}
	}
	if docId == "" {
		c.String(http.StatusBadRequest, "We don't serve files like that.")
		return
	}
	filePath := path.Join(config.ExportsFolder, name)
	if _, err := os.Stat(filePath); err != nil {
		c.String(http.StatusNotFound, "File does not exist.")
		return
	}
	fileName := logic.TheApp.Orchestrator.GetDocumentName(docId)
	if fileName == "" {
		fileName = docId
	}
	fileName += ".docx"
	c.Header("Content-Disposition", "attachment; filename="+fileName)
	c.Header("Content-Type", "application/octet-stream")
	c.File(filePath)

}

func sendDocSuccess(c *gin.Context, data string) {
	result := resultWrapper{
		Result: "OK",
		Data:   data,
	}
	c.JSON(http.StatusOK, result)
}
