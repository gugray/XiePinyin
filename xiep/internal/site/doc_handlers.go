package site

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

func boo(c *gin.Context) {
	sessionId := c.Value("sessionId")
	panic("Ouch mama")
	c.JSON(http.StatusOK, gin.H{"sessionId": sessionId})
}

