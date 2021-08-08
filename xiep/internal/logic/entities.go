package logic

import (
	"encoding/json"
	"fmt"
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
