package logic

import (
	"encoding/json"
	"testing"
)

func TestXieCharEquality(t *testing.T) {
	mono1a := XieChar{Hanzi: "XC"}
	mono1b := mono1a
	mono1c := XieChar{Hanzi: "XC"}
	if mono1a != mono1b || mono1a != mono1c {
		t.Errorf("equality test failed");
	}
	mono2 := XieChar{Hanzi: "Y"}
	if mono2 == mono1a {
		t.Errorf("equality test failed");
	}
	bi1a := XieChar{Hanzi: "时", Pinyin: "shí"}
	bi1b := bi1a
	bi1c := XieChar{Hanzi: "时", Pinyin: "shí"}
	if bi1a != bi1b || bi1a != bi1c {
		t.Errorf("equality test failed");
	}
	bi2 := XieChar{Hanzi: "时", Pinyin: "barf"}
	bi3 := XieChar{Hanzi: "对", Pinyin: "shí"}
	if bi2 == bi1a || bi3 == bi1a {
		t.Errorf("equality test failed");
	}
	mono3 := XieChar{Hanzi: "时"}
	if bi1a == mono3 || bi1a == mono1a {
		t.Errorf("equality test failed");
	}
}

func TestXieCharJson(t *testing.T) {
	type Itm struct {
		XC XieChar
		J  string
	}
	vals := []Itm {
		{XC: XieChar{Hanzi: "X"}, J: `{"hanzi":"X"}`},
		{XC: XieChar{Hanzi: "时", Pinyin: "shí"}, J: `{"hanzi":"时","pinyin":"shí"}`},
	}
	for _, val := range vals {
		jsonBytes, _ := json.Marshal(val.XC)
		jsonStr := string(jsonBytes)
		if jsonStr != val.J {
			t.Errorf("incorrect JSON serialization for %v: %v, expected: %v", val.XC, jsonStr,  val.J)
		}
		var xcFromRountrip, xcFromData XieChar
		if err := json.Unmarshal([]byte(jsonStr), &xcFromRountrip); err != nil {
			t.Errorf("failed to parse back JSON %v, error: %v", jsonStr, err)
		}
		if xcFromRountrip != val.XC {
			t.Errorf("roundtrip failed; orig: %v, parsed back as: %v", val.XC, xcFromRountrip)
		}
		if err := json.Unmarshal([]byte(val.J), &xcFromData); err != nil {
			t.Errorf("failed to parse JSON %v, error: %v", val.J, err)
		}
		if xcFromData != val.XC {
			t.Errorf("wrong parse result for JSON: %v, got: %v, expected: %v", val.J, xcFromData, val.XC)
		}
	}
	badJsons := []string {
		`{"hanzi":"XY"}`,
		`{"hanzi":""}`,
		`{}`,
		`{"pinyin":"boo"}`,
	}
	for _, jsonStr := range badJsons {
		var xc XieChar
		if err := json.Unmarshal([]byte(jsonStr), &xc); err == nil {
			t.Errorf("invalid JSON expected to fail but did not: %v", jsonStr)
		}
	}

}