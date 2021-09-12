package docx

import (
	"archive/zip"
	"bytes"
	"embed"
	_ "embed"
	"io/ioutil"
	"os"
	"strings"
	"unicode"
	"xiep/internal/biscript"
)

//go:embed skeleton-document.xml
var skDocument string

//go:embed skeleton-paragraph.xml
var skPara string

//go:embed skeleton-rubyword.xml
var skRubyWord string

//go:embed skeleton-text.xml
var skText string

//go:embed styles.xml
var skStyles string

//go:embed template.docx
var efs embed.FS

type pinyiner interface {
	PinyinNumsToSurf(pyNums string) string
}

// Exports the received text as a DOCX file, saved as fname.
func Export(text []biscript.XieChar, fname string, pinyiner pinyiner) error {
	paras := textToParas(text)
	docXml := makeDocXml(paras, pinyiner)
	return makeZip(fname, docXml)
}

func makeZip(fname string, docXml string) error {
	// We basically copy the embedded DOCX into our output file by file
	// Except, for the document XML, we slot in our own
	fIn, err := efs.Open("template.docx")
	if err != nil {
		return err
	}
	//goland:noinspection GoUnhandledErrorResult
	defer fIn.Close()
	bytesIn, err := ioutil.ReadAll(fIn)
	if err != nil {
		return err
	}
	zipReader, err := zip.NewReader(bytes.NewReader(bytesIn), int64(len(bytesIn)))
	if err != nil {
		return err
	}
	outBuf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(outBuf)

	// Read all the files from zip archive
	for _, zipFileIn := range zipReader.File {
		//fmt.Println("Reading file:", zipFileIn.Name)
		rawBytes, err := readZipFile(zipFileIn)
		if err != nil {
			return err
		}
		zipFileOut, err := zipWriter.Create(zipFileIn.Name)
		if err != nil {
			return err
		}
		// word/document.xml
		// word/styles.xml
		if zipFileIn.Name == "word/document.xml" {
			rawBytes = []byte(docXml)
		} else if zipFileIn.Name == "word/styles.xml" {
			rawBytes = []byte(skStyles)
		}
		_, err = zipFileOut.Write(rawBytes)
		if err != nil {
			return err
		}
	}
	// This is a byte buffer, not expecting an error here
	//goland:noinspection GoUnhandledErrorResult
	zipWriter.Close()
	// Now write bytes to file
	fOut, err := os.Create(fname)
	if err != nil {
		return err
	}
	_, err = fOut.Write(outBuf.Bytes())
	if err != nil {
		_ = fOut.Close()
		return err
	}
	err = fOut.Close()
	if err != nil {
		return err
	}
	// Looks like we're good.
	return nil
}

func readZipFile(zf *zip.File) ([]byte, error) {
	f, err := zf.Open()
	if err != nil {
		return nil, err
	}
	// Read-only file, no error checking needed.
	//goland:noinspection GoUnhandledErrorResult
	defer f.Close()
	return ioutil.ReadAll(f)
}

type biWord struct {
	hanzi  string
	pinyin string
}

func (w biWord) isEmpty() bool {
	return w.hanzi == "" && w.pinyin == ""
}

func isNonEmptyWS(str string) bool {
	if str == "" {
		return false
	}
	for _, r := range str {
		if !unicode.IsSpace(r) {
			return false
		}
	}
	return true
}

func makeWords(para []biscript.XieChar, pinyiner pinyiner) []biWord {
	var res []biWord
	if len(para) == 0 {
		return res
	}
	inAlpha := para[0].Pinyin == ""
	ix := 0
	var word biWord
	for ix < len(para) {
		// First, eat up leading WS
		for ix < len(para) && isNonEmptyWS(para[ix].Hanzi) {
			if inAlpha && para[ix].Pinyin != "" || !inAlpha && para[ix].Pinyin == "" {
				goto wordOver
			}
			word.pinyin += " "
			ix++
		}
		if !word.isEmpty() {
			res = append(res, word)
			word = biWord{}
		}
		// Eat up words: non-WS followed by WS
		for ix < len(para) && !isNonEmptyWS(para[ix].Hanzi) {
			if inAlpha && para[ix].Pinyin != "" || !inAlpha && para[ix].Pinyin == "" {
				goto wordOver
			}
			if !inAlpha {
				word.hanzi += para[ix].Hanzi
				word.pinyin += para[ix].Pinyin
			} else {
				word.pinyin += para[ix].Hanzi
			}
			ix++
		}
		for ix < len(para) && isNonEmptyWS(para[ix].Hanzi) {
			if inAlpha && para[ix].Pinyin != "" || !inAlpha && para[ix].Pinyin == "" {
				goto wordOver
			}
			word.pinyin += " "
			ix++
		}
		res = append(res, word)
		word = biWord{}

	wordOver:
		if !word.isEmpty() {
			res = append(res, word)
		}
		word = biWord{}
		inAlpha = !inAlpha
	}
	// Convert Pinyin in biscriptal words to pretty accents
	for ix, w := range res {
		if w.pinyin == "" || w.hanzi == "" {
			continue
		}
		res[ix].pinyin = pinyiner.PinyinNumsToSurf(w.pinyin)
	}
	// Done
	return res
}

func esc(str string) string {
	var sb strings.Builder
	sb.Grow(len(str))
	for _, c := range str {
		if c == '&' {
			sb.WriteString("&amp;")
		} else if c == '<' {
			sb.WriteString("&lt;")
		} else if c == '>' {
			sb.WriteString("&gt;")
		} else {
			sb.WriteRune(c)
		}
	}
	return sb.String()
}

func makeParaXml(para []biscript.XieChar, pinyiner pinyiner) string {
	words := makeWords(para, pinyiner)
	var sb strings.Builder
	for _, w := range words {
		if w.hanzi == "" {
			sb.WriteString(strings.ReplaceAll(skText, "<!-- TEXT -->", esc(w.pinyin)))
		} else {
			txt := strings.ReplaceAll(skRubyWord, "<!-- HANZI -->", esc(w.hanzi))
			txt = strings.ReplaceAll(txt, "<!-- PINYIN -->", esc(w.pinyin))
			sb.WriteString(txt)
		}
	}
	return sb.String()
}

func makeDocXml(paras [][]biscript.XieChar, pinyiner pinyiner) string {
	var sb strings.Builder
	for _, para := range paras {
		textStr := makeParaXml(para, pinyiner)
		paraStr := skPara
		paraStr = strings.ReplaceAll(paraStr, "<!-- TEXT -->", textStr)
		sb.WriteString(paraStr)
	}
	res := strings.ReplaceAll(skDocument, "<!-- CONTENT -->", sb.String())
	return res
}

func textToParas(text []biscript.XieChar) [][]biscript.XieChar {
	var res [][]biscript.XieChar
	var currPara []biscript.XieChar
	for _, xc := range text {
		if xc.Hanzi != "\n" {
			currPara = append(currPara, xc)
		} else {
			res = append(res, currPara)
			currPara = make([]biscript.XieChar, 0)
		}
	}
	if len(currPara) != 0 {
		res = append(res, currPara)
	}
	return res
}
