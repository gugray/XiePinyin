package logic

import (
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
}

// Initializes the the application logic at startup.
func InitTheApp(config *common.Config, xlog common.XieLogger) {

	TheApp.ASM.init(config.SecretsFile, xlog)
	TheApp.Composer = loadComposerFromFiles("./static")
	TheApp.Orchestrator.init(xlog, TheApp.Composer, config.DocsFolder, config.ExportsFolder)
	TheApp.ConnectionManager.init(xlog, &TheApp.Orchestrator)

	// Hook up orchestrator to connection manager
	TheApp.Orchestrator.startup(&TheApp.ConnectionManager)
}

// Tells long-running background tasks to stop and clean up.
func (app *xieApp) Shutdown() {
	app.Orchestrator.shutdown()
	app.ConnectionManager.shutdown()
	//  TODO: thread through a waitgroup here
	time.Sleep(200 * time.Millisecond)
}
