package logic

import (
	"time"
	"xiep/internal/common"
)

var TheApp XieApp

type XieApp struct {
	ASM AuthSessionManager
	Composer        *Composer
	DocumentJuggler DocumentJuggler
}

func InitTheApp(config *common.Config, xlog common.XieLogger) {
	TheApp.ASM.Init(config.SecretsFile, xlog)
	TheApp.Composer = LoadComposerFromFiles("./static")
	TheApp.DocumentJuggler.Init(xlog, TheApp.Composer, config.DocsFolder, config.ExportsFolder)
}

func (app *XieApp) Shutdown() {
	app.DocumentJuggler.Shutdown()
	time.Sleep(200*time.Millisecond)
}