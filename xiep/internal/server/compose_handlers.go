package server

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
	"time"
	"xiep/internal/logic"
)

type composeResult struct {
	PinyinSylls []string `json:"pinyinSylls"`
	Words [][]string `json:"words"`
}

func handleCompose(c *gin.Context) {

	prompt, ok1 := requireParam(c, "prompt", false)
	isSimptStr, ok2 := requireParam(c, "isSimp", false)
	if !ok1 || !ok2 {
		return
	}
	var isSimp bool
	if isSimptStr == "true" {
		isSimp= true
	} else if isSimptStr == "false" {
		isSimp = false
	} else {
		c.String(http.StatusBadRequest, "Wrong value for isSimp parameter; true or false is expected.")
		return
	}

	if config.DebugHacks {
		if strings.HasPrefix(prompt, "a")  {
			time.Sleep(2 * time.Second)
		}
	}

	var cr composeResult
	cr.PinyinSylls, cr.Words = logic.TheApp.Composer.Resolve(prompt, isSimp)
	c.JSON(http.StatusOK, cr)
}
