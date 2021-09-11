package logic

import (
	"encoding/json"
	"os"
	"time"
	"xiep/internal/biscript"
)

// Represents one revision in a document.
type revision struct {
	// The changes from the previous revision.
	changeSet biscript.ChangeSet
}

// Represents one document currently loaded in the server.
// None of the methods are thread-safe.
type document struct {
	// Document's unique short ID
	DocId string `json:"docId"`

	// Document's display Name (title)
	Name string `json:"name"`

	// Document's starting text. Revisions Start from this state.
	StartText []biscript.XieChar `json:"startText"`

	// Sequence of revisions.
	revisions []*revision

	// Document's current content, after applying all revisions to Start text.
	headText []biscript.XieChar

	// If true, document has been changed in memory and needs to be saved soon.
	dirty bool

	// Last time the document was accessed. Documents that are not changed for a while get unloaded.
	lastAccessedUtc time.Time
}

func (doc *document) init(docId string, name string, startText []biscript.XieChar) {
	doc.DocId = docId
	doc.Name = name
	doc.StartText = startText
	if doc.StartText == nil {
		doc.StartText = make([]biscript.XieChar, 0)
	}
	doc.headText = make([]biscript.XieChar, 0)
	doc.lastAccessedUtc = time.Now().UTC()
	// Add initial revision with identity change
	initialRev := revision{}
	initialRev.changeSet.InitIdent(uint(len(startText)))
	doc.revisions = append(doc.revisions, &initialRev)
}

func (doc *document) loadFromFile(fileName string) error {
	if data, err := os.ReadFile(fileName); err != nil {
		return err
	} else {
		if err = json.Unmarshal(data, doc); err != nil {
			return err
		}
	}
	doc.lastAccessedUtc = time.Now().UTC()
	doc.headText = make([]biscript.XieChar, len(doc.StartText))
	for i, xc := range doc.StartText {
		doc.headText[i] = xc
	}
	// Add initial revision with identity change
	initialRev := revision{}
	initialRev.changeSet.InitIdent(uint(len(doc.StartText)))
	doc.revisions = append(doc.revisions, &initialRev)

	return nil
}

func (doc *document) saveToFile(fileName string) error {
	toSave := document{DocId: doc.DocId, Name: doc.Name, StartText: doc.headText}
	data, err := json.Marshal(&toSave)
	if err != nil {
		return err
	}
	if err = os.WriteFile(fileName, data, 0644); err != nil {
		return err
	}
	doc.dirty = false
	return nil
}

func (doc *document) touch(makeDirty bool) {
	doc.lastAccessedUtc = time.Now().UTC()
	doc.dirty = doc.dirty || makeDirty
}

// Calculates forward of selection from a client, so it applies to current head text.
// baseRevId is client's head revision ID, to which the selection applies.
func (doc *document) forwardSelection(start, end uint, baseRevId int) (uint, uint) {
	doc.touch(false)
	poss := []uint{start, end}
	for i := baseRevId + 1; i < len(doc.revisions); i++ {
		doc.revisions[i].changeSet.ForwardPositions(poss)
	}
	return poss[0], poss[1]
}

// Applies a changeset received from a client to the document.
// selStart and selEnd represent the selection in the client's head revision
// baseRevId is client's head revision ID (latest revision they are aware of; this is what the change is based on)
// csToProp is the computed new changeset added to the end of document's master revision list.
// selInHeadStart and selInHeadEnd are the selection forwarded to the new head text.
func (doc *document) applyChange(cs *biscript.ChangeSet, selStart, selEnd uint, baseRevId int) (
	csToProp *biscript.ChangeSet, selInHeadStart, selInHeadEnd uint) {

	// Compute sequence of follows so we get changeset that applies to our latest revision
	// Server's head might be ahead of the revision known to the client, which is what this CS is based on.
	csToProp = cs
	poss := []uint{selStart, selEnd}
	for i := baseRevId + 1; i < len(doc.revisions); i++ {
		revCS := &doc.revisions[i].changeSet
		csToProp = revCS.Follow(csToProp)
		revCS.ForwardPositions(poss)
	}
	doc.revisions = append(doc.revisions, &revision{changeSet: *csToProp})
	doc.headText = csToProp.Apply(doc.headText)

	// Doc is accessed, and becomes dirty
	doc.touch(true)
	selInHeadStart, selInHeadEnd = poss[0], poss[1]

	return
}
