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

module.exports = (function () {

  function para2dom(words) {
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
  }

  function dom2para(elmPara, selStart, selEnd) {
    var res = {
      words: [],
      selStartWordIx: -1,
      selStartWordPos: 0,
      selEndWordIx: -1,
      selEndWordPos: 0,
    };

    var wdCount = elmPara.find("div.word").length;
    var wdIx = 0;
    var domIx = 0;
    for (var i = 0; i < wdCount; ++i) {
      // Iterate over words
      var elmWord = elmPara.find("div.word:nth-child(" + (i + 1) + ")");
      var wdPos = 0;
      var word = {
        lead: [],
        text: [],
        trail: [],
      };
      var pastLead = false;
      for (var j = 0; j < elmWord.find("div.hanzi span").length; ++j) {
        // Administer selection
        if (domIx == selStart) {
          res.selStartWordIx = wdIx;
          res.selStartWordPos = wdPos;
        }
        if (domIx == selEnd) {
          res.selEndWordIx = wdIx;
          res.selEndWordPos = wdPos;
        }
        // Iterative over hanz + pinyin 
        var elmHanzi = elmWord.find("div.hanzi span:nth-child(" + (j + 1) + ")");
        var elmPinyin = elmWord.find("div.pinyin span:nth-child(" + (j + 1) + ")");
        // We're in leading punctuation
        if (!pastLead && elmHanzi.hasClass("punct")) {
          word.lead.push({
            hanzi: elmHanzi.text(),
            pinyin: elmPinyin.text(),
          });
        }
        // We're in text, or entering now
        else if (elmHanzi.hasClass("hanzi")) {
          pastLead = true;
          word.text.push({
            hanzi: elmHanzi.text(),
            pinyin: elmPinyin.text(),
          });
        }
        // We're in trailing punctuation
        else if (elmHanzi.hasClass("punct")) {
          word.trail.push({
            hanzi: elmHanzi.text(),
            pinyin: elmPinyin.text(),
          });
        }
        // Can also be "space" or "fin"
        // Keep track of position in word
        ++domIx;
        ++wdPos;
      }
      if (word.lead.length + word.text.length + word.trail.length > 0)
        res.words.push(word);
      // Keep track of word index
      ++wdIx;
    }

    return res;
  }

  function tokenizeWord(hanzi, pinyin) {
    var word = {
      lead: [],
      text: [],
      trail: [],
    }
    var i;
    for (i = 0; i < hanzi.length; ++i) {
      var isPun = hanzi[i].match(/\\p{IsPunctuation}/g);
      if (!isPun) break;
      word.lead.push({ hanzi: hanzi[i], pinyin: pinyin[i] });
    }
    var j;
    for (j = hanzi.length - 1; j >= 0 && j >= i; --j) {
      var isPun = hanzi[i].match(/\\p{IsPunctuation}/g);
      if (!isPun) break;
      word.trail.unshift({ hanzi: hanzi[i], pinyin: pinyin[i] });
    }
    for (; i <= j; ++i)
      word.text.push({ hanzi: hanzi[i], pinyin: pinyin[i] });
    return word;
  }

  function replace(words, startWdIx, startWdPos, endWdIx, endWdPos, hanzi, pinyin, trailSpace) {

    var res = [];
    var word = tokenizeWord(hanzi, pinyin);
    var isWordEmpty = hanzi.length == 0;

    // Normalize positions: should never point past trailing space: that's next word's start
    if (startWdIx < words.length) {
      var startWd = words[startWdIx];
      if (startWd.lead.length + startWd.text.length + startWd.trail.length + 1 == startWdPos) {
        ++startWdIx;
        startWdPos = 0;
      }
    }

    // Full words before selection start
    var wdIx;
    for (wdIx = 0; wdIx < startWdIx; ++wdIx) res.push(words[wdIx]);

    // Partial word if selection begins inside: keep fragment
    var glueReplacement = false;
    if (startWdPos > 0) {
      var wstart = words[startWdIx];
      var wfrag = { lead: [], text: [], trail: [] };
      var pos = 0, j = 0;
      for (j = 0; j < wstart.lead.length && pos < startWdPos; ++j, ++pos)
        wfrag.lead.push(wstart.lead[j]);
      for (j = 0; j < wstart.text.length && pos < startWdPos; ++j, ++pos)
        wfrag.text.push(wstart.text[j]);
      for (j = 0; j < wstart.trail.length && pos < startWdPos; ++j, ++pos)
        wfrag.trail.push(wstart.trail[j]);
      glueReplacement = wfrag.lead.length + wfrag.text.length + wfrag.trail.length == startWdPos;
      if (wfrag.text.length == 0) glueReplacement = false;
      if (wfrag.trail.length != 0) glueReplacement = false;
      // TO-DO: Normalize (trail-only)
      res.push(wfrag);
    }
    // Add new word, unless empty
    if (!isWordEmpty) {
      // If selection start was at end of word (before space), and word did not have trailing punct
      // And new word does not have leading punct
      // Well, then, let's glue to text.
      if (glueReplacement && word.lead.length == 0) {
        res[res.length - 1].text = res[res.length - 1].text.concat(word.text);
        res[res.length - 1].trail = word.trail;
      }
      // Otherwise, new word.
      else res.push(word);
    }
    // Partial word if selection ends inside: keep fragment
    wdIx = endWdIx;
    if (endWdPos > 0) {
      var wfrag = { lead: [], text: [], trail: [] };
      var pos = 0, j = 0;
      for (j = 0; j < words[endWdIx].lead.length; ++j, ++pos)
        if (pos >= endWdPos) wfrag.lead.push(words[endWdIx].lead[j]);
      for (j = 0; j < words[endWdIx].text.length; ++j, ++pos)
        if (pos >= endWdPos) wfrag.text.push(words[endWdIx].text[j]);
      for (j = 0; j < words[endWdIx].trail.length; ++j, ++pos)
        if (pos >= endWdPos) wfrag.text.push(words[endWdIx].trail[j]);
      // TO-DO: Normalize (trail-only)
      // Don't add empty word
      if (wfrag.lead.length + wfrag.text.length + wfrag.trail.length > 0)
        res.push(wfrag);
      ++wdIx;
    }
    // First remaining word: if selection end was at start of word (no old fragment just appended)
    // And we're not inserting space, and first remaining word does not have leading punct:
    // Add previous word does not have trailing punct
    // Well, then, let's glue. It's a space getting deleted.
    if (endWdPos == 0 && !trailSpace && wdIx < words.length &&
        words[wdIx].lead.length == 0 && res.length > 0 &&
        res[res.length - 1].trail.length == 0) {
      var wlast = res[res.length - 1];
      var wnext = words[wdIx];
      wlast.text = wlast.text.concat(wnext.text);
      wlast.trail = wnext.trail;
      ++wdIx;
    }
    // Add remainig words
    for (; wdIx < words.length; ++wdIx) res.push(words[wdIx]);


    return res;
  }

  return {
    para2dom: para2dom,
    dom2para: dom2para,
    replace: replace,
  }
})();
