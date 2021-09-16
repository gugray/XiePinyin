package logic

import (
	"sync"
	"time"
	"xiep/internal/common"
)

// Singleton holding the application logic behind the web server.
var TheApp xieApp

type xieApp struct {
	ASM               authSessionManager
	Composer          *composer
	Orchestrator      orchestrator
	ConnectionManager connectionManager
	wgShutdown        sync.WaitGroup
	xlog              common.XieLogger
}

// Initializes the the application logic at startup.
func InitTheApp(config *common.Config, xlog common.XieLogger) {

	TheApp.xlog = xlog

	TheApp.ASM.init(config.SecretsFile, xlog)
	TheApp.Composer = loadComposerFromFiles("./static")
	TheApp.Orchestrator.init(xlog, &TheApp.wgShutdown, TheApp.Composer, config.DocsFolder, config.ExportsFolder)
	TheApp.ConnectionManager.init(xlog, &TheApp.wgShutdown, &TheApp.Orchestrator)

	// Hook up orchestrator to connection manager
	TheApp.Orchestrator.startup(&TheApp.ConnectionManager)
}

func (app *xieApp) Shutdown() {
	app.wgShutdown.Add(2);
	app.Orchestrator.shutdown()
	app.ConnectionManager.shutdown()

	// Wait for shutdown to complete, but no forever
	done := make(chan struct{})
	go func() {
		app.wgShutdown.Wait()
		done <- struct{}{}
	}()
	timer := time.NewTimer(common.ShutdownWaitMsec * time.Millisecond)
	select {
	case <-timer.C:
		app.xlog.Logf(common.LogSrcApp, "Background threads didn't finish in %v msec; quitting anyway", common.ShutdownWaitMsec)
	case <-done:
		app.xlog.Logf(common.LogSrcApp, "Background threads finished gracefully")
	}
}
