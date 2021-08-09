package logic

import (
	"testing"
)

func TestPinyinParseInputLine(t *testing.T) {
	lines := []string {
		"an\tan\tān\tán\tǎn\tàn",
		"ba\tba\tbā\tbá\tbǎ\tbà",
		"bang\tbang\tbāng\tbáng\tbǎng\tbàng",
	}
	var p pinyin
	p.init()
	p.parseInputLine(lines[0])
	p.parseInputLine(lines[1])
	ok := true
	ok = ok && p.numToSurf["an4"] == "àn"
	ok = ok && p.numToSurf["ba3"] == "bǎ"
	ok = ok && p.numToSurf["an2"] == "án"
	ok = ok && p.numToSurf["ba1"] == "bā"
	ok = ok && p.numToSurf["an"] == "an"
	if !ok {
		t.Errorf("pinyin map failed to parse input correctly")
	}
}

func TestPinyinSurfNum(t *testing.T) {
	vals := []struct {
		num string
		surf string
	} {
		{"bang", "bang"},
		{"chuai1", "chuāi"},
		{"xyz", ""},
		{"", "jāi"},
	}
	for _, val := range(vals) {
		if (len(val.num) != 0) {
			if gotSurf := Pinyin.NumToSurf(val.num); gotSurf != val.surf {
				t.Errorf("failed NumToSurf for %v: got %v, expected %v", val.num, gotSurf, val.surf)
			}
		}
		if (len(val.surf) != 0) {
			if gotNum := Pinyin.SurfToNum(val.surf); gotNum != val.num {
				t.Errorf("failed SurfToNum for %v: got %v, expected %v", val.surf, gotNum, val.num)
			}
		}
	}
}

func checkSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, x := range(a) {
		if b[i] != x {
			return  false
		}
	}
	return true
}

func TestPinyinSplitBySyllables(t *testing.T) {
	type Itm struct {
		word string
		sylls []string
	}
	vals := []Itm {
		{word: "", sylls: []string{}},
		{word: "xyz", sylls: []string{"xyz"}},
		{word: "da2an4", sylls: []string{"da2", "an4"}},
		{word: "di4-yi1", sylls: []string{"di4", "-", "yi1"}},
	}
	for _, val := range(vals) {
		res := Pinyin.SplitSyllables(val.word)
		if !checkSlicesEqual(res, val.sylls) {
			t.Errorf("wrong split for %v: got %v, expected %v", val.word, res, val.sylls)
		}
	}
}
