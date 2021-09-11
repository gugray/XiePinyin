package common

type Config struct {
	SourcesFolder           string
	DocsFolder              string
	ExportsFolder           string
	SecretsFile             string
	LogFile                 string
	ServicePort             uint
	BaseUrl                 string
	WebSocketAllowedOrigins string
}

const (
	EnvVarName          = "XIE_ENV"
	ConfigVarName       = "CONFIG"
	DevConfigPath       = "../config.dev.json"
	LogSrcApp           = "Xie"
	LogSrcDocJug        = "DocJug"
	LogSrcSocketHandler = "SocketHandler"
	AuthCookieName      = "xiepauth"
	LoginTimeoutMinutes = 60 * 72
	Iso8601Layout       = "2006-01-02T15:04:05.999Z"
	SessionIdKey        = "sessionId"
)

type XieLogger interface {
	Logf(prefix string, format string, v ...interface{})
	LogFatal(prefix string, msg string)
}
