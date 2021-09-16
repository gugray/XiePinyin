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
	"xiep/internal/docx"
)

const (
	orkUnloadAfterSeconds          = 7800 // 2:10h; MUST BE GREATER THAN SessionIdleEndSeconds
	orkSessionRequestExpirySeconds = 10   // If requested session is not started in this time, we purge it
	orkSessionIdleEndSeconds       = 7200 // 2h; session is purged if idle for this long
	orkHousekeepPeriodSec          = 2    // Frequency of housekeeping loop
	//orkExportCleanupLoopSec        = 600  // Frequency of cleanup of exported files waiting for download
)

// Connection manager functionality related to sending messagest to connected peers.
// Allows us to decouple the interacting types of orchestrator and connection manager.
type peerMessenger interface {
	// Broadcasts message to the peers that need to hear it.
	broadcast(ctb *changeToBroadcast)

	// Terminates sessions identified by the provided keys.
	terminateSessions(sessionKeys map[string]bool)
}

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
	xlog          common.XieLogger
	wgShutdown    *sync.WaitGroup
	composer      *composer
	docsFolder    string
	exportsFolder string
	exit          chan interface{}
	peerMessenger peerMessenger

	mu       sync.Mutex
	docs     []*document
	sessions []*editSession
}

func (ork *orchestrator) init(xlog common.XieLogger,
	wgShutdown *sync.WaitGroup,
	composer *composer,
	docsFolder string,
	exportsFolder string,
) {
	ork.xlog = xlog
	ork.wgShutdown = wgShutdown
	ork.composer = composer
	ork.docsFolder = docsFolder
	ork.exportsFolder = exportsFolder
	ork.exit = make(chan interface{})
}

func (ork *orchestrator) startup(pm peerMessenger) {
	ork.peerMessenger = pm
	// Housekeep goroutine calls peer messenger functions, we cannot start before setting it.
	go ork.housekeep()
}

func (ork *orchestrator) shutdown() {
	close(ork.exit)
}

// Performs periodic housekeeping like saving dirty documents, unloading stale docs, terminating inactive sessions
func (ork *orchestrator) housekeep() {
	ticker := time.NewTicker(orkHousekeepPeriodSec * time.Second)
	safeExec := func(f func()) {
		defer func() {
			if r := recover(); r != nil {
				ork.xlog.Logf(common.LogSrcOrchestrator, "Panic in housekeeping goroutine: %v", r)
			}
		}()
		f()
	}
	for {
		select {
		case <-ticker.C:
			safeExec(ork.housekeepDocs)
			safeExec(ork.cleanupSessions)
		case <-ork.exit:
			ork.xlog.Logf(common.LogSrcOrchestrator, "Housekeeping thread exiting")
			ticker.Stop()
			safeExec(ork.housekeepDocs)
			ork.xlog.Logf(common.LogSrcOrchestrator, "Housekeeping thread finished")
			ork.wgShutdown.Done()
			return
		}
	}
}

// Saves dirty docs and unloads inactive docs.
// Thread-safe; invoked from housekeep goroutine.
func (ork *orchestrator) housekeepDocs() {
	// We break out of closure within loop after each document save
	// This way we release and re-acquire lock, so that other requests can be served between long-ish blocking IO writes
	for finished := false; !finished; {
		func() {
			ork.mu.Lock()
			defer ork.mu.Unlock()

			// Remove docs that have been inactive for long
			// Also remember a dirty document if we see one
			i := 0
			var dirtyDoc *document
			for _, doc := range ork.docs {
				hasExpired := time.Now().UTC().Sub(doc.lastAccessedUtc).Seconds() > orkUnloadAfterSeconds
				if !hasExpired {
					ork.docs[i] = doc
					i++
				}
				if doc.dirty {
					dirtyDoc = doc
				}
			}
			ork.docs = ork.docs[:i]
			// Save the last dirty document that we found
			if dirtyDoc != nil {
				if err := dirtyDoc.saveToFile(ork.getDocFileName(dirtyDoc.DocId)); err != nil {
					ork.xlog.Logf(common.LogSrcOrchestrator, "Error saving dirty document %v: %v", dirtyDoc.DocId, err)
				}
			}
			// If we removed a single dirty doc, we continue looping: there may be more
			finished = dirtyDoc == nil
		}()
	}
}

