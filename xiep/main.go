package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
	"xiep/internal/site"
)

var config site.Config
var isProd = false
var logFile *os.File

func main() {

	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)
	initEnv()
	addStr := ":" + strconv.FormatUint(uint64(config.ServicePort), 10)

	r := gin.New()
	var  logOutput io.Writer
	if isProd {
		logOutput = logFile
		gin.SetMode(gin.ReleaseMode)
	} else {
		mw := io.MultiWriter(os.Stdout, logFile)
		logOutput = mw
	}
	log.SetOutput(logOutput)
	gin.DefaultWriter = ginWriter{}

	site.InitInfra(r)
	site.InitHandlers(r)
	site.InitContent(r)

	srv := &http.Server{
		Addr:    addStr,
		Handler: r,
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			msg := fmt.Sprintf("Server encountered a fatal error: %v", err)
			site.XieLogFatal(site.LogSrcApp, msg)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with a timeout
	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	site.XieLogf(site.LogSrcApp, "Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		msg := fmt.Sprintf("Server forced to shut down: %v", err)
		site.XieLogFatal(site.LogSrcApp, msg)
	}
	site.XieLogf(site.LogSrcApp, "Server exiting")
}

func initEnv() {
	if envName := strings.ToLower(os.Getenv(site.EnvVarName)); envName == "prod" {
		isProd = true
	}
	cfgPath := os.Getenv(site.ConfigVarName)
	if len(cfgPath) == 0 {
		cfgPath = site.DevConfigPath
	}
	cfgJson, err := ioutil.ReadFile(cfgPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := json.Unmarshal(cfgJson, &config); err != nil {
		log.Fatal(err)
	}
	logFile, err = os.OpenFile(config.LogFile, os.O_CREATE | os.O_APPEND | os.O_RDWR, 0666)
	if err != nil {
		log.Fatal(err)
	}
}

type ginWriter struct{}

func (_ ginWriter) Write(data []byte) (n int, err error) {
	msg := string(data)
	if strings.HasSuffix(msg, "\n") {
		msg = strings.TrimSuffix(msg, "\n")
	}
	site.XieLogf("Gin", msg)
	return len(data), nil
}
