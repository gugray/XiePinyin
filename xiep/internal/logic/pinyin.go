package logic

import (
	"bufio"
	"embed"
	_ "embed"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"
)

type Pinyiner interface {
	NumToSurf(num string) string
	SurfToNum(surf string) string
	SplitSyllables(text string) []string
}

//go:embed pinyin.txt
var efs embed.FS

type syllable struct {
	text string
	vowelStart bool
}

type pinyin struct {
	sylls []syllable
	surfToNum map[string]string
	numToSurf map[string]string
}

var Pinyin Pinyiner = loadPinyin()

func loadPinyin() *pinyin {
	var p pinyin
	p.init()
	f, err := efs.Open("pinyin.txt")
	if err != nil {
		panic(fmt.Sprintf("failed to open embedded file: %v", err))
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		p.parseInputLine(scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		panic(fmt.Sprintf("failed to read embedded file: %v", err))
	}
	p.numToSurf["r"] = "r"
	p.surfToNum["r"] = "r"

	sort.Slice(p.sylls, func(i, j int) bool {
		return utf8.RuneCountInString(p.sylls[i].text) > utf8.RuneCountInString(p.sylls[j].text)
	})

	return &p
}

func (p *pinyin) init() {
	p.numToSurf = make(map[string]string)
	p.surfToNum = make(map[string]string)
}

func (p *pinyin) parseInputLine(line string) {
	if len(line) == 0 {
		return
	}
	parts := strings.Split(line, "\t")
	isVowelStart := parts[1] == "v"
	p.sylls = append(p.sylls, syllable{parts[0], isVowelStart})
	p.surfToNum[parts[1]] = parts[0];
	p.surfToNum[parts[2]] = parts[0] + "1";
	p.surfToNum[parts[3]] = parts[0] + "2";
	p.surfToNum[parts[4]] = parts[0] + "3";
	p.surfToNum[parts[5]] = parts[0] + "4";
	p.numToSurf[parts[0]] = parts[1];
	p.numToSurf[parts[0] + "1"] = parts[2];
	p.numToSurf[parts[0] + "2"] = parts[3];
	p.numToSurf[parts[0] + "3"] = parts[4];
	p.numToSurf[parts[0] + "4"] = parts[5];
}

func (p *pinyin) NumToSurf(num string) string {
	return p.numToSurf[num]
}

func (p *pinyin) SurfToNum(surf string) string {
	return p.surfToNum[surf]
}

func (p *pinyin) SplitSyllables(text string) []string {
	return []string{}
}