// Unloads inactive and unclaimed sessions; terminates what must be closed.
// Thread-safe; invoked from housekeep goroutine.
func (ork *orchestrator) cleanupSessions() {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	// Keys of sessions to terminate
	toTerminate := make(map[string]bool)
	i := 0
	for _, sess := range ork.sessions {
		unload := false
		// Requested too long ago, and not claimed yet
		if !sess.requestedUtc.IsZero() &&
			time.Now().UTC().Sub(sess.requestedUtc).Seconds() > orkSessionRequestExpirySeconds {
			unload = true
		}
		// Inactive for too long
		if time.Now().UTC().Sub(sess.lastActiveUtc).Seconds() > orkSessionIdleEndSeconds {
			unload = true
			toTerminate[sess.sessionKey] = true
		}
		if !unload {
			ork.sessions[i] = sess
			i++
		}
	}
	ork.sessions = ork.sessions[:i]
	ork.peerMessenger.terminateSessions(toTerminate)
}

// Assembles full file system path of saved document.
// Thread-safe.
func (ork *orchestrator) getDocFileName(docId string) string {
	return path.Join(ork.docsFolder, docId+".json")
}

// Gets index of document in loaded array. Returns -1 if not currently loaded.
// Must be called from within lock.
func (ork *orchestrator) getDocIx(docId string) int {
	for ix, doc := range ork.docs {
		if doc.DocId == docId {
			return ix
		}
	}
	return -1
}

// Gets index of a session by key. Returns -1 if no such session.
// Must be called from within lock.
func (ork *orchestrator) getSessionIx(sessionKey string) int {
	for ix, sess := range ork.sessions {
		if sess.sessionKey == sessionKey {
			return ix
		}
	}
	return -1
}

