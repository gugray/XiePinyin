"use strict";
var $ = require("jquery");
var pinyinMap = require("./pinyinmap");
var enc = require("js-htmlencode").htmlEncode;

const kEmptyPara = '<div class="para">{words}</div>';
const kEmptyWordBi = '<div class="word"><div lang="zh-CN" class="hanzi">{hanzi}</div><div class="pinyin">{pinyin}</div></div>';
const kEmptyWordAlfa = '<div class="word alfa"><div class="hanzi">{hanzi}</div></div>';

function chars2words(para) {
  // If needed again: punctuation
  // .match(/\\p{IsPunctuation}/g);

  if (para.length == 0) return [];
  var res = [];

  var inAlfa = para[0].pinyin === undefined;
  var ix = 0;
  var word = { chars: [] };
  while (ix < para.length) {
    eatRange();
    if (word.chars.length > 0) res.push(word);
    word = { chars: [] };
    inAlfa = !inAlfa;
  }

  function eatRange() {
    // First, eat up leading WS
    while (ix < para.length && para[ix].hanzi.match(/^\s+$/)) {
      if (inAlfa && para[ix].pinyin !== undefined || !inAlfa && para[ix].pinyin === undefined) return;
      word.chars.push(para[ix]);
      ++ix;
    }
    if (word.chars.length > 0) {
      res.push(word);
      word = { chars: [] };
    }
    // Eat up words: non-WS followed by WS
    while (ix < para.length) {
      while (ix < para.length && !para[ix].hanzi.match(/^\s+$/)) {
        if (inAlfa && para[ix].pinyin !== undefined || !inAlfa && para[ix].pinyin === undefined) return;
        word.chars.push(para[ix]);
        ++ix;
      }
      while (ix < para.length && para[ix].hanzi.match(/^\s+$/)) {
        if (inAlfa && para[ix].pinyin !== undefined || !inAlfa && para[ix].pinyin === undefined) return;
        word.chars.push(para[ix]);
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

  for (var i = 0; i < words.length; ++i) {
    let word = words[i];
    // Biscriptal word
    if (word.chars[0].pinyin !== undefined) {
      let hanziHtml = "";
      let pinyinHtml = "";
      hanziHtml += "<span class='pad'>&#x200b;</span>";
      pinyinHtml += "<span class='pad'>&#x200b;</span>";
      for (var j = 0; j < word.chars.length; ++j) {
        hanziHtml += "<span class='x'>" + enc(word.chars[j].hanzi) + "</span>";
        var pyNums = word.chars[j].pinyin;
        var pyDisplay = pinyinMap.toDisplay(pyNums);
        if (j != 0 && pyNums != word.chars[j].hanzi && pinyinMap.isVowelFirst(pyNums)) pyDisplay = "'" + pyDisplay;
        pinyinHtml += "<span class='x'>" + enc(pyDisplay) + "</span>";
      }
      hanziHtml += "<span class='pad'>&#x200b;</span>";
      pinyinHtml += "<span class='pad'>&#x200b;</span>";
      let wordHtml = kEmptyWordBi.replace("{hanzi}", hanziHtml).replace("{pinyin}", pinyinHtml);
      wordsHtml += wordHtml;
    }
    // Alfa word
    else {
      let hanziHtml = "";
      for (var j = 0; j < word.chars.length; ++j) {
        hanziHtml += "<span class='x'>" + enc(word.chars[j].hanzi) + "</span>";
      }
      let wordHtml = kEmptyWordAlfa.replace("{hanzi}", hanziHtml);
      wordsHtml += wordHtml;
    }
  }

  let lastWordHtml = kEmptyWordBi;
  lastWordHtml = lastWordHtml.replace("{hanzi}", "<span class='x fin'>&#x200b;</span>");
  lastWordHtml = lastWordHtml.replace("{pinyin}", "<span class='x fin'>&#x200b;</span>");
  wordsHtml += lastWordHtml;

  let html = kEmptyPara.replace("{words}", wordsHtml);
  return $(html);
}

function text2dom(text) {
  let paras = [];
  let para = [];
  for (let i = 0; i < text.length; ++i) {
    if (text[i].hanzi == "\n") {
      paras.push(para);
      para = [];
    }
    else para.push(text[i]);
  }
  paras.push(para);
  let elms = [];
  for (let i = 0; i < paras.length; ++i) {
    elms.push(para2dom(paras[i]));
  }
  return elms;
}

function dom2para(elmPara) {

  var res = [];

  var wdCount = elmPara.find("div.word").length;
  for (var i = 0; i < wdCount; ++i) {
    var elmWord = elmPara.find("div.word").eq(i);
    // Biscriptal word
    if (!elmWord.hasClass("alfa")) {
      for (var j = 0; j < elmWord.find("div.hanzi span.x").length; ++j) {
        var elmHanzi = elmWord.find("div.hanzi span.x").eq(j);
        var elmPinyin = elmWord.find("div.pinyin span.x").eq(j);
        if (elmHanzi.hasClass("fin")) continue;
        res.push({
          hanzi: elmHanzi.text(),
          pinyin: elmPinyin.text(),
        });
      }
    }
    // Alfa word
    else {
      for (var j = 0; j < elmWord.find("div.hanzi span.x").length; ++j) {
        var elmHanzi = elmWord.find("div.hanzi span.x").eq(j);
        if (elmHanzi.hasClass("fin")) continue;
        res.push({
          hanzi: elmHanzi.text(),
        });
      }
    }
  }

  return res;
}

function dom2text(elmParas) {
  let text = [];
  for (let i = 0; i < elmParas.length; ++i) {
    let paraText = dom2para(elmParas[i]);
    if (i > 0) text.push({ hanzi: "\n", pinyin: "\n" });
    text.push(...paraText);
  }
  return text;
}


module.exports = (function () {

  return {
    text2dom,
    dom2text,
  }
})();
