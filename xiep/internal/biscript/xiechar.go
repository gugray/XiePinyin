package biscript

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
)

// Represents a single character in bilingual text.
// Hanzi is never empty. If text is a monolingual range, then Hanzi holds a singlw Latin letter.
// Pinyin is a single Hanzi's transcription, with a trailing digit for tone mark.
type XieChar struct {
	Hanzi  string `json:"hanzi"`
	Pinyin string `json:"pinyin,omitempty"`
}

// Parses a single biscriptal character from JSON, and verifies that it's well-formed.
func (xc *XieChar) UnmarshalJSON(data []byte) error {
	type xct XieChar
	t := (*xct)(xc)
	if err := json.Unmarshal(data, t); err != nil {
		return err
	}
	if utf8.RuneCountInString(xc.Hanzi) != 1 {
		return fmt.Errorf("invalid XieChar in JSON: hanzi must be exactly 1 rune: %v", xc)
	}
	return nil
}

// Lexicographically compares to a different character, for correct ordering e.g. in change set operations.
//goland:noinspection GoUnnecessarilyExportedIdentifiers
func (xc *XieChar) CompareTo(rhs *XieChar) int {
	if x := strings.Compare(xc.Hanzi, rhs.Hanzi); x != 0 {
		return x
	}
	if xc.Pinyin == rhs.Pinyin {
		return 0
	}
	if len(xc.Pinyin) == 0 {
		return 1
	}
	if len(rhs.Pinyin) == 0 {
		return -1
	}
	return strings.Compare(xc.Pinyin, rhs.Pinyin)
}

