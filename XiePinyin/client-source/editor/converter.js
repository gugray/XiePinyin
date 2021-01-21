"use strict";
var $ = require("jquery");
var pinyinMap = require("./pinyinmap");
var enc = require("js-htmlencode").htmlEncode;

const htmlEmptyPara = '<div class="para"></div>';
const htmlEmptyWord = '<div class="word"><div lang="zh-CN" class="hanzi"></div><div class="pinyin"></div></div>';

function chars2words(para) {
  // If needed again: punctuation
  // .match(/\\p{IsPunctuation}/g);

  var res = [];
  var ix = 0;
  var word = { chars: [] };
  // First, eat up leading WS
  while (ix < para.length && para[ix].hanzi.match(/^\s+$/)) {
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
      word.chars.push(para[ix]);
      ++ix;
    }
    while (ix < para.length && para[ix].hanzi.match(/^\s+$/)) {
      word.chars.push(para[ix]);
      ++ix;
    }
    res.push(word);
    word = { chars: [] };
  }

  // Finish up
  if (word.chars.length > 0) res.push(word);
  return res;
}

module.exports = (function () {

  function para2dom(para) {

    var words = chars2words(para);

    var elm = $(htmlEmptyPara);

    for (var i = 0; i < words.length; ++i) {
      var word = words[i];
      var elmWord = $(htmlEmptyWord);
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

    var elmLastWord = $(htmlEmptyWord);
    elmLastWord.find("div.hanzi").append($("<span class='x fin'></span>"));
    elmLastWord.find("div.pinyin").append($("<span class='x fin'></span>"));
    elm.append(elmLastWord);

    return elm;
  }

  function dom2para(elmPara) {

    var res = [];

    var wdCount = elmPara.find("div.word").length;
    for (var i = 0; i < wdCount; ++i) {
      var elmWord = elmPara.find("div.word").eq(i);
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

    return res;
  }

  return {
    para2dom: para2dom,
    dom2para: dom2para,
  }
})();