// Creates new document.
// Returns error if document could not be created.
// Thread-safe.
func (ork *orchestrator) CreateDocument(name string) (docId string, err error) {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	err = nil
	var docFileName string
	for {
		docId = getShortId()
		if ix := ork.getDocIx(docId); ix != -1 {
			continue
		}
		docFileName = ork.getDocFileName(docId)
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
	ork.docs = append(ork.docs, &doc)
	return
}

// Unload document and deletes from disk; destroys existing sessions.
// If document does not exist, or if it cannot be deleted, logs incident, but returns normally.
// Thread-safe.
func (ork *orchestrator) DeleteDocument(docId string) {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	// Find index of document in docs array (might not be present if not loaded)
	docIx := ork.getDocIx(docId)
	// Remove doc from array, if loaded
	if docIx != -1 {
		ork.docs[docIx] = ork.docs[len(ork.docs)-1]
		ork.docs[len(ork.docs)-1] = nil
		ork.docs = ork.docs[:len(ork.docs)-1]
	}
	// Remove any related sessions
	i := 0
	for _, sess := range ork.sessions {
		if sess.docId != docId {
			ork.sessions[i] = sess
			i++
		}
	}
	ork.sessions = ork.sessions[:i]
	// Delete file
	docFileName := ork.getDocFileName(docId)
	// Try to delete if file seems to exist
	if _, err := os.Stat(docFileName); err != nil {
		// File does not exist: log it, but life can go on
		ork.xlog.Logf(common.LogSrcOrchestrator, "document on disk does not seem to exist (no big deal): %v", err)
	} else {
		// File exists: get rid of it
		if err := os.Remove(docFileName); err != nil {
			// If physical delete fails, log error, but otherwise life can go on
			ork.xlog.Logf(common.LogSrcOrchestrator, "Failed to delete document from disk (no big deal): %v", err)
		}
	}
}

// Loads a doc from disk if it exists but no currently in memory.
// If document does not exist, or cannot be parsed, logs incident and returns normally.
// Must be called from within lock.
func (ork *orchestrator) ensureLoaded(docId string) {
	docIx := ork.getDocIx(docId)
	if docIx != -1 {
		return
	}
	docFileName := ork.getDocFileName(docId)
	var doc document
	if err := doc.loadFromFile(docFileName); err != nil {
		ork.xlog.Logf(common.LogSrcOrchestrator, "Failed to load document from file: %v", err)
		return
	}
	ork.docs = append(ork.docs, &doc)
}

// Requests a new editing session.
// Returns new session ID, or zero string if document does not exist.
// Thread-safe.
func (ork *orchestrator) RequestSession(docId string) (sessionKey string) {

	ork.mu.Lock()
	defer ork.mu.Unlock()

	ork.ensureLoaded(docId)
	if docIx := ork.getDocIx(docId); docIx == -1 {
		return ""
	}
	for {
		sessionKey = "S-" + getShortId()
		if ix := ork.getSessionIx(sessionKey); ix == -1 {
			break
		}
	}
	sess := editSession{
		docId:         docId,
		sessionKey:    sessionKey,
		lastActiveUtc: time.Now().UTC(),
		requestedUtc:  time.Now().UTC(),
	}
	ork.sessions = append(ork.sessions, &sess)

	return sessionKey
}

// Retrieves currently known selections in all active sessions.
// Must be called from within lock.
func (ork *orchestrator) getDocSelections(docId string) []sessionSelection {
	res := make([]sessionSelection, 0, 1)
	for _, sess := range ork.sessions {
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
func (ork *orchestrator) getDocSelectionsJSON(docId string) string {
	sessionSelections := ork.getDocSelections(docId)
	selJson, err := json.Marshal(&sessionSelections)
	if err != nil {
		panic(fmt.Sprintf("Failed to serialize session selections to JSON: %v", err))
	}
	return string(selJson)
}

// Starts a new session in response to SESSIONKEY message from socket client
// Thread-safe.
func (ork *orchestrator) startSession(sessionKey string) (startMsg string) {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	startMsg = ""
	sessionIx := ork.getSessionIx(sessionKey)
	if sessionIx == -1 {
		return
	}
	sess := ork.sessions[sessionIx]
	if sess.requestedUtc.IsZero() {
		return
	}
	docIx := ork.getDocIx(sess.docId)
	if docIx == -1 {
		return
	}
	doc := ork.docs[docIx]
	ssm := sessionStartMessage{
		Name:           doc.Name,
		RevisionId:     len(doc.revisions) - 1,
		Text:           doc.headText,
		PeerSelections: ork.getDocSelections(doc.DocId),
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
func (ork *orchestrator) isSessionOpen(sessionKey string) bool {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	sessionIx := ork.getSessionIx(sessionKey)
	return sessionIx != -1 && ork.sessions[sessionIx].requestedUtc.IsZero()
}

// Removes session with the provided key from list of known sessions, if there.
// Thread-safe.
func (ork *orchestrator) sessionClosed(sessionKey string) {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	i := 0
	for _, sess := range ork.sessions {
		if sess.sessionKey != sessionKey {
			ork.sessions[i] = sess
			i++
		}
	}
	ork.sessions = ork.sessions[:i]
}

// Handles a message from a session announced through a CHANGE message.
// Thread-safe.
func (ork *orchestrator) changeReceived(sessionKey string, clientRevisionId int, selStr, changeStr string) bool {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	// What's the change?
	ok, sess, doc, sel, cs := ork.parseChange(sessionKey, selStr, changeStr)
	if !ok {
		return false
	}
	// Who are we broadcasting to?
	receivers := make(map[string]bool)
	for _, x := range ork.sessions {
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
		ctb.selJson = ork.getDocSelectionsJSON(sess.docId)
		ork.xlog.Logf(common.LogSrcOrchestrator, "Propagating selection update")
	} else {
		// We got us a real change set
		if !cs.IsValid() {
			ork.xlog.Logf(common.LogSrcOrchestrator, "Received change is invalid. Ending session.")
			return false
		}
		var csToProp *biscript.ChangeSet
		csToProp, sess.selection.Start, sess.selection.End = doc.applyChange(cs, sel.Start, sel.End, clientRevisionId)
		sess.selection.CaretAtStart = sel.CaretAtStart
		ctb.newDocRevisionId = len(doc.revisions) - 1
		ctb.selJson = ork.getDocSelectionsJSON(sess.docId)
		ctb.changeJson = csToProp.SerializeJSON()
		ork.xlog.Logf(common.LogSrcOrchestrator, "Propagating change set and selection update")
	}
	// Showtime!
	ork.peerMessenger.broadcast(&ctb)
	return true
}

// Parses data in received change.
// Must be called from within lock.
func (ork *orchestrator) parseChange(sessionKey string, selStr, changeStr string) (
	ok bool, sess *editSession, doc *document, sel sessionSelection, cs *biscript.ChangeSet) {

	ok = false
	sess = nil
	doc = nil
	sel = sessionSelection{SessionKey: sessionKey}
	cs = nil

	for _, x := range ork.sessions {
		if x.sessionKey == sessionKey {
			sess = x
			break
		}
	}
	if sess == nil {
		return
	}
	sess.lastActiveUtc = time.Now().UTC()
	ork.ensureLoaded(sess.docId)
	for _, x := range ork.docs {
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
			ork.xlog.Logf(common.LogSrcOrchestrator, "Failed to deserialize change set from JSON: %v", err)
			return
		}
	}
	ork.xlog.Logf(common.LogSrcOrchestrator, "Parsed change from session %v: Sel %v", sessionKey, sel)
	ok = true
	return
}

// Gets the display name of the document. Returns empty string if document is not found.
// Thread-safe.
func (ork *orchestrator) GetDocumentName(docId string) string {
	ork.mu.Lock()
	defer ork.mu.Unlock()

	ork.ensureLoaded(docId)
	ix := ork.getDocIx(docId)
	if ix == -1 {
		return ""
	}
	return ork.docs[ix].Name
}

// Exports a document into DOCX and stores it in the filesystem for later download.
// Returns ID that can be used for download in a subsequent call.
// If doc is not found or the export fails, returns empty string.
// Thread-safe.
func (ork *orchestrator) ExportDocx(docId string) (downloadId string) {

	var text []biscript.XieChar
	downloadId = ""
	var exportFilePath string

	// Closure so we only lock as long as we're loading the document and coming up with the output file name
	func() {
		ork.mu.Lock()
		defer ork.mu.Unlock()

		// Grab doc and verify it exists
		ork.ensureLoaded(docId)
		ix := ork.getDocIx(docId)
		if ix == -1 {
			return
		}
		doc := ork.docs[ix]
		// If dirty, save before exiting so user gets the actual latest content
		if doc.dirty {
			if err := doc.saveToFile(ork.getDocFileName(doc.DocId)); err != nil {
				ork.xlog.Logf(common.LogSrcOrchestrator, "Error saving dirty document before export %v: %v", doc.DocId, err)
			}
		}
		// Copy head  text
		text = make([]biscript.XieChar, 0, len(doc.headText))
		for _, xc := range doc.headText {
			text = append(text, xc)
		}
		// Come up with unique file name locally
		for {
			downloadId = docId + "-" + getShortId() + ".docx"
			exportFilePath = path.Join(ork.exportsFolder, downloadId)
			if _, err := os.Stat(exportFilePath); err == nil {
				continue
			}
			break
		}
	}()
	// This indicates that doc does not exist
	if downloadId == "" {
		return
	}
	// Perform export; indicate error with empty download ID
	if err := docx.Export(text, exportFilePath, ork.composer); err != nil {
		downloadId = ""
		ork.xlog.Logf(common.LogSrcOrchestrator, "Error exporting document to DOCX: %v", err)
	}
	return
}
