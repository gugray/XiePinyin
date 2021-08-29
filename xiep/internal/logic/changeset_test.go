package logic

import (
	"testing"
)

func TestChangeSet_ToDiagStr(t *testing.T) {
	var cs ChangeSet
	cs.LengthBefore = 13
	cs.appendKeptRange(0, 0)
	cs.appendXieChar(XieChar{Hanzi: "X"})
	cs.appendKeptRange(5, 6)
	cs.appendXieChar(XieChar{Hanzi: "\n"})
	dstr := cs.ToDiagStr()
	expected := "13>0,X,5,6,\\n"
	if dstr != expected {
		t.Errorf("ToDiagStr: got %v, expected %v", dstr, expected)
	}
}

func TestChangeSet_FromDiagStr(t *testing.T) {
	var cs ChangeSet
	dstr := "13>0,X,5,6,Z"
	err := cs.FromDiagStr(dstr)
	if err != nil {
		t.Errorf("Failed to parse diag string: %v", dstr)
	}
	ok := true
	ok = ok && cs.LengthBefore == 13
	ok = ok && len(cs.Items) == 5
	ok = ok && cs.LengthAfter == 5
	ok = ok && cs.Items[0].(uint) == 0
	ok = ok && cs.Items[1].(XieChar).Hanzi == "X"
	ok = ok && cs.Items[2].(uint) == 5
	ok = ok && cs.Items[3].(uint) == 6
	ok = ok && cs.Items[4].(XieChar).Hanzi == "Z"
	if !ok {
		t.Errorf("Diag string not parsed correctly: %v", dstr)
	}
}

func TestChangeSet_IsValid(t *testing.T) {
	vals := []string{
		"2>1,0",
		"0>0",
		"2>1,1",
		"2>2",
	}
	for _, val := range vals {
		var cs ChangeSet
		err := cs.FromDiagStr(val)
		if err == nil && cs.IsValid() {
			t.Errorf("Failed to detect invalid change set: %v", val)
		}
	}
}

func TestChangeSet_MarshalJSON(t *testing.T) {
	dstr := "1>0,Z"
	var cs ChangeSet
	cs.FromDiagStr(dstr)
	json := cs.SerializeJSON()
	expected := `{"lengthBefore":1,"lengthAfter":2,"items":[0,{"hanzi":"Z"}]}`
	if json != expected {
		t.Errorf("Incorrect JSON serialization for %v: got %v, expected %v", dstr, json, expected)
	}
}

func TestChangeSet_UnmarshalJSON(t *testing.T) {
	jsonStr := `{"lengthBefore":1,"lengthAfter":2,"items":[0,{"hanzi":"Z"},{"hanzi":"\n"}]}`
	var cs ChangeSet
	err := cs.DeserializeJSON(jsonStr)
	if err != nil {
		t.Errorf("Faild to unmarshal JSON: %v; error: %v", jsonStr, err)
		return
	}
	ok := true
	ok = ok && cs.LengthBefore == 1
	ok = ok && cs.LengthAfter == 3
	ok = ok && cs.Items[0].(uint) == 0
	ok = ok && cs.Items[1].(XieChar).Hanzi == "Z"
	ok = ok && cs.Items[2].(XieChar).Hanzi == "\n"
	if !ok {
		t.Errorf("JSON not parsed correctly: %v", jsonStr)
	}
}

func TestApplyChangeSet(t *testing.T) {
	vals := [][]string{
		{"A", "1>0", "A"},
		{"A", "1>", ""},
		{"A", "1>X,0,Y", "XAY"},
		{"ABC", "3>X,1,Y", "XBY"},
		{"", "0>X,Y", "XY"},
	}
	for _, val := range vals {
		before := makeXieText(val[0])
		var cs ChangeSet
		cs.FromDiagStr(val[1])
		after := ApplyChangeSet(before, cs)
		expected := makeXieText(val[2])
		if !testXieTextEq(after, expected) {
			t.Errorf("Wrong text after applying changeset %v to %v", val[1], val[0])
		}
	}
}

func makeXieText(str string) []XieChar {
	res := make([]XieChar, 0, len(str))
	for _, c := range str {
		res = append(res, XieChar{Hanzi: string(c)})
	}
	return res
}

func testXieTextEq(a, b []XieChar) bool {
	if len(a) != len(b) {
		return false
	}
	for i, valA := range a {
		if valA != b[i] {
			return false
		}
	}
	return true
}
