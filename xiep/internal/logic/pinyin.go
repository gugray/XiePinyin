package logic

import (
	"bufio"
	"embed"
	_ "embed"
	"fmt"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

//go:embed pinyin.txt
var efs embed.FS

type syllable struct {
	text       string
	vowelStart bool
}

type pinyin struct {
	sylls       []syllable
	surf2NumMap map[string]string
	num2SurfMap map[string]string
}

func loadPinyin() *pinyin {
	var p pinyin
	p.init()
	f, err := efs.Open("pinyin.txt")
	if err != nil {
		panic(fmt.Sprintf("failed to open embedded file: %v", err))
	}
	//goland:noinspection GoUnhandledErrorResult
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		p.parseInputLine(scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		panic(fmt.Sprintf("failed to read embedded file: %v", err))
	}
	p.num2SurfMap["r"] = "r"
	p.surf2NumMap["r"] = "r"

	sort.Slice(p.sylls, func(i, j int) bool {
		return utf8.RuneCountInString(p.sylls[i].text) > utf8.RuneCountInString(p.sylls[j].text)
	})

	return &p
}

func (p *pinyin) init() {
	p.num2SurfMap = make(map[string]string)
	p.surf2NumMap = make(map[string]string)
}

func (p *pinyin) parseInputLine(line string) {
	if len(line) == 0 {
		return
	}
	parts := strings.Split(line, "\t")
	isVowelStart := parts[1] == "v"
	p.sylls = append(p.sylls, syllable{parts[0], isVowelStart})
	p.surf2NumMap[parts[1]] = parts[0]
	p.surf2NumMap[parts[2]] = parts[0] + "1"
	p.surf2NumMap[parts[3]] = parts[0] + "2"
	p.surf2NumMap[parts[4]] = parts[0] + "3"
	p.surf2NumMap[parts[5]] = parts[0] + "4"
	p.num2SurfMap[parts[0]] = parts[1]
	p.num2SurfMap[parts[0]+"1"] = parts[2]
	p.num2SurfMap[parts[0]+"2"] = parts[3]
	p.num2SurfMap[parts[0]+"3"] = parts[4]
	p.num2SurfMap[parts[0]+"4"] = parts[5]
}

func (p *pinyin) numToSurf(num string) string {
	return p.num2SurfMap[num]
}

func (p *pinyin) surfToNum(surf string) string {
	return p.surf2NumMap[surf]
}

func (p *pinyin) matchSylls(str string, pos int, ends *[]int) bool {
	// Reach end of string: good
	if pos == len(str) {
		return true
	}
	// Get rest of string to match
	rest := str[pos:]
	// Try all syllables in syllabary
	for _, ps := range p.sylls {
		// Syllables starting with a vowel not allowed inside text
		if pos != 0 && ps.vowelStart {
			continue
		}
		// Find matching syllable
		if strings.HasPrefix(rest, ps.text) {
			endPos := pos + len(ps.text)
			// We have a tone mark (digit 1-5) after syllable: got to skip that
			if len(rest) > len(ps.text) {
				nextChr := rest[len(ps.text)]
				if nextChr >= '1' && nextChr <= '5' {
					endPos++
				}
			}
			// Record end of syllable
			*ends = append(*ends, endPos)
			// If rest matches, we're done
			if p.matchSylls(str, endPos, ends) {
				return true
			}
			// Otherwise, backtrack, move on to next syllable
			*ends = (*ends)[:len(*ends)-1]
		}
	}
	// Punctuation: treat as separate syllables
	if len(rest) > 0 {
		nextRune, n := utf8.DecodeRuneInString(rest)
		if unicode.IsPunct(nextRune) {
			endPos := pos + n
			// Record end of syllable
			*ends = append(*ends, endPos)
			// If rest matches, we're done
			if p.matchSylls(str, endPos, ends) {
				return true
			}
			// Otherwise, backtrack, move on to next syllable
			*ends = (*ends)[:len(*ends)-1]
		}
	}
	// If we're here, failed to resolve syllables
	return false
}

func (p *pinyin) splitSyllables(text string) (res []string) {
	res = []string{}
	// Sanity check
	if len(text) == 0 {
		return
	}
	// Ending positions of syllables
	ends := make([]int, 0)
	// Recursive matching
	p.matchSylls(text, 0, &ends)
	// Failed to match: return original string in one
	if len(ends) == 0 {
		res = append(res, text)
		return
	}
	// Split at calculated position
	i := 0
	for _, j := range ends {
		res = append(res, text[i:j])
		i = j
	}
	return
}
