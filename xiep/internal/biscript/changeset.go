package biscript

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// Represents a single selected range in biscriptal text.
type Selection struct {
	Start        int  `json:"start"`
	End          int  `json:"end"`
	CaretAtStart bool `json:"caretAtStart"`
}

// Operational transformation representing a single edit.
type ChangeSet struct {
	LengthBefore uint          `json:"lengthBefore"`
	LengthAfter  uint          `json:"lengthAfter"`
	Items        []interface{} `json:"items"`
}

// Initializes a change set as an identity transformation.
func (cs *ChangeSet) InitIdent(length uint) {
	cs.LengthBefore = length
	cs.LengthAfter = length
	cs.Items = make([]interface{}, 0, length)
	for i := (uint)(0); i < length; i++ {
		cs.Items = append(cs.Items, i)
	}
}

// Appends a range of kept characters to the change set under construction.
func (cs *ChangeSet) appendKeptRange(first, last uint) {
	if first > last {
		panic("First index of kept range cannot be larger than last")
	}
	if last+1 > cs.LengthBefore {
		panic("Kept index beyond LengthBefore")
	}
	for i := first; i <= last; i++ {
		cs.Items = append(cs.Items, i)
	}
	cs.LengthAfter = (uint)(len(cs.Items))
}

// Appends an inserted character to the change set under construction.
func (cs *ChangeSet) appendXieChar(xc XieChar) {
	cs.Items = append(cs.Items, xc)
	cs.LengthAfter = (uint)(len(cs.Items))
}

// Serializes the change set into a diagnostic string.
func (cs *ChangeSet) ToDiagStr() string {
	var sb strings.Builder
	sb.WriteString(strconv.FormatUint((uint64)(cs.LengthBefore), 10))
	sb.WriteString(">")
	for i, itm := range cs.Items {
		if i != 0 {
			sb.WriteString(",")
		}
		switch x := itm.(type) {
		case XieChar:
			if x.Hanzi == "\n" {
				sb.WriteString("\\n")
			} else {
				sb.WriteString(x.Hanzi)
			}
		case uint:
			sb.WriteString(strconv.FormatUint((uint64)(x), 10))
		default:
			panic(fmt.Sprintf("Invalid change set item: %v", x))
		}
	}
	return sb.String()
}

// Initializes the change set from a  diagnostic string.
func (cs *ChangeSet) FromDiagStr(str string) {
	markIx := strings.IndexByte(str, '>')
	if val, err := strconv.ParseUint(str[0:markIx], 10, 64); err != nil {
		return
	} else {
		cs.LengthBefore = (uint)(val)
	}
	cs.LengthAfter = 0
	cs.Items = make([]interface{}, 0)
	if markIx == len(str)-1 {
		return
	}
	parts := strings.Split(str[markIx+1:], ",")
	for _, part := range parts {
		if val, err := strconv.ParseUint(part, 10, 64); err == nil {
			if (uint)(val+1) > cs.LengthBefore {
				panic("kept index beyond LengthBefore")
			}
			cs.appendKeptRange((uint)(val), (uint)(val))
		} else {
			cs.appendXieChar(XieChar{Hanzi: part})
		}
	}
}

// Verifies that the change set is valid.
func (cs *ChangeSet) IsValid() bool {
	if cs.LengthAfter != (uint)(len(cs.Items)) {
		return false
	}
	var last uint
	seenKeptIndex := false
	for _, x := range cs.Items {
		if _, ok := x.(XieChar); ok {
			continue
		}
		val := x.(uint)
		if val < 0 || val+1 > cs.LengthBefore {
			return false
		}
		if !seenKeptIndex {
			seenKeptIndex = true
		} else if val <= last {
			return false
		}
		last = val
	}
	return true
}

// Serializes the change set into JSON.
func (cs *ChangeSet) SerializeJSON() string {
	res, err := json.Marshal(cs)
	if err != nil {
		panic("Failed to marshal change set")
	}
	return string(res)
}

// Parses a change set from JSON.
func (cs *ChangeSet) DeserializeJSON(jsonStr string) error {
	type ChangeSetEnvelope struct {
		LengthBefore uint              `json:"lengthBefore"`
		LengthAfter  uint              `json:"lengthAfter"`
		Items        []json.RawMessage `json:"items"`
	}
	var cse ChangeSetEnvelope
	if err := json.Unmarshal([]byte(jsonStr), &cse); err != nil {
		return err
	}
	cs.LengthBefore = cse.LengthBefore
	cs.LengthAfter = cse.LengthAfter
	cs.Items = make([]interface{}, 0, len(cse.Items))
	for _, itmJson := range cse.Items {
		var pos uint
		err := json.Unmarshal(itmJson, &pos)
		if err == nil {
			if pos+1 > cs.LengthBefore {
				return errors.New("invalid data: kept position beyond LengthBefore")
			}
			cs.appendKeptRange(pos, pos)
			continue
		}
		var xc XieChar
		err = xc.UnmarshalJSON(itmJson)
		if err != nil {
			return err
		}
		cs.appendXieChar(xc)
	}
	return nil
}

// Applies the change set to a biscriptal text.
func (cs *ChangeSet) Apply(text []XieChar) []XieChar {
	if cs.LengthBefore != (uint)(len(text)) {
		panic("Change set's LengthBefore must match text's length")
	}
	res := make([]XieChar, 0, cs.LengthAfter)
	for _, itm := range cs.Items {
		if pos, ok := itm.(uint); ok {
			res = append(res, text[pos])
		} else {
			res = append(res, itm.(XieChar))
		}
	}
	return res
}

