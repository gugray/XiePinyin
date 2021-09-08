package logic

import (
	"encoding/json"
	"os"
	"time"
)

type Document struct {
	DocId string `json:"docId"`
	Name string `json:"name"`
	StartText []XieChar  `json:"startText"`
	//Revisions []Revision `json:"-"`
	HeadText[]XieChar `json:"-"`
	Dirty bool `json:"-"`
	LastAccessedUtc time.Time `json:"-"`
}

func (doc *Document) Init(docId string, name string, startText []XieChar) {
	doc.DocId = docId;
	doc.Name = name;
	doc.StartText = startText;
	if doc.StartText == nil {
		doc.StartText = make([]XieChar, 0)
	}
	doc.HeadText = make([]XieChar, 0)
	// TO-DO: Revisions
	// Revisions.Add(new Revision(ChangeSet.CreateIdent(StartText.Length)));
}

func (doc *Document) SaveToFile(fileName string) error {
	toSave := Document{DocId: doc.DocId, Name: doc.Name, StartText: doc.HeadText}
	data, err := json.Marshal(&toSave)
	if err != nil {
		return  err
	}
	if err = os.WriteFile(fileName, data, 0644); err != nil {
		return  err
	}
	return nil
}
