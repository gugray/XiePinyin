package logic

import (
	"encoding/json"
	"testing"
	"xiep/internal/biscript"
)

func TestDocument_JSON(t *testing.T) {
	doc := document{
		DocId: "X",
		Name: "Y",
		StartText: []biscript.XieChar{{Hanzi: "A"}, {Hanzi: "狗", Pinyin: "gou3"}},
	}
	jsonBytes, err := json.Marshal(&doc)
	if err !=nil {
		t.Errorf("Failed to marshal document to JSON")
	}
	jsonStr := string(jsonBytes)
	if jsonStr != `{"docId":"X","name":"Y","startText":[{"hanzi":"A"},{"hanzi":"狗","pinyin":"gou3"}]}` {
		t.Errorf("Incorrect JSON for document")
	}
}
