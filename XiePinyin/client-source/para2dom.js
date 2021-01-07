"use strict";
var $ = require("jquery");
var pinyinMap = require("./pinyinmap");
var enc = require("js-htmlencode").htmlEncode;

const htmlEmptyPara = '<div class="para"></div>';
const htmlEmptyWord = '<div class="word"><div lang="zh-CN" class="hanzi"></div><div class="pinyin"></div></div>';

function word2elm(word, isLastWord) {
  var elm = $(htmlEmptyWord);
  for (var i = 0; i < word.lead; ++i) {
    elm.find("div.hanzi").append($("<span class='punct'>" + enc(word.lead[i].hanzi) + "</span>"));
    elm.find("div.pinyin").append($("<span class='punct'>" + enc(word.lead[i].pinyin) + "</span>"));
  }
  for (var i = 0; i < word.text.length; ++i) {
    elm.find("div.hanzi").append($("<span class='hanzi'>" + enc(word.text[i].hanzi) + "</span>"));
    elm.find("div.pinyin").append($("<span class='syll'>" + enc(pinyinMap.toDisplay(word.text[i].pinyin)) + "</span>"));
  }
  for (var i = 0; i < word.trail.length; ++i) {
    elm.find("div.hanzi").append($("<span class='punct'>" + enc(word.trail[i].hanzi) + "</span>"));
    elm.find("div.pinyin").append($("<span class='punct'>" + enc(word.trail[i].pinyin) + "</span>"));
  }
  if (!isLastWord) {
    elm.find("div.hanzi").append($("<span class='space'> </span>"));
    elm.find("div.pinyin").append($("<span class='space'> </span>"));
  }
  return elm;
}

module.exports = (function (words) {

  var elm = $(htmlEmptyPara);
  for (var i = 0; i < words.length; ++i) {
    var elmWord = word2elm(words[i], i == words.length - 1);
    elm.append(elmWord);
  }
  var elmLastWord = $(htmlEmptyWord);
  elmLastWord.find("div.hanzi").append($("<span class='fin'></span>"));
  elmLastWord.find("div.pinyin").append($("<span class='fin'></span>"));
  elm.append(elmLastWord);

  return elm;

});
