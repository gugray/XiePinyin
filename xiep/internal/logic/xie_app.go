package logic

import (
	"time"
	"xiep/internal/common"
)

// Singleton holding the application logic behind the web server.
var TheApp xieApp

type xieApp struct {
	ASM               authSessionManager
	Composer          *Composer
	DocumentJuggler   documentJuggler
	ConnectionManager connectionManager
}

// Initializes the the application logic at startup.
func InitTheApp(config *common.Config, xlog common.XieLogger) {

	TheApp.ASM.init(config.SecretsFile, xlog)
	TheApp.Composer = LoadComposerFromFiles("./static")
	TheApp.DocumentJuggler.init(xlog, TheApp.Composer, config.DocsFolder, config.ExportsFolder)
	TheApp.ConnectionManager.init(xlog, &TheApp.DocumentJuggler)

	// Hook up the channels through which Doc Juggler sends to socket connected peers
	broadcast, terminateSessions := TheApp.ConnectionManager.getListenerChannels()
	TheApp.DocumentJuggler.broadcast = broadcast
	TheApp.DocumentJuggler.terminateSessions = terminateSessions
}

// Tells long-running background tasks to stop and clean up.
func (app *xieApp) Shutdown() {
	app.DocumentJuggler.shutdown()
	time.Sleep(200 * time.Millisecond)
}
