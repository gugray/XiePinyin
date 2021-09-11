package logic

import (
	"encoding/json"
	"os"
	"path"
	"sync"
	"time"
	"xiep/internal/biscript"
	"xiep/internal/common"
)

const (
	docJugUnloadAfterSeconds          = 7800 // 2:10h; MUST BE GREATER THAN SessionIdleEndSeconds
	docJugSessionRequestExpirySeconds = 10   // If requested session is not started in this time, we purge it
	docJugSessionIdleEndSeconds       = 7200 // 2h; session is purged if idle for this long
	docJugHousekeepPeriodSec          = 2    // Frequency of housekeeping loop
	//docJugExportCleanupLoopSec        = 600  // Frequency of cleanup of exported files waiting for download
)

// Represents the current selection in one active session.
type sessionSelection struct {
	SessionKey   string `json:"sessionKey"`
	Start        int    `json:"start"`
	End          int    `json:"end"`
	CaretAtStart bool   `json:"caretAtStart"`
}

type editSession struct {
	// Session's short random key
	SessionKey string
	// ID of document the session is editing
	DocId string
	// Last communication from the session (either change or ping)
	LastActiveUtc time.Time
	// Time the session was requested. Changes to zero time once session has started.
	RequestedUtc time.Time
	// This editor's selection, as it applies to the current head text.
	Selection *sessionSelection
}

type sessionStartMessage struct {
	Name           string             `json:"name"`
	RevisionId     int                `json:"revisionId"`
	Text           []biscript.XieChar `json:"text"`
	PeerSelections []sessionSelection `json:"peerSelections"`
}

type documentJuggler struct {
	xlog              common.XieLogger
	mu                sync.Mutex
	composer          *composer
	docsFolder        string
	exportsFolder     string
	sessions          []*editSession
	docs              []*Document
	exit              chan interface{}
	broadcast         chan<- changeToBroadcast
	terminateSessions chan<- []string
}

func (dj *documentJuggler) init(xlog common.XieLogger,
	composer *composer,
	docsFolder string,
	exportsFolder string,
) {
	dj.xlog = xlog
	dj.composer = composer
	dj.docsFolder = docsFolder
	dj.exportsFolder = exportsFolder
	dj.exit = make(chan interface{})
	go dj.housekeep()
}

func (dj *documentJuggler) shutdown() {
	close(dj.exit)
}

// Performs periodic housekeeping like saving dirty documents, unloading stale docs, terminating inactive sessions
func (dj *documentJuggler) housekeep() {
	ticker := time.NewTicker(docJugHousekeepPeriodSec * time.Second)
	safeExec := func(f func()) {
		f()
		if r := recover(); r != nil {
			dj.xlog.Logf(common.LogSrcDocJug, "Panic in housekeeping function: %v", r)
		}
	}
	for {
		select {
		case <-ticker.C:
			safeExec(dj.housekeepDocs)
			safeExec(dj.cleanupSessions)
		case <-dj.exit:
			dj.xlog.Logf(common.LogSrcDocJug, "Housekeeping thread exiting")
			ticker.Stop()
			safeExec(dj.housekeepDocs)
			dj.xlog.Logf(common.LogSrcDocJug, "Housekeeping thread finished")
			return
		}
	}
}

// Saves dirty docs and unloads inactive docs.
// Thread-safe.
func (dj *documentJuggler) housekeepDocs() {
	// We break out of closure within loop after each document save
	// This way we release and re-acquire lock, so that other requests can be served between long-ish blocking IO writes
	for finished := false; !finished; {
		func() {
			dj.mu.Lock()
			defer dj.mu.Unlock()

			// Remove docs that have been inactive for long
			// Also remember a dirty document if we see one
			i := 0
			var dirtyDoc *Document
			for _, doc := range dj.docs {
				hasExpired := time.Now().UTC().Sub(doc.LastAccessedUtc).Seconds() > docJugUnloadAfterSeconds
				if !hasExpired {
					dj.docs[i] = doc
					i++
				}
				if doc.Dirty {
					dirtyDoc = doc
				}
			}
			dj.docs = dj.docs[:i]
			// Save the last dirty document that we found
			if dirtyDoc != nil {
				if err := dirtyDoc.SaveToFile(dj.getDocFileName(dirtyDoc.DocId)); err != nil {
					dj.xlog.Logf(common.LogSrcDocJug, "Error saving dirty document %v: %v", dirtyDoc.DocId, err)
				}
			}
			// If we removed a single dirty doc, we continue looping: there may be more
			finished = dirtyDoc == nil
		}()
	}
}

