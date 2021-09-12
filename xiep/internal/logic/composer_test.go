package logic

import (
	"testing"
)

func TestComposerLoadFull(t *testing.T) {
	loadComposerFromFiles("../../web/static/")
}

func TestComposerPinyinNumsToSurf(t *testing.T) {
	vals := [][]string {
		{"shu1zi", "shūzi"},
		{"Bei3jing1", "Běijīng"},
		{"Őz", "Őz"},
		//{"wei4r", "wèir"}, // Feature
		//{"da2an4", "dá'àn"}, // Feature
	}
	c := loadComposerFromString(simpMapJson, tradMapJson)
	for _, val := range(vals) {
		surf := c.pinyinNumsToSurf(val[0])
		if surf != val[1] {
			t.Errorf("Wrong surface form for %v: exected %v, got %v", val[0], val[1], surf)
		}
	}
}

func TestComposerResolve(t *testing.T) {
	type Itm struct {
		Pinyin string
		IsSimp bool
		Sylls []string
		Readings []string
	}
	vals := []Itm {
		{"jing1", true, []string {"jing1"}, []string {"经", "精"}},
		{"jing1", false, []string {"jing1"}, []string {"經", "精"}},
		{"shu1zi", true, []string {"shu1", "zi"}, []string {"叔 子", "梳 子"}},
		{"Shu1zi", true, []string {"Shu1", "zi"}, []string {"叔 子", "梳 子"}},
	}
	c := loadComposerFromString(simpMapJson, tradMapJson)
	for _, val := range(vals) {
		sylls, readings := c.Resolve(val.Pinyin, val.IsSimp)
		if len(readings) != len(val.Readings) {
			t.Errorf("Wrong number of readings for %v", val.Pinyin)
			continue
		}
		if len(sylls) != len(val.Sylls) {
			t.Errorf("Wrong number of syllables for %v", val.Pinyin)
			continue
		}
		sameReadings := true
		for i := 0; i < len(readings); i++ {
			if readings[i][0] != val.Readings[i] {
				sameReadings = false
			}
		}
		if !sameReadings {
			t.Errorf("Readings are different, or not in the same order, for %v",val.Pinyin)
		}
		sameSylls := true
		for i := 0; i < len(sylls); i++ {
			if sylls[i] != val.Sylls[i] {
				sameSylls = false
			}
		}
		if !sameSylls {
			t.Errorf("Syllables are different for %v",val.Pinyin)
		}
	}
}

var simpMapJson = `
[
  {
    "hanzi": "经",
    "pinyin": "jing1"
  },
  {
    "hanzi": "精",
    "pinyin": "jing1"
  },
  {
    "hanzi": "叔 子",
    "pinyin": "shu1 zi"
  },
  {
    "hanzi": "梳 子",
    "pinyin": "shu1 zi"
  }
]
`

var tradMapJson = `
[
  {
    "hanzi": "經",
    "pinyin": "jing1"
  },
  {
    "hanzi": "精",
    "pinyin": "jing1"
  },
  {
    "hanzi": "叔 子",
    "pinyin": "shu1 zi"
  },
  {
    "hanzi": "梳 子",
    "pinyin": "shu1 zi"
  }
]
`

