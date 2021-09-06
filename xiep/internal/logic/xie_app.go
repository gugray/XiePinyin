package logic

import "xiep/internal/common"

var TheApp XieApp

type XieApp struct {
	ASM AuthSessionManager
}

func InitTheApp(config *common.Config, xlog common.XieLogger) {
	TheApp.ASM.Init(config.SecretsFile, xlog)
}
