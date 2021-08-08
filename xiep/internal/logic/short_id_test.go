package logic

import (
	"testing"
)

func TestShortIdString(t *testing.T) {
	vals := []struct{
		x uint32
		id string
	} {
		{2534041626, "s02kC9M"},
	}
	for _, val := range(vals) {
		if id := makeShortIdString(val.x); id != val.id {
			t.Errorf("from %v got id %v; expected %v", val.x, id, val.id)
		}
	}
}