// Unloads inactive and unclaimed sessions; terminates what must be closed.
// Thread-safe.
func (dj *documentJuggler) cleanupSessions() {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	var toTerminate []string // Keys of sessions to terminate
	i := 0
	for _, sess := range dj.sessions {
		unload := false
		// Requested too long ago, and not claimed yet
		if !sess.RequestedUtc.IsZero() &&
			time.Now().UTC().Sub(sess.RequestedUtc).Seconds() > docJugSessionRequestExpirySeconds {
			unload = true
		}
		// Inactive for too long
		if time.Now().UTC().Sub(sess.LastActiveUtc).Seconds() > docJugSessionIdleEndSeconds {
			unload = true
			toTerminate = append(toTerminate, sess.SessionKey)
		}
		if !unload {
			dj.sessions[i] = sess
			i++
		}
	}
	dj.sessions = dj.sessions[:i]
	dj.terminateSessions <- toTerminate
}

// Assembles full file system path of saved document.
// Thread-safe.
func (dj *documentJuggler) getDocFileName(docId string) string {
	return path.Join(dj.docsFolder, docId+".json")
}

// Gets index of document in loaded array. Returns -1 if not currently loaded.
// Must be called from within lock.
func (dj *documentJuggler) getDocIx(docId string) int {
	for ix, doc := range dj.docs {
		if doc.DocId == docId {
			return ix
		}
	}
	return -1
}

// Gets index of a session by key. Returns -1 if no such session.
// Must be called from within lock.
func (dj *documentJuggler) getSessionIx(sessionKey string) int {
	for ix, sess := range dj.sessions {
		if sess.SessionKey == sessionKey {
			return ix
		}
	}
	return -1
}

// Creates new document.
// Returns error if document could not be created.
// Thread-safe.
func (dj *documentJuggler) CreateDocument(name string) (docId string, err error) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	err = nil
	var docFileName string
	for {
		docId = getShortId()
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

// Unload document and deletes from disk; destroys existing sessions.
// If document does not exist, or if it cannot be deleted, logs incident, but returns normally.
// Thread-safe.
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
			i++
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
// Must be called from within lock.
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

// Requests a new editing session.
// Returns new session ID, or zero string if document does not exist.
// Thread-safe.
func (dj *documentJuggler) RequestSession(docId string) (sessionKey string) {

	dj.mu.Lock()
	defer dj.mu.Unlock()

	dj.ensureLoaded(docId)
	if docIx := dj.getDocIx(docId); docIx == -1 {
		return ""
	}
	for {
		sessionKey = "S-" + getShortId()
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

// Retrieves currently known selections in all active sessions.
// Must be called from within lock.
func (dj *documentJuggler) getDocSelections(docId string) []sessionSelection {
	res := make([]sessionSelection, 0, 1)
	for _, sess := range dj.sessions {
		if sess.DocId != docId || sess.Selection == nil {
			continue
		}
		res = append(res, sessionSelection{
			SessionKey: sess.SessionKey,
			Start: sess.Selection.Start,
			End: sess.Selection.End,
			CaretAtStart: sess.Selection.CaretAtStart,
		})
	}
	return res
}

// Starts a new session in response to SESSIONKEY message from socket client
// Thread-safe.
func (dj *documentJuggler) startSession(sessionKey string) (startMsg string) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	startMsg = ""
	sessionIx := dj.getSessionIx(sessionKey)
	if sessionIx == -1 {
		return
	}
	sess := dj.sessions[sessionIx]
	if sess.RequestedUtc.IsZero() {
		return
	}
	docIx := dj.getDocIx(sess.DocId)
	if docIx == -1 {
		return
	}
	doc := dj.docs[docIx]
	ssm := sessionStartMessage{
		Name:           doc.Name,
		RevisionId:     0, // TODO: len(doc.Revisions) - 1
		Text:           doc.HeadText,
		PeerSelections: dj.getDocSelections(doc.DocId),
	}
	sess.RequestedUtc = time.Time{}
	sess.Selection = &sessionSelection{}
	if startStrBytes, err := json.Marshal(&ssm); err == nil {
		startMsg = string(startStrBytes)
	}
	return
}

// Checks whether session with provided key is currently active (exists and has been started).
// Thread-safe.
func (dj *documentJuggler) isSessionOpen(sessionKey string) bool {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	sessionIx := dj.getSessionIx(sessionKey)
	return sessionIx != -1 && dj.sessions[sessionIx].RequestedUtc.IsZero()
}

// Handles a message from a session announced through a CHANGE message.
// Thread-safe.
func (dj *documentJuggler) changeReceived(sessionKey string, clientRevisionId int, selStr, changeStr string) bool {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	
}
