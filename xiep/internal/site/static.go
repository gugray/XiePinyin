package site

// Copied brazenly from https://github.com/gin-contrib/static/blob/master/static.go
// So we can add headers like Cache-Control

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

const INDEX = "index.html"

type ServeFileSystem interface {
	http.FileSystem
	Exists(prefix string, path string) bool
}

type localFileSystem struct {
	http.FileSystem
	root    string
	indexes bool
}

func localFile(root string, indexes bool) *localFileSystem {
	return &localFileSystem{
		FileSystem: gin.Dir(root, indexes),
		root:       root,
		indexes:    indexes,
	}
}

func (l *localFileSystem) Exists(prefix string, filepath string) bool {
	if p := strings.TrimPrefix(filepath, prefix); len(p) < len(filepath) {
		name := path.Join(l.root, p)
		stats, err := os.Stat(name)
		if err != nil {
			return false
		}
		if stats.IsDir() {
			if !l.indexes {
				index := path.Join(name, INDEX)
				_, err := os.Stat(index)
				if err != nil {
					return false
				}
			}
		}
		return true
	}
	return false
}

func serveRoot(urlPrefix, root string) gin.HandlerFunc {
	return serveStatic(urlPrefix, localFile(root, false))
}

// ServeStatic returns a middleware handler that serves static files in the given directory.
func serveStatic(urlPrefix string, fs ServeFileSystem) gin.HandlerFunc {
	fileserver := http.FileServer(fs)
	if urlPrefix != "" {
		fileserver = http.StripPrefix(urlPrefix, fileserver)
	}
	return func(c *gin.Context) {
		if fs.Exists(urlPrefix, c.Request.URL.Path) {
			c.Header("Cache-Control", "private, max-age=31536000")
			c.Header("Expires", time.Now().AddDate(1, 0, 0).Format(time.RFC1123))
			fileserver.ServeHTTP(c.Writer, c.Request)
			c.Abort()
		}
	}
}