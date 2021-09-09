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
	doc.LastAccessedUtc = time.Now().UTC()
	// TODO: Revisions
	// Revisions.Add(new Revision(ChangeSet.CreateIdent(StartText.Length)));
}

func (doc *Document) LoadFromFile(fileName string) error {
	if data, err := os.ReadFile(fileName); err != nil {
		return err
	} else {
		if err = json.Unmarshal(data, *doc); err != nil {
			return err
		}
	}
	doc.LastAccessedUtc = time.Now().UTC()
	doc.HeadText = make([]XieChar, len(doc.StartText))
	for i, xc := range doc.StartText {
		doc.HeadText[i] = xc
	}
	// TODO: Revisions
	// res.Revisions.Add(new Revision(ChangeSet.CreateIdent(res.StartText.Length)));
	return nil
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
