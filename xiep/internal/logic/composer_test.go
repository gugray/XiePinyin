package logic

import (
	"testing"
)

func TestComposerLoadFull(t *testing.T) {
	LoadComposerFromFiles("../../web/static/")
}

func TestComposerResolve(t *testing.T) {
	type Itm struct {
		Pinyin string
		IsSimp bool
		Readings []string
	}
	vals := []Itm {
		{"jing1", true, []string {"经", "精"}},
		{"jing1", false, []string {"經", "精"}},
		{"shu1zi", true, []string {"叔 子", "梳 子"}},
	}
	c := LoadComposerFromString(simpMapJson, tradMapJson)
	for _, val := range(vals) {
		_, readings := c.Resolve(val.Pinyin, val.IsSimp)
		if len(readings) != len(val.Readings) {
			t.Errorf("Wrong number of readings for %v", val.Pinyin)
			continue
		}
		sameReadings := true
		for i := 0; i < len(readings) && sameReadings; i++ {
			if readings[i][0] != val.Readings[i] {
				sameReadings = false
			}
		}
		if !sameReadings {
			t.Errorf("Readings are different, or not in the same order, for %v",val.Pinyin)
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

