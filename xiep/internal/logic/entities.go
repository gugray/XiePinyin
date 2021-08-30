package logic

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
)

type XieChar struct {
	Hanzi  string `json:"hanzi"`
	Pinyin string `json:"pinyin,omitempty"`
}

func (xc *XieChar) UnmarshalJSON(data []byte) error {
	type T XieChar
	t := (*T)(xc)
	if err := json.Unmarshal(data, t); err != nil {
		return err
	}
	if utf8.RuneCountInString(xc.Hanzi) != 1 {
		return fmt.Errorf("invalid XieChar in JSON: hanzi must be exactly 1 rune: %v", xc)
	}
	return nil
}

func (xc *XieChar) CompareTo(rhs *XieChar) int {
	if x := strings.Compare(xc.Hanzi, rhs.Hanzi); x != 0 {
		return x
	}
	if xc.Pinyin == rhs.Pinyin {
		return  0
	}
	if len(xc.Pinyin) == 0 {
		return  1
	}
	if len(rhs.Pinyin) == 0 {
		return -1
	}
	return strings.Compare(xc.Pinyin, rhs.Pinyin)
}
