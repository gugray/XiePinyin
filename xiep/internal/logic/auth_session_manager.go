package logic

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
	"xiep/internal/common"
)

type authSessionManager struct {
	secretsFileName string
	xlog common.XieLogger
	mu sync.Mutex
	sessions map[string]time.Time
}

func (asm *authSessionManager) init(secretsFileName string, xlog common.XieLogger) {
	asm.secretsFileName = secretsFileName
	asm.xlog = xlog
	asm.sessions = make(map[string]time.Time)
}

// Logout removes the session identified by the provided ID.
// Has no effect, but does not fail, if such a session does not exist.
func (asm *authSessionManager) Logout(sessionId string) {
	asm.mu.Lock()
	defer asm.mu.Unlock()
	delete(asm.sessions, sessionId)
}

// Login checks if the provided secret is valid, and if yes, creates a new session.
// On success, it returns the new session ID and the session's expiry in UTC.
// If the secret is wrong, zero values are returned.
func (asm *authSessionManager) Login(secret string) (sessionId string, expiryUtc time.Time) {
	secrets := asm.readSecrets()
	if _, ok := secrets[secret]; !ok {
		return
	}
	asm.mu.Lock()
	defer asm.mu.Unlock()
	sessionId = getShortId()
	for {
		if _, ok := asm.sessions[sessionId]; ok {
			sessionId = getShortId()
		} else {
			break
		}
	}
	expiryUtc = time.Now().UTC().Add(common.SessionTimeoutMinutes * time.Minute)
	asm.sessions[sessionId] = expiryUtc
	return
}

// Check checks if a session exists, and is still valid.
// If yes, it returns new expiry; otherwise, it returns zero time.
// It extends expiry of still-valid sessions.
func (asm *authSessionManager) Check(sessionId string) time.Time {
	asm.mu.Lock()
	defer asm.mu.Unlock()
	if expiry, ok := asm.sessions[sessionId]; !ok {
		return time.Time{}
	} else {
		utcNow := time.Now().UTC()
		if utcNow.After(expiry) {
			delete(asm.sessions, sessionId)
			return time.Time{}
		}
		res := utcNow.Add(common.SessionTimeoutMinutes * time.Minute)
		asm.sessions[sessionId] = res
		return res
	}
}

func (asm *authSessionManager) readSecrets() map[string]bool {
	file, err := os.Open(asm.secretsFileName)
	if err != nil {
		panic(fmt.Sprintf("failed to open secrets file: %v", err))
	}
	//goland:noinspection GoUnhandledErrorResult
	defer file.Close()
	res := make(map[string]bool)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) == 0 || strings.HasPrefix(line, "#") {
			continue
		}
		res[line] = true
	}
	if err := scanner.Err(); err != nil {
		panic(fmt.Sprintf("failed to read secrets file: %v", err))
	}
	return res
}