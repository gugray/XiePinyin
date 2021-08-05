package main

import (
	"fmt"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"html/template"
	"net/http"
	"os"
	"path"
)

func appendTimestamp(p string) (string, error) {

	info, err := os.Stat(path.Join("static", p))
	if err != nil {
		return "", err
	}
	res := p + "?v=" + fmt.Sprintf("%v", info.ModTime().Unix())
	return res, nil
}

func main() {
	r := gin.Default()

	r.GET("/hello", func(c *gin.Context) {
		c.String(200, "Hello, World!")
	})

	api := r.Group("/api")

	api.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.SetFuncMap(template.FuncMap{"appendTimestamp": appendTimestamp})
	r.LoadHTMLFiles("index.tmpl")
	//r.LoadHTMLGlob("static/*.tmpl")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{"Ver": "1.2.3"})
	})

	r.Use(static.Serve("/", static.LocalFile("./static", true)))

	r.Run()
}
