package logic

import (
	"encoding/json"
	"fmt"
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
	Start        uint   `json:"start"`
	End          uint   `json:"end"`
	CaretAtStart bool   `json:"caretAtStart"`
}

// Represents one currently active edit session. Belongs to a client connected over an open socket.
type editSession struct {
	// Session's short random key
	sessionKey string

	// ID of document the session is editing
	docId string

	// Last communication from the session (either change or ping)
	lastActiveUtc time.Time

	// Time the session was requested. Changes to zero time once session has started.
	requestedUtc time.Time

	// This editor's selection, as it applies to the current head text.
	selection *sessionSelection
}

type sessionStartMessage struct {
	Name           string             `json:"name"`
	RevisionId     int                `json:"revisionId"`
	Text           []biscript.XieChar `json:"text"`
	PeerSelections []sessionSelection `json:"peerSelections"`
}

type orchestrator struct {
	xlog              common.XieLogger
	composer          *composer
	docsFolder        string
	exportsFolder     string
	exit              chan interface{}
	broadcast         chan<- *changeToBroadcast
	terminateSessions chan<- map[string]bool

	mu       sync.Mutex
	docs     []*document
	sessions []*editSession
}

func (dj *orchestrator) init(xlog common.XieLogger,
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

func (dj *orchestrator) shutdown() {
	close(dj.exit)
}

// Performs periodic housekeeping like saving dirty documents, unloading stale docs, terminating inactive sessions
func (dj *orchestrator) housekeep() {
	ticker := time.NewTicker(docJugHousekeepPeriodSec * time.Second)
	safeExec := func(f func()) {
		defer func() {
			if r := recover(); r != nil {
				dj.xlog.Logf(common.LogSrcDocJug, "Panic in housekeeping goroutine: %v", r)
			}
		}()
		f()
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
// Thread-safe; invoked from housekeep goroutine.
func (dj *orchestrator) housekeepDocs() {
	// We break out of closure within loop after each document save
	// This way we release and re-acquire lock, so that other requests can be served between long-ish blocking IO writes
	for finished := false; !finished; {
		func() {
			dj.mu.Lock()
			defer dj.mu.Unlock()

			// Remove docs that have been inactive for long
			// Also remember a dirty document if we see one
			i := 0
			var dirtyDoc *document
			for _, doc := range dj.docs {
				hasExpired := time.Now().UTC().Sub(doc.lastAccessedUtc).Seconds() > docJugUnloadAfterSeconds
				if !hasExpired {
					dj.docs[i] = doc
					i++
				}
				if doc.dirty {
					dirtyDoc = doc
				}
			}
			dj.docs = dj.docs[:i]
			// Save the last dirty document that we found
			if dirtyDoc != nil {
				if err := dirtyDoc.saveToFile(dj.getDocFileName(dirtyDoc.DocId)); err != nil {
					dj.xlog.Logf(common.LogSrcDocJug, "Error saving dirty document %v: %v", dirtyDoc.DocId, err)
				}
			}
			// If we removed a single dirty doc, we continue looping: there may be more
			finished = dirtyDoc == nil
		}()
	}
}

// Unloads inactive and unclaimed sessions; terminates what must be closed.
// Thread-safe; invoked from housekeep goroutine.
func (dj *orchestrator) cleanupSessions() {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	// Keys of sessions to terminate
	toTerminate := make(map[string]bool)
	i := 0
	for _, sess := range dj.sessions {
		unload := false
		// Requested too long ago, and not claimed yet
		if !sess.requestedUtc.IsZero() &&
			time.Now().UTC().Sub(sess.requestedUtc).Seconds() > docJugSessionRequestExpirySeconds {
			unload = true
		}
		// Inactive for too long
		if time.Now().UTC().Sub(sess.lastActiveUtc).Seconds() > docJugSessionIdleEndSeconds {
			unload = true
			toTerminate[sess.sessionKey] = true
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
func (dj *orchestrator) getDocFileName(docId string) string {
	return path.Join(dj.docsFolder, docId+".json")
}

// Gets index of document in loaded array. Returns -1 if not currently loaded.
// Must be called from within lock.
func (dj *orchestrator) getDocIx(docId string) int {
	for ix, doc := range dj.docs {
		if doc.DocId == docId {
			return ix
		}
	}
	return -1
}

// Gets index of a session by key. Returns -1 if no such session.
// Must be called from within lock.
func (dj *orchestrator) getSessionIx(sessionKey string) int {
	for ix, sess := range dj.sessions {
		if sess.sessionKey == sessionKey {
			return ix
		}
	}
	return -1
}

// Creates new document.
// Returns error if document could not be created.
// Thread-safe.
func (dj *orchestrator) CreateDocument(name string) (docId string, err error) {
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
	var doc document
	doc.init(docId, name, nil)
	if err = doc.saveToFile(docFileName); err != nil {
		return
	}
	dj.docs = append(dj.docs, &doc)
	return
}

// Unload document and deletes from disk; destroys existing sessions.
// If document does not exist, or if it cannot be deleted, logs incident, but returns normally.
// Thread-safe.
func (dj *orchestrator) DeleteDocument(docId string) {
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
		if sess.docId != docId {
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
		dj.xlog.Logf(common.LogSrcDocJug, "document on disk does not seem to exist (no big deal): %v", err)
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
func (dj *orchestrator) ensureLoaded(docId string) {
	docIx := dj.getDocIx(docId)
	if docIx != -1 {
		return
	}
	docFileName := dj.getDocFileName(docId)
	var doc document
	if err := doc.loadFromFile(docFileName); err != nil {
		dj.xlog.Logf(common.LogSrcDocJug, "Failed to load document from file: %v", err)
		return
	}
	dj.docs = append(dj.docs, &doc)
}

// Requests a new editing session.
// Returns new session ID, or zero string if document does not exist.
// Thread-safe.
func (dj *orchestrator) RequestSession(docId string) (sessionKey string) {

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
		docId:         docId,
		sessionKey:    sessionKey,
		lastActiveUtc: time.Now().UTC(),
		requestedUtc:  time.Now().UTC(),
	}
	dj.sessions = append(dj.sessions, &sess)

	return sessionKey
}

// Retrieves currently known selections in all active sessions.
// Must be called from within lock.
func (dj *orchestrator) getDocSelections(docId string) []sessionSelection {
	res := make([]sessionSelection, 0, 1)
	for _, sess := range dj.sessions {
		if sess.docId != docId || sess.selection == nil {
			continue
		}
		res = append(res, sessionSelection{
			SessionKey:   sess.sessionKey,
			Start:        sess.selection.Start,
			End:          sess.selection.End,
			CaretAtStart: sess.selection.CaretAtStart,
		})
	}
	return res
}

// Retrieves currently known selections in all active sessions and returns result serialized into JSON.
// Must be called from within lock.
func (dj *orchestrator) getDocSelectionsJSON(docId string) string {
	sessionSelections := dj.getDocSelections(docId)
	selJson, err := json.Marshal(&sessionSelections)
	if err != nil {
		panic(fmt.Sprintf("Failed to serialize session selections to JSON: %v", err))
	}
	return string(selJson)
}

// Starts a new session in response to SESSIONKEY message from socket client
// Thread-safe.
func (dj *orchestrator) startSession(sessionKey string) (startMsg string) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	startMsg = ""
	sessionIx := dj.getSessionIx(sessionKey)
	if sessionIx == -1 {
		return
	}
	sess := dj.sessions[sessionIx]
	if sess.requestedUtc.IsZero() {
		return
	}
	docIx := dj.getDocIx(sess.docId)
	if docIx == -1 {
		return
	}
	doc := dj.docs[docIx]
	ssm := sessionStartMessage{
		Name:           doc.Name,
		RevisionId:     len(doc.revisions) - 1,
		Text:           doc.headText,
		PeerSelections: dj.getDocSelections(doc.DocId),
	}
	sess.requestedUtc = time.Time{}
	sess.selection = &sessionSelection{}
	if startStrBytes, err := json.Marshal(&ssm); err == nil {
		startMsg = string(startStrBytes)
	}
	return
}

// Checks whether session with provided key is currently active (exists and has been started).
// Thread-safe.
func (dj *orchestrator) isSessionOpen(sessionKey string) bool {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	sessionIx := dj.getSessionIx(sessionKey)
	return sessionIx != -1 && dj.sessions[sessionIx].requestedUtc.IsZero()
}

// Removes session with the provided key from list of known sessions, if there.
// Thread-safe.
func (dj *orchestrator) sessionClosed(sessionKey string) {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	i := 0
	for _, sess := range dj.sessions {
		if sess.sessionKey != sessionKey {
			dj.sessions[i] = sess
			i++
		}
	}
	dj.sessions = dj.sessions[:i]
}

// Handles a message from a session announced through a CHANGE message.
// Thread-safe.
func (dj *orchestrator) changeReceived(sessionKey string, clientRevisionId int, selStr, changeStr string) bool {
	dj.mu.Lock()
	defer dj.mu.Unlock()

	// What's the change?
	ok, sess, doc, sel, cs := dj.parseChange(sessionKey, selStr, changeStr)
	if !ok {
		return false
	}
	// Who are we broadcasting to?
	receivers := make(map[string]bool)
	for _, x := range dj.sessions {
		if x.requestedUtc.IsZero() && x.docId == sess.docId {
			receivers[x.sessionKey] = true
		}
	}
	// What are we broadcasting?
	ctb := changeToBroadcast{
		sourceSessionKey:        sessionKey,
		sourceBaseDocRevisionId: clientRevisionId,
		newDocRevisionId:        len(doc.revisions) - 1,
		receiverSessionKeys:     receivers,
	}
	// What is this change?
	if cs == nil {
		// This is only about a changed selection
		sess.selection.Start, sess.selection.End = doc.forwardSelection(sel.Start, sel.End, clientRevisionId)
		sess.selection.CaretAtStart = sel.CaretAtStart
		ctb.selJson = dj.getDocSelectionsJSON(sess.docId)
		dj.xlog.Logf(common.LogSrcDocJug, "Propagating selection update")
	} else {
		// We got us a real change set
		if !cs.IsValid() {
			dj.xlog.Logf(common.LogSrcDocJug, "Received change is invalid. Ending session.")
			return false
		}
		var csToProp *biscript.ChangeSet
		csToProp, sess.selection.Start, sess.selection.End = doc.applyChange(cs, sel.Start, sel.End, clientRevisionId)
		sess.selection.CaretAtStart = sel.CaretAtStart
		ctb.newDocRevisionId = len(doc.revisions) - 1
		ctb.selJson = dj.getDocSelectionsJSON(sess.docId)
		ctb.changeJson = csToProp.SerializeJSON()
		dj.xlog.Logf(common.LogSrcDocJug, "Propagating change set and selection update")
	}
	// Showtime!
	dj.broadcast <- &ctb
	return true
}

// Parses data in received change.
// Must be called from within lock.
func (dj *orchestrator) parseChange(sessionKey string, selStr, changeStr string) (
	ok bool, sess *editSession, doc *document, sel sessionSelection, cs *biscript.ChangeSet) {

	ok = false
	sess = nil
	doc = nil
	sel = sessionSelection{SessionKey: sessionKey}
	cs = nil

	for _, x := range dj.sessions {
		if x.sessionKey == sessionKey {
			sess = x
			break
		}
	}
	if sess == nil {
		return
	}
	sess.lastActiveUtc = time.Now().UTC()
	dj.ensureLoaded(sess.docId)
	for _, x := range dj.docs {
		if x.DocId == sess.docId {
			doc = x
			break
		}
	}
	if doc == nil {
		return
	}
	if err := json.Unmarshal([]byte(selStr), &sel); err != nil {
		return
	}
	if changeStr != "" {
		cs = &biscript.ChangeSet{}
		if err := cs.DeserializeJSON(changeStr); err != nil {
			dj.xlog.Logf(common.LogSrcDocJug, "Failed to deserialize change set from JSON: %v", err)
			return
		}
	}
	dj.xlog.Logf(common.LogSrcDocJug, "Parsed change from session %v: Sel %v", sessionKey, sel)
	ok = true
	return
}