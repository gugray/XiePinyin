package biscript

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
	cs.FromDiagStr(dstr)
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
		cs.FromDiagStr(val)
		if cs.IsValid() {
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

func TestChangeSet_Apply(t *testing.T) {
	vals := [][]string{
		{"X", "1>0", "X"},
		{"X", "1>", ""},
		{"A", "1>X,0,Y", "XAY"},
		{"ABC", "3>X,1,Y", "XBY"},
		{"", "0>X,Y", "XY"},
	}
	for _, val := range vals {
		before := makeXieText(val[0])
		var cs ChangeSet
		cs.FromDiagStr(val[1])
		after := cs.Apply(before)
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

func TestChangeSet_ForwardPositions(t *testing.T) {
	type Itm struct {
		CS       string
		Expected []uint
	}
	vals := []Itm{
		{"4>0,1,2,3", []uint{0, 1, 2, 3, 4}},
		{"4>0,2,X,3", []uint{0, 1, 1, 2, 4}},
		{"4>0,1,2,X,3", []uint{0, 1, 2, 3, 5}},
	}
	for _, val := range vals {
		var cs ChangeSet
		cs.FromDiagStr(val.CS)
		poss := make([]uint, 0, cs.LengthBefore)
		for i := uint(0); i <= cs.LengthBefore; i++ {
			poss = append(poss, i)
		}
		cs.ForwardPositions(poss)
		ok := len(poss) == len(val.Expected)
		for i := 0; ok && i < len(poss); i++ {
			ok = ok && poss[i] == val.Expected[i]
		}
		if !ok {
			t.Errorf("Changeset %v forwarded positions to %v; expected %v", val.CS, poss, val.Expected)
		}
	}
}

func TestChangeSet_Compose(t *testing.T) {
	vals := [][]string{
		{"0>X,Y", "2>1,X", "0>Y,X"},
		{"0>X", "1>X", "0>X"},
		{"0>X", "1>Y,0", "0>Y,X"},
		{"0>X", "1>0,Y", "0>X,Y"},
		{"0>X", "1>0", "0>X"},
		{"0>", "0>X", "0>X"},
	}
	for _, val := range vals {
		var a, b ChangeSet
		a.FromDiagStr(val[0])
		b.FromDiagStr(val[1])
		res := a.Compose(&b)
		resStr := res.ToDiagStr()
		if resStr != val[2] {
			t.Errorf("Composing %v with %v yielded %v; expected %v", val[0], val[1], resStr, val[2])
		}
	}
}

func TestChangeSet_Merge(t *testing.T) {
	vals := [][]string{
		{"8>1,s,i,7", "8>1,a,x,2", "8>1,a,s,i,x"},
		{"8>0,1,s,i,7", "8>0,e,i,x,6,7", "8>0,e,i,x,s,i,7"},
		{"8>0,1,s,i,7", "8>0,e,6,o,w", "8>0,e,s,i,o,w"},
	}
	for _, val := range vals {
		var a, b ChangeSet
		a.FromDiagStr(val[0])
		b.FromDiagStr(val[1])
		res := a.Merge(&b)
		resStr := res.ToDiagStr()
		if resStr != val[2] {
			t.Errorf("Merging %v with %v yielded %v; expected %v", val[0], val[1], resStr, val[2])
		}
	}
}

func TestChangeSet_Follow(t *testing.T) {
	vals := [][]string{
		{"2>Q,0,1", "2>0,1", "3>0,1,2"},
		{"2>Q,0,1", "2>W,0,1", "3>0,W,1,2"},
		{"8>0,e,6,o,w", "8>0,1,s,i,7", "5>0,1,s,i,3,4"},
		{"8>0,1,s,i,7", "8>0,e,6,o,w", "5>0,e,2,3,o,w"},
	}
	for _, val := range vals {
		var a, b ChangeSet
		a.FromDiagStr(val[0])
		b.FromDiagStr(val[1])
		res := a.Follow(&b)
		resStr := res.ToDiagStr()
		if resStr != val[2] {
			t.Errorf("Following %v with %v yielded %v; expected %v", val[0], val[1], resStr, val[2])
		}
	}
}
