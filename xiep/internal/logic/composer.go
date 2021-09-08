package logic

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"unicode"
)

type charReading struct {
	Hanzi	string `json:"hanzi"`
	Pinyin	string `json:"pinyin"`
}

type Composer struct {
	pinyin *Pinyin
	readingsSimp []charReading
	readingsTrad []charReading
}

func LoadComposerFromFiles(dataDir string) *Composer {
	var res Composer
	res.pinyin = LoadPinyin()
	res.readingsSimp = loadCharReadings(path.Join(dataDir, "simp-map.json"))
	res.readingsTrad = loadCharReadings(path.Join(dataDir, "trad-map.json"))
	return &res
}

func LoadComposerFromString(simpJson, tradJson string) *Composer {
	var res Composer
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

func (cp *Composer) Resolve(pinyinInput string, isSimp bool) (pinyinSylls []string, readings [][]string) {
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
	pinyinSylls = getOrigSylls(pinyinInput, pinyinInputLo, loSylls)
	return
}

func getOrigSylls(orig string, lo string, loSylls []string) (origSylls []string) {
	origSylls = make([]string, 0, len(loSylls))
	ix := 0
	for _, loSyll := range(loSylls) {
		ix += strings.Index(lo[ix:], loSyll)
		origSyll := orig[ix:ix + len(loSyll)]
		origSylls = append(origSylls, origSyll)
	}
	return
}

func (cp *Composer) PinyinNumsToSurf(pyNums string) string {
	pyNumsLo := strings.ToLower(pyNums)
	loSylls := cp.pinyin.SplitSyllables(pyNumsLo)
	var loSyllsPretty = make([]string, 0)
	for _, ls := range(loSylls) {
		pretty := cp.pinyin.NumToSurf(ls)
		if pretty == "" {
			pretty = ls
		}
		loSyllsPretty = append(loSyllsPretty, pretty)
	}
	origSylls := getOrigSylls(pyNums, pyNumsLo, loSylls)
	var sb strings.Builder
	for i, loSyllPretty := range(loSyllsPretty) {
		// Original was lower case
		if loSylls[i] == origSylls[i] {
			sb.WriteString(loSyllPretty)
			continue
		}
		// Make first letter upper case, copy rest as is
		for j, chr := range(loSyllPretty) {
			if j == 0 {
				sb.WriteRune(unicode.ToUpper(chr))
			} else {
				sb.WriteRune(chr)
			}
		}
	}
	return sb.String()
}
