"use strict";
var $ = require("jquery");
var pinyinMap = require("./pinyinmap");
var enc = require("js-htmlencode").htmlEncode;
var { ParaIndex, ParaIndexItem } = require("./paraindex");

const kEmptyPara = '<div class="para">{words}</div>';
const kEmptyWordBi = '<div class="word"><div lang="zh-CN" class="hanzi">{hanzi}</div><div class="pinyin">{pinyin}</div></div>';
const kEmptyWordAlfa = '<div class="word alfa"><div class="hanzi">{hanzi}</div></div>';

function chars2words(para) {
  // If needed again: punctuation
  // .match(/\\p{IsPunctuation}/g);

  const chars = para.text;
  if (chars.length == 0) return [];
  var res = [];

  var inAlfa = chars[0].pinyin === undefined;
  var ix = 0;
  var word = { chars: [] };
  while (ix < chars.length) {
    eatRange();
    if (word.chars.length > 0) res.push(word);
    word = { chars: [] };
    inAlfa = !inAlfa;
  }

  function eatRange() {
    // First, eat up leading WS
    while (ix < chars.length && chars[ix].hanzi.match(/^\s+$/)) {
      if (inAlfa && chars[ix].pinyin !== undefined || !inAlfa && chars[ix].pinyin === undefined) return;
      word.chars.push(chars[ix]);
      ++ix;
    }
    if (word.chars.length > 0) {
      res.push(word);
      word = { chars: [] };
    }
    // Eat up words: non-WS followed by WS
    while (ix < chars.length) {
      while (ix < chars.length && !chars[ix].hanzi.match(/^\s+$/)) {
        if (inAlfa && chars[ix].pinyin !== undefined || !inAlfa && chars[ix].pinyin === undefined) return;
        word.chars.push(chars[ix]);
        ++ix;
      }
      while (ix < chars.length && chars[ix].hanzi.match(/^\s+$/)) {
        if (inAlfa && chars[ix].pinyin !== undefined || !inAlfa && chars[ix].pinyin === undefined) return;
        word.chars.push(chars[ix]);
        ++ix;
      }
      res.push(word);
      word = { chars: [] };
    }
  }
  return res;
}

function para2dom(para) {

  let words = chars2words(para);
  let wordsHtml = "";
  let charIx = 0;

  for (var i = 0; i < words.length; ++i) {
    let word = words[i];
    // Biscriptal word
    if (word.chars[0].pinyin !== undefined) {
      let hanziHtml = "";
      let pinyinHtml = "";
      hanziHtml += makeSpanPad(charIx);
      pinyinHtml += makeSpanPad(charIx);
      for (var j = 0; j < word.chars.length; ++j, ++charIx) {
        hanziHtml += makeSpanX(word.chars[j].hanzi, charIx, false);
        var pyNums = word.chars[j].pinyin;
        var pyDisplay = pinyinMap.toDisplay(pyNums);
        if (j != 0 && pyNums != word.chars[j].hanzi && pinyinMap.isVowelFirst(pyNums)) pyDisplay = "'" + pyDisplay;
        pinyinHtml += makeSpanX(pyDisplay, charIx, false);
      }
      hanziHtml += makeSpanPad(charIx);
      pinyinHtml += makeSpanPad(charIx);
      let wordHtml = kEmptyWordBi.replace("{hanzi}", hanziHtml).replace("{pinyin}", pinyinHtml);
      wordsHtml += wordHtml;
    }
    // Alfa word
    else {
      let hanziHtml = "";
      for (var j = 0; j < word.chars.length; ++j, ++charIx) {
        hanziHtml += makeSpanX(word.chars[j].hanzi, charIx, false);
      }
      let wordHtml = kEmptyWordAlfa.replace("{hanzi}", hanziHtml);
      wordsHtml += wordHtml;
    }
  }

  let lastWordHtml = kEmptyWordBi;
  lastWordHtml = lastWordHtml.replace("{hanzi}", makeSpanX(null, charIx, true));
  lastWordHtml = lastWordHtml.replace("{pinyin}", makeSpanX(null, charIx, true));
  wordsHtml += lastWordHtml;

  let html = kEmptyPara.replace("{words}", wordsHtml);
  return $(html);

  function makeSpanX(text, charIx, isFin) {
    const cls = isFin ? "x fin" : "x";
    const txt = isFin ? "&#x200b;" : enc(text);
    const res =
      "<span class='" + cls + " ix" + charIx.toString() + "'>" +
      txt +
      "</span>";
    return res;
  }

  function makeSpanPad(charIx) {
    return "<span class='pad ix" + charIx.toString() + "'>&#x200b;</span>";
  }
}

function text2dom(text) {
  const index = new ParaIndex();
  let para = [];

  let startPos = 0;
  for (let i = 0; i < text.length; ++i) {
    if (text[i].hanzi == "\n") {
      index.paras.push(new ParaIndexItem(startPos, para));
      startPos = i + 1;
      para = [];
    }
    else para.push(text[i]);
  }
  index.paras.push(new ParaIndexItem(startPos, para));

  for (let i = 0, startPos = 0; i < index.paras.length; ++i) {
    if (startPos != index.paras[i].startPos) throw "startPos mismatch";
    index.paras[i].elm = para2dom(index.paras[i]);
    startPos += index.paras[i].text.length + 1;
  }
  return index;
}

module.exports = (function () {

  return {
    para2dom,
    text2dom,
  }
})();
