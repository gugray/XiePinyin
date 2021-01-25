"use strict";
var $ = require("jquery");
var pinyinMap = require("./pinyinmap");
var enc = require("js-htmlencode").htmlEncode;

const htmlEmptyPara = '<div class="para"></div>';
const htmlEmptyWordBi = '<div class="word"><div lang="zh-CN" class="hanzi"></div><div class="pinyin"></div></div>';
const htmlEmptyWordAlfa = '<div class="word alfa"><div class="hanzi"></div></div>';

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

  var words = chars2words(para);

  var elm = $(htmlEmptyPara);

  for (var i = 0; i < words.length; ++i) {
    var word = words[i];
    // Biscriptal word
    if (word.chars[0].pinyin !== undefined) {
      var elmWord = $(htmlEmptyWordBi);
      elmWord.find("div.hanzi").append($("<span class='pad'>&#x200b;</span>"));
      elmWord.find("div.pinyin").append($("<span class='pad'>&#x200b;</span>"));
      for (var j = 0; j < word.chars.length; ++j) {
        elmWord.find("div.hanzi").append($("<span class='x'>" + enc(word.chars[j].hanzi) + "</span>"));
        var pyDisplay = pinyinMap.toDisplay(word.chars[j].pinyin);
        elmWord.find("div.pinyin").append($("<span class='x'>" + enc(pyDisplay) + "</span>"));
      }
      elmWord.find("div.hanzi").append($("<span class='pad'>&#x200b;</span>"));
      elmWord.find("div.pinyin").append($("<span class='pad'>&#x200b;</span>"));
      elm.append(elmWord);
    }
    // Alfa word
    else {
      var elmWord = $(htmlEmptyWordAlfa);
      for (var j = 0; j < word.chars.length; ++j) {
        elmWord.find("div.hanzi").append($("<span class='x'>" + enc(word.chars[j].hanzi) + "</span>"));
      }
      elm.append(elmWord);
    }
  }

  var elmLastWord = $(htmlEmptyWordBi);
  elmLastWord.find("div.hanzi").append($("<span class='x fin'>&#x200b;</span>"));
  elmLastWord.find("div.pinyin").append($("<span class='x fin'>&#x200b;</span>"));
  elm.append(elmLastWord);

  return elm;
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
