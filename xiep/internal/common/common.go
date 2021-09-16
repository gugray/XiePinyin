package common

// Application configuration, serialized from JSON.
type Config struct {
	SourcesFolder           string
	DocsFolder              string
	ExportsFolder           string
	SecretsFile             string
	LogFile                 string
	ServicePort             uint
	BaseUrl                 string
	WebSocketAllowedOrigin  string
	DebugHacks              bool
}

const (
	EnvVarName          = "XIE_ENV"                  // Set to "prod" in production system
	ConfigVarName       = "CONFIG"                   // If set, will load confi.json from this path and not from DevConfigPath
	DevConfigPath       = "../config.dev.json"       // Path to config.json in development environment
	VersionFileName     = "version.txt"              // Name of option file with app's version, next to executable
	LogSrcApp           = "Xie"                      // Source name for app-level log entries
	LogSrcOrchestrator  = "Orchestrator"             // Source name for log entries by orchestrator
	LogSrcSocketHandler = "SocketHandler"            // Source name for log enries by socket handler
	AuthCookieName      = "xiepauth"                 // Name of authentication (login) cookie sent to client
	LoginTimeoutMinutes = 60 * 72                    // Expiry of login
	Iso8601Layout       = "2006-01-02T15:04:05.999Z" // Format string for ISO8601 timestamps (used in auth cookie)
	SessionIdKey        = "sessionId"                // Key in Gin context for storing session ID
	ShutdownWaitMsec    = 1000                       // Wait max this long for background threads to finish in graceful shutdown
)

// Defines what a logger looks like for this app.
type XieLogger interface {
	Logf(prefix string, format string, v ...interface{})
	LogFatal(prefix string, msg string)
}
