package logic

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"strings"
)

type charReading struct {
	Hanzi	string `json:"hanzi"`
	Pinyin	string `json:"pinyin"`
}

type CP struct {
	pinyin *Pinyin
	readingsSimp []charReading
	readingsTrad []charReading
}

func LoadComposerFromFiles(dataDir string) *CP {
	var res CP
	res.pinyin = LoadPinyin()
	res.readingsSimp = loadCharReadings(path.Join(dataDir, "simp-map.json"))
	res.readingsTrad = loadCharReadings(path.Join(dataDir, "trad-map.json"))
	return &res
}

func LoadComposerFromString(simpJson, tradJson string) *CP {
	var res CP
	res.pinyin = LoadPinyin()
	if e := json.Unmarshal([]byte(simpJson), &res.readingsSimp); e != nil {
		panic(fmt.Sprintf("Error parsing Json: %v", e))
	}
	if e := json.Unmarshal([]byte(tradJson), &res.readingsTrad); e != nil {
		panic(fmt.Sprintf("Error parsing Json: %v", e))
	}
	return &res
}

func loadCharReadings(fnJson string) []charReading {
	f, err := os.Open(fnJson)
	if err != nil {
		panic(fmt.Sprintf("Failed to open file: %v", fnJson))
	}
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	if err != nil {
		panic(fmt.Sprintf("Failed to read file: %v", fnJson))
	}
	res := make([]charReading, 0)
	if e := json.Unmarshal(data, &res); e != nil {
		panic(fmt.Sprintf("Error parsing Json: %v", e))
	}
	return res
}

func (cp *CP) Resolve(pinyinInput string, isSimp bool) (pinyinSylls []string, readings [][]string) {
	pinyinSylls = make([]string, 0)
	readings = make([][]string, 0)
	charReadings :=  cp.readingsTrad
	if isSimp {
		charReadings = cp.readingsSimp
	}
	pinyinInputLo := strings.ToLower(pinyinInput)
	loSylls := cp.pinyin.SplitSyllables(pinyinInputLo)
	loSyllsConcat := ""
	for i, syll := range(loSylls) {
		if i != 0 {
			loSyllsConcat += " "
		}
		loSyllsConcat += syll
	}
	for _, r := range(charReadings) {
		if r.Pinyin != loSyllsConcat {
			continue
		}
		itm := make([]string, 0, 1)
		itm = append(itm, r.Hanzi)
		readings = append(readings, itm)
	}
	return
}

func (cp *CP) getOrigSylls(orig string, lo string, loSylls []string) (origSylls []string) {
	origSylls = make([]string, 0, len(loSylls))

	ix := 0
	for i := 0; i < len(loSylls); i++ {
		lo = lo[]
		ix = strings.in
	}
	int ix = 0;
	for (int i = 0; i < loSylls.Count; ++i)
	{
	ix = lo.IndexOf(loSylls[i], ix);
	string origSyll = orig.Substring(ix, loSylls[i].Length);
	ix += origSyll.Length;
	res.Add(origSyll);
	}


	return
}