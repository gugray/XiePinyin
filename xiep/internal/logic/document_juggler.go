package logic

import (
	"os"
	"path"
	"sync"
	"time"
	"xiep/internal/common"
)

const (
	docJugUnloadAfterSeconds          = 7800 // 2:10h; MUST BE GREATER THAN SessionIdleEndSeconds
	docJugSessionRequestExpirySeconds = 10
	docJugSessionIdleEndSeconds       = 7200 // 2h
	docJugSaveFunCycleMsec            = 200
	docJugSaveFunLoopSec              = 2
	docJugExportCleanupLoopSec        = 600
)

type editSession struct {
	// Session's short random key
	SessionKey string
	// ID of document the session is editing
	DocId string
	// Last communication from the session (either change or ping)
	LastActiveUtc time.Time
	// Time the session was requested. Equals DateTime.MinValue once session has started.
	RequestedUtc time.Time
	// This editor's selection, as it applies to the current head text.
	Selection *Selection
}

type documentJuggler struct {
	xlog              common.XieLogger
	mu                sync.Mutex
	composer          *Composer
	docsFolder        string
	exportsFolder     string
	sessions          []*editSession
	docs              []*Document
	exit              chan interface{}
	broadcast         chan<- changeToBroadcast
	terminateSessions chan<- []string
}

func (dj *documentJuggler) init(xlog common.XieLogger,
	composer *Composer,
	docsFolder string,
	exportsFolder string,
) {
	dj.xlog = xlog
	dj.composer = composer
	dj.docsFolder = docsFolder
	dj.exportsFolder = exportsFolder
	dj.exit = make(chan interface{})
	go dj.houseKeep()
}

func (dj *documentJuggler) shutdown() {
	close(dj.exit)
}

func (dj *documentJuggler) houseKeep() {
	for {
		select {
		case <-dj.exit:
			dj.xlog.Logf(common.LogSrcDocJug, "Housekeeping thread exiting")
			return
		}
	}
}

// Assembles full file system path of saved document.
func (dj *documentJuggler) getDocFileName(docId string) string {
	return path.Join(dj.docsFolder, docId+".json")
}

// Gets index of document in loaded array. Returns -1 if not currently loaded.
func (dj *documentJuggler) getDocIx(docId string) int {
	for ix, doc := range dj.docs {
		if doc.DocId == docId {
			return ix
		}
	}
	return -1
}

// Gets index of a session by key. Returns -1 if no such session.
func (dj *documentJuggler) getSessionIx(sessionKey string) int {
	for ix, sess := range dj.sessions {
		if sess.SessionKey == sessionKey {
			return ix
		}
	}
	return -1
}

// Creates new document. Thread-safe.
// Returns error if document could not be created.
func (dj *documentJuggler) CreateDocument(name string) (docId string, err error) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	err = nil
	var docFileName string
	for {
		docId = GetShortId()
		if ix := dj.getDocIx(docId); ix != -1 {
			continue
		}
		docFileName = dj.getDocFileName(docId)
		if _, err := os.Stat(docFileName); err == nil {
			continue
		}
		break
	}
	var doc Document
	doc.Init(docId, name, nil)
	if err = doc.SaveToFile(docFileName); err != nil {
		return
	}
	dj.docs = append(dj.docs, &doc)
	return
}

// Unload document and deletes from disk; destroys existing sessions. Thread-safe.
// If document does not exist, or if it cannot be deleted, logs incident, but returns normally.
func (dj *documentJuggler) DeleteDocument(docId string) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	// Find index of document in docs array (might not be present if not loaded)
	docIx := dj.getDocIx(docId)
	// Remove doc from array, if loaded
	if docIx != -1 {
		dj.docs[docIx] = dj.docs[len(dj.docs)-1]
		dj.docs[len(dj.docs)-1] = nil
		dj.docs = dj.docs[:len(dj.docs)-1]
	}
	// Remove any related sessions
	i := 0
	for _, sess := range dj.sessions {
		if sess.DocId != docId {
			dj.sessions[i] = sess
		}
	}
	dj.sessions = dj.sessions[:i]
	// Delete file
	docFileName := dj.getDocFileName(docId)
	// Try to delete if file seems to exist
	if _, err := os.Stat(docFileName); err != nil {
		// File does not exist: log it, but life can go on
		dj.xlog.Logf(common.LogSrcDocJug, "Document on disk does not seem to exist (no big deal): %v", err)
	} else {
		// File exists: get rid of it
		if err := os.Remove(docFileName); err != nil {
			// If physical delete fails, log error, but otherwise life can go on
			dj.xlog.Logf(common.LogSrcDocJug, "Failed to delete document from disk (no big deal): %v", err)
		}
	}
}

// Loads a doc from disk if it exists but no currently in memory.
// If document does not exist, or cannot be parsed, logs incident and returns normally.
// Must be called from within lock!
func (dj *documentJuggler) ensureLoaded(docId string) {
	docIx := dj.getDocIx(docId)
	if docIx != -1 {
		return
	}
	docFileName := dj.getDocFileName(docId)
	var doc Document
	if err := doc.LoadFromFile(docFileName); err != nil {
		dj.xlog.Logf(common.LogSrcDocJug, "Failed to load document from file: %v", err)
		return
	}
	dj.docs = append(dj.docs, &doc)
}

// Requests a new editing session. Thread-safe.
// Returns new session ID, or zero string if document does not exist.
func (dj *documentJuggler) RequestSession(docId string) (sessionKey string) {

	dj.mu.Lock()
	defer dj.mu.Unlock()

	dj.ensureLoaded(docId)
	if docIx := dj.getDocIx(docId); docIx == -1 {
		return ""
	}
	for {
		sessionKey = "S-" + GetShortId()
		if ix := dj.getSessionIx(sessionKey); ix == -1 {
			break
		}
	}
	sess := editSession{
		DocId:         docId,
		SessionKey:    sessionKey,
		LastActiveUtc: time.Now().UTC(),
		RequestedUtc:  time.Now().UTC(),
	}
	dj.sessions = append(dj.sessions, &sess)

	return sessionKey
}
