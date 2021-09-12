package logic

import (
	"encoding/json"
	"testing"
	"xiep/internal/biscript"
)

func TestSessionSelection_JSON(t *testing.T) {
	sel := sessionSelection{
		SessionKey:   "xyz",
		Start:        1,
		End:          2,
		CaretAtStart: true,
	}
	jsonBytes, err := json.Marshal(&sel)
	if err != nil {
		t.Errorf("Failed to marshal sessionSelection to JSON")
	}
	jsonStr := string(jsonBytes)
	if jsonStr != `{"sessionKey":"xyz","start":1,"end":2,"caretAtStart":true}` {
		t.Errorf("Incorrect JSON for sessionSelection")
	}
}

func TestSessionStartMessage_JSON(t *testing.T) {
	ssm := sessionStartMessage{
		Name:           "Momo",
		RevisionId:     1,
		Text:           []biscript.XieChar{{Hanzi: "A"}, {Hanzi: "狗", Pinyin: "gou3"}},
		PeerSelections: []sessionSelection{{SessionKey: "xyz", Start: 1, End: 2, CaretAtStart: true}},
	}
	jsonBytes, err := json.Marshal(&ssm)
	if err != nil {
		t.Errorf("Failed to marshal sessionStartMessage to JSON")
	}
	jsonStr := string(jsonBytes)
	if jsonStr != `{"name":"Momo","revisionId":1,"text":[{"hanzi":"A"},{"hanzi":"狗","pinyin":"gou3"}],"peerSelections":[{"sessionKey":"xyz","start":1,"end":2,"caretAtStart":true}]}` {
		t.Errorf("Incorrect JSON for sessionSelection")
	}
}
