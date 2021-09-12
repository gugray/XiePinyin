package server

import (
	"encoding/json"
	"testing"
)

func TestComposeResult_JSON(t *testing.T) {
	cr :=  composeResult{
		PinyinSylls: []string{"wei4", "wei2"},
		Words:[][]string{[]string{"为", "魏"}, []string{"X", "Y"}},
	}
	jsonBytes, err := json.Marshal(&cr)
	if err !=nil {
		t.Errorf("Failed to marshal composeResult to JSON")
	}
	jsonStr := string(jsonBytes)
	if jsonStr != `{"pinyinSylls":["wei4","wei2"],"words":[["为","魏"],["X","Y"]]}` {
		t.Errorf("Incorrect JSON for composeResult")
	}
}