// Forwards character positions to the values after applying the change set.
func (cs *ChangeSet) ForwardPositions(poss []uint) {
	pp := make([]int, 0, len(poss))
	for _, x := range poss {
		pp = append(pp, (int)(x))
	}
	var length uint = 0
	for _, itm := range cs.Items {
		if _, ok := itm.(XieChar); ok {
			length++
			continue
		}
		ix := (int)(itm.(uint))
		for j := range pp {
			if pp[j] == -1 {
				continue
			} else if ix+1 == pp[j] {
				poss[j] = length + 1
				pp[j] = -1
			} else if ix >= pp[j] {
				poss[j] = length
				pp[j] = -1
			}
		}
		length++
	}
	for j := range pp {
		if pp[j] != -1 {
			poss[j] = length
		}
	}
}

// Creates a change set that is equivalent to the current one, followed by "b".
func (cs *ChangeSet) Compose(b *ChangeSet) *ChangeSet {
	if cs.LengthAfter != b.LengthBefore {
		panic("LengthAfter of LHS must equal LengthBefore of RHS")
	}
	var res ChangeSet
	res.LengthBefore = cs.LengthBefore
	res.LengthAfter = b.LengthAfter
	res.Items = make([]interface{}, 0, res.LengthAfter)
	for _, bItm := range b.Items {
		if xc, ok := bItm.(XieChar); ok {
			res.Items = append(res.Items, xc)
		} else {
			ix := bItm.(uint)
			res.Items = append(res.Items, cs.Items[ix])
		}
	}
	return &res
}

// Merges this change set with "b".
func (cs *ChangeSet) Merge(b *ChangeSet) *ChangeSet {
	if cs.LengthBefore != b.LengthBefore {
		panic("change sets must have same LengthBefore")
	}
	var res ChangeSet
	res.LengthBefore = cs.LengthBefore
	ixa := 0
	ixb := 0
	for ; ixa < len(cs.Items) || ixb < len(b.Items); {
		if ixa == len(cs.Items) {
			if _, ok := b.Items[ixb].(XieChar); ok {
				res.Items = append(res.Items, b.Items[ixb])
			}
			ixb++
			continue
		}
		if ixb == len(b.Items) {
			if _, ok := cs.Items[ixa].(XieChar); ok {
				res.Items = append(res.Items, cs.Items[ixa])
			}
			ixa++
			continue
		}
		// We got stuff in both
		ca, aIsChar := cs.Items[ixa].(XieChar)
		cb, bIsChar := b.Items[ixb].(XieChar)
		// Both are kept characters: sync up position, and keep what's kept in both
		if !aIsChar && !bIsChar {
			vala := cs.Items[ixa].(uint)
			valb := b.Items[ixb].(uint)
			if vala == valb {
				res.Items = append(res.Items, vala)
				ixa++
				ixb++
			} else if vala < valb {
				ixa++
			} else {
				ixb++
			}
			continue
		}
		// Both are insertions: insert both, in lexicographical order (so merge is commutative)
		if aIsChar && bIsChar {
			if ca.CompareTo(&cb) < 0 {
				res.Items = append(res.Items, ca)
				res.Items = append(res.Items, cb)
			} else {
				res.Items = append(res.Items, cb)
				res.Items = append(res.Items, ca)
			}
			ixa++
			ixb++
			continue
		}
		// If only one is an insertion, keep that, and advance in that changeset
		if aIsChar {
			res.Items = append(res.Items, ca)
			ixa++
		} else {
			res.Items = append(res.Items, cb)
			ixb++
		}
	}
	res.LengthAfter = uint(len(res.Items))
	return &res
}

// Follows this change set with "b".
func (cs *ChangeSet) Follow(b *ChangeSet) *ChangeSet {
	if cs.LengthBefore != b.LengthBefore {
		panic("change sets must have same LengthBefore")
	}
	var res ChangeSet
	res.LengthBefore = cs.LengthAfter
	ixa := 0
	ixb := 0
	for ; ixa < len(cs.Items) || ixb < len(b.Items); {
		if ixa == len(cs.Items) {
			// Insertions in B become insertions
			if _, ok := b.Items[ixb].(XieChar); ok {
				res.Items = append(res.Items, b.Items[ixb])
			}
			ixb++
			continue
		}
		if ixb == len(b.Items) {
			// Insertions in A become retained characters
			if _, ok := cs.Items[ixa].(XieChar); ok {
				res.Items = append(res.Items, uint(ixa))
			}
			ixa++
			continue
		}
		// We got stuff in both
		_, aIsChar := cs.Items[ixa].(XieChar)
		_, bIsChar := b.Items[ixb].(XieChar)
		// Both are kept characters: sync up position, and keep what's kept in both
		if !aIsChar && !bIsChar {
			vala := cs.Items[ixa].(uint)
			valb := b.Items[ixb].(uint)
			if vala == valb {
				res.Items = append(res.Items, uint(ixa))
				ixa++
				ixb++
			} else if vala < valb {
				ixa++
			} else {
				ixb++
			}
			continue
		}
		if aIsChar {
			// Insertions in A become retained characters
			res.Items = append(res.Items, uint(ixa))
			ixa++
			continue
		} else {
			// Insertions in B become insertions
			res.Items = append(res.Items, b.Items[ixb])
			ixb++
			continue
		}
	}
	res.LengthAfter = uint(len(res.Items))
	return &res
}
