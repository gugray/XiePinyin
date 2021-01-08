"use strict";
var $ = require("jquery");
var para2dom = require("./para2dom");

const htmlHanziCaret = '<div class="caret hanzi hidden">&nbsp;</div>';
const htmlPinyinCaret = '<div class="caret pinyin hidden">&nbsp;</div>';
const htmlHiddenInput = '<input type="text" id="hiddenInput" autofocus="autofocus"/>';

module.exports = (function (elmHost) {
  var _elmHost = elmHost;
  var _elmHanziCaret = $(htmlHanziCaret);
  var _elmPinyinCaret = $(htmlPinyinCaret);
  var _elmHiddenInput = $(htmlHiddenInput);
  var _elmPara = para2dom([]);
  var _sel = {
    start: 0,
    end: 0,
    caretAtStart: false,
  };
  var _caretInterval = null;

  init();
  setContent([]);

  function init() {
    // Add caret asset
    _elmHost.empty();
    _elmHost.append(_elmHanziCaret);
    _elmHost.append(_elmPinyinCaret);
    // Hidden input field
    _elmHost.append(_elmHiddenInput);
    _elmHiddenInput.focus();
    $(document).focus(() => _elmHiddenInput.focus());
    // Caret blinkety blink
    resetCaretBlinkie();
    // Mouse and keyboard handlers
    _elmHost.mousedown(onMouseDown);
    _elmHiddenInput.keydown(onKeyDown);
  }

  function resetCaretBlinkie() {
    if (_caretInterval) {
      clearInterval(_caretInterval);
      _caretInterval = null;
    }
    _caretInterval = setInterval(function () {
      if (_elmHanziCaret.hasClass("hidden")) {
        _elmHanziCaret.removeClass("hidden");
        _elmPinyinCaret.removeClass("hidden");
      }
      else {
        _elmHanziCaret.addClass("hidden");
        _elmPinyinCaret.addClass("hidden");
      }
    }, 500);
    _elmHanziCaret.addClass("hidden");
    _elmPinyinCaret.addClass("hidden");
  }

  function setContent(content) {
    _elmPara = para2dom(content);
    _elmHost.find(".para").remove();
    _elmHost.append(_elmPara);
    _sel.start = _sel.end = 0;
    _sel.caretAtStart = false;
    updateSelection();
    // DBG
    if (content.length > 5) {
      _sel.start = 2;
      _sel.end = 5;
      updateSelection();
    }
  }

  function onMouseDown(e) {
    var i = 0;
  }

  function onKeyDown(e) {
    var plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    var handled = false;
    switch (e.keyCode) {
      //case 13: // Enter
      //case 27: // Esc
      //case 32: // Space
      case 37: // Left Arrow
        handleLeft(e.ctrlKey, e.shiftKey);
        handled = true;
        break;
      //case 38: // Up Arrow
      case 39:   // Right Arrow
        handleRight(e.ctrlKey, e.shiftKey);
        handled = true;
        break;
        //case 40: // Down Arrow

    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleLeft(ctrlKey, shiftKey) {
    // Moving one char at a time
    if (!ctrlKey) {
      // We have a selection and shift is not pressed: Selection gone, caret is at left of selection
      if (_sel.end != _sel.start && !shiftKey) {
        _sel.end = _sel.start;
        _sel.caretAtStart = true;
      }
      // Caret at start of para: cannot go further
      else if (_sel.start == 0) return;
      // Shift not pressed: move caret left
      else if (!shiftKey) {
        --_sel.start;
        _sel.end = _sel.start;
        _sel.caretAtStart = true;
      }
      // Shift pressed: expand/shrink selection
      else if (shiftKey) {
        if (_sel.caretAtStart || _sel.start == _sel.end) {
          --_sel.start;
          _sel.caretAtStart = true;
        }
        else {
          --_sel.end;
          if (_sel.end == _sel.start) _sel.caretAtStart = true;
        }
      }
    }
    updateSelection();
  }

  function handleRight(ctrlKey, shiftKey) {
    const wordCount = _elmPara.find("div.hanzi>span").length;
    // Moving one char at a time
    if (!ctrlKey) {
      // We have a selection and shift is not pressed: Selection gone, caret is at right of selection
      if (_sel.end != _sel.start && !shiftKey) {
        _sel.start = _sel.end;
        _sel.caretAtStart = true;
      }
      // Caret at end of para: cannot go further
      else if (_sel.end == wordCount - 1) return;
      // Shift not pressed: move caret right
      else if (!shiftKey) {
        ++_sel.end;
        _sel.start = _sel.end;
        _sel.caretAtStart = true;
      }
      // Shift pressed: expand/shrink selection
      else if (shiftKey) {
        if (!_sel.caretAtStart || _sel.start == _sel.end) {
          ++_sel.end;
          _sel.caretAtStart = false;
        }
        else {
          ++_sel.start;
          if (_sel.end == _sel.start) _sel.caretAtStart = true;
        }
      }
    }
    updateSelection();
  }

  function updateSelection() {
    var hanziCaretX = 0, hanziCaretY = 0, pinyinCaretX = 0, pinyinCaretY = 0;
    var ix = 0;
    var wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount; ++i) {
      var elmWord = _elmHost.find(".word").eq(i);
      var atomCount = elmWord.find(".hanzi>span").length;
      for (var j = 0; j < atomCount; ++j) {
        var elmHanzi = elmWord.find(".hanzi>span").eq(j);
        var elmPinyin = elmWord.find(".pinyin>span").eq(j);
        if (ix < _sel.start || ix >= _sel.end) {
          elmHanzi.removeClass("sel");
          elmPinyin.removeClass("sel");
        }
        else {
          elmHanzi.addClass("sel");
          elmPinyin.addClass("sel");
        }
        if (ix == _sel.start && _sel.caretAtStart || ix == _sel.end - 1 && !_sel.caretAtStart) {
          hanziCaretY = elmHanzi.offset().top - _elmHost.offset().top;
          pinyinCaretY = elmPinyin.offset().top - _elmHost.offset().top;
          if (_sel.caretAtStart) {
            hanziCaretX = elmHanzi.offset().left - _elmHost.offset().left - 2;
            pinyinCaretX = elmPinyin.offset().left - _elmHost.offset().left - 2;
          }
          else {
            hanziCaretX = elmHanzi.offset().left + elmHanzi.width() - _elmHost.offset().left - 2;
            pinyinCaretX = elmPinyin.offset().left + elmPinyin.width() - _elmHost.offset().left - 2;
          }
        }
        ++ix;
      }
    }
    _elmHanziCaret.css("left", hanziCaretX + "px");
    _elmHanziCaret.css("top", hanziCaretY + "px");
    _elmPinyinCaret.css("left", pinyinCaretX + "px");
    _elmPinyinCaret.css("top",  pinyinCaretY + "px");
  }

  return {
    setContent: setContent,
  };
});
