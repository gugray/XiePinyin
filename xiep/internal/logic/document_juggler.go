package logic

import (
	"os"
	"path"
	"sync"
	"time"
	"xiep/internal/common"
)

const (
	DocJugUnloadAfterSeconds          = 7800 // 2:10h; MUST BE GREATER THAN SessionIdleEndSeconds
	DocJugSessionRequestExpirySeconds = 10
	DocJugSessionIdleEndSeconds       = 7200 // 2h
	DocJugSaveFunCycleMsec            = 200
	DocJugSaveFunLoopSec              = 2
	DocJugExportCleanupLoopSec        = 600
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

type DocumentJuggler struct {
	xlog          common.XieLogger
	mu            sync.Mutex
	composer      *Composer
	docsFolder    string
	exportsFolder string
	sessions      []*editSession
	docs          []*Document
	exit          chan interface{}
}

func (dj *DocumentJuggler) Init(xlog common.XieLogger,
	composer *Composer,
	docsFolder string,
	exportsFolder string,
) {
	dj.xlog = xlog
	dj.composer = composer
	dj.docsFolder = docsFolder
	dj.exportsFolder = exportsFolder
	go dj.houseKeep()
}

func (dj *DocumentJuggler) Shutdown() {
	close(dj.exit)
}

func (dj *DocumentJuggler) houseKeep() {
	for {
		select {
		case <-dj.exit:
			dj.xlog.Logf(common.LogSrcDocJug, "Housekeeping thread exiting")
			return
		}
	}
}

func (dj *DocumentJuggler) getDocFileName(docId string) string {
	return path.Join(dj.docsFolder, docId+".json")
}

func (dj *DocumentJuggler) getDocIx(docId string) int {
	for ix, doc := range dj.docs {
		if doc.DocId == docId {
			return ix
		}
	}
	return -1
}

func (dj *DocumentJuggler) CreateDocument(name string) (docId string, err error) {
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
