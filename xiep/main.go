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
	"xiep/internal/common"
	"xiep/internal/logic"
	"xiep/internal/server"
)

var config common.Config
var isProd = false
var logFile *os.File
var xlog XieSiteLogger

//var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to file")

func main() {

	//flag.Parse()
	//if *cpuprofile != "" {
	//	f, err := os.Create(*cpuprofile)
	//	if err != nil {
	//		log.Fatal(err)
	//	}
	//	pprof.StartCPUProfile(f)
	//	defer pprof.StopCPUProfile()
	//}

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

	logic.InitTheApp(&config, xlog)
	server.InitServer(r, xlog, &config)

	srv := &http.Server{
		Addr:    addStr,
		Handler: r,
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			msg := fmt.Sprintf("Server encountered a fatal error: %v", err)
			xlog.LogFatal(common.LogSrcApp, msg)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with a timeout
	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	xlog.Logf(common.LogSrcApp, "Shutting down server gracefully")
	ctx1, cancel1 := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel1()
	if err := srv.Shutdown(ctx1); err != nil {
		msg := fmt.Sprintf("Server failed to shut down: %v", err)
		xlog.LogFatal(common.LogSrcApp, msg)
	}
	xlog.Logf(common.LogSrcApp, "Shutting down background processes and cleaning up")
	logic.TheApp.Shutdown()
	xlog.Logf(common.LogSrcApp, "Goodbye.")
}

func initEnv() {
	if envName := strings.ToLower(os.Getenv(common.EnvVarName)); envName == "prod" {
		isProd = true
	}
	cfgPath := os.Getenv(common.ConfigVarName)
	if len(cfgPath) == 0 {
		cfgPath = common.DevConfigPath
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
	xlog.Logf("Gin", msg)
	return len(data), nil
}


type XieSiteLogger struct {}

func (XieSiteLogger) Logf(prefix string, format string, v ...interface{}) {
	var msg string
	if v != nil {
		msg = fmt.Sprintf(format, v...)
	} else {
		msg = format
	}
	msg = fmt.Sprintf("[%s] %s\n", prefix, msg)
	log.Printf(msg)
}

func (XieSiteLogger) LogFatal(prefix string, msg string) {
	msg = fmt.Sprintf("[%s] %s\n", prefix, msg)
	log.Fatal(msg)
}

