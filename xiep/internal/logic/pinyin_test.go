package logic

import (
	"testing"
)

func TestPinyinParseInputLine(t *testing.T) {
	lines := []string{
		"an\tan\tān\tán\tǎn\tàn",
		"ba\tba\tbā\tbá\tbǎ\tbà",
		"bang\tbang\tbāng\tbáng\tbǎng\tbàng",
	}
	var p pinyin
	p.init()
	p.parseInputLine(lines[0])
	p.parseInputLine(lines[1])
	ok := true
	ok = ok && p.num2SurfMap["an4"] == "àn"
	ok = ok && p.num2SurfMap["ba3"] == "bǎ"
	ok = ok && p.num2SurfMap["an2"] == "án"
	ok = ok && p.num2SurfMap["ba1"] == "bā"
	ok = ok && p.num2SurfMap["an"] == "an"
	if !ok {
		t.Errorf("pinyin map failed to parse input correctly")
	}
}

func TestPinyinSurfNum(t *testing.T) {
	vals := []struct {
		num  string
		surf string
	}{
		{"bang", "bang"},
		{"chuai1", "chuāi"},
		{"xyz", ""},
		{"", "jāi"},
	}
	p := loadPinyin()
	for _, val := range vals {
		if len(val.num) != 0 {
			if gotSurf := p.numToSurf(val.num); gotSurf != val.surf {
				t.Errorf("failed numToSurf for %v: got %v, expected %v", val.num, gotSurf, val.surf)
			}
		}
		if len(val.surf) != 0 {
			if gotNum := p.surfToNum(val.surf); gotNum != val.num {
				t.Errorf("failed surfToNum for %v: got %v, expected %v", val.surf, gotNum, val.num)
			}
		}
	}
}

func checkSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, x := range a {
		if b[i] != x {
			return false
		}
	}
	return true
}

func TestPinyinSplitBySyllables(t *testing.T) {
	type Itm struct {
		word  string
		sylls []string
	}
	vals := []Itm{
		{word: "", sylls: []string{}},
		{word: "xyz", sylls: []string{"xyz"}},
		{word: "da2an4", sylls: []string{"da2", "an4"}},
		{word: "di4-yi1", sylls: []string{"di4", "-", "yi1"}},
	}
	p := loadPinyin()
	for _, val := range vals {
		res := p.splitSyllables(val.word)
		if !checkSlicesEqual(res, val.sylls) {
			t.Errorf("wrong split for %v: got %v, expected %v", val.word, res, val.sylls)
		}
	}
}
