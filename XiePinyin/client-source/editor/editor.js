"use strict";
var $ = require("jquery");
var converter = require("./converter");
var composer = require("./composer");

const htmlHanziCaret = '<div class="caret hanzi hidden">&nbsp;</div>';
const htmlPinyinCaret = '<div class="caret pinyin hidden">&nbsp;</div>';
const htmlHiddenInput = '<input type="text" id="hiddenInput" autofocus="autofocus"/>';
const htmlComposer = '<div class="composer"></div>';

module.exports = (function (elmHost) {
  var _elmHost = elmHost;
  var _inputType = "simp";
  var _elmHanziCaret = $(htmlHanziCaret);
  var _elmPinyinCaret = $(htmlPinyinCaret);
  var _elmHiddenInput = $(htmlHiddenInput);
  var _elmComposer = $(htmlComposer);
  var _elmPara = converter.para2dom([]);
  var _sel = {
    start: 0,
    end: 0,
    caretAtStart: false,
  };
  var _caretInterval = null;
  var _composer = null;

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
    _elmHiddenInput.on("input", onHiddenInput);


    $("body").click(() => _elmHiddenInput.focus());

    // Composer
    _elmHost.append(_elmComposer);
    _composer = composer(_elmComposer);
    _composer.closed(onComposerClosed);

    // Caret blinkety blink
    setCaretBlinkie(true);

    // Mouse and keyboard handlers
    _elmHost.mousedown(onMouseDown);
    _elmHiddenInput.keydown(onKeyDown);
  }

  function setCaretBlinkie(blinking) {
    if (_caretInterval) {
      clearInterval(_caretInterval);
      _caretInterval = null;
    }
    if (blinking) {
      _elmHanziCaret.removeClass("frozen");
      _elmPinyinCaret.removeClass("frozen");
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
      _elmHanziCaret.removeClass("hidden");
      _elmPinyinCaret.removeClass("hidden");
    }
    else {
      _elmHanziCaret.removeClass("hidden");
      _elmPinyinCaret.removeClass("hidden");
      _elmHanziCaret.addClass("frozen");
      _elmPinyinCaret.addClass("frozen");
    }
  }

  function setContent(content) {
    _elmPara = converter.para2dom(content);
    _elmHost.find(".para").remove();
    _elmHost.append(_elmPara);
    _sel.start = _sel.end = 0;
    _sel.caretAtStart = false;
    updateSelection();
  }

  function setInputType(inputType) {
    _inputType = inputType;
  }

  var _suppressHiddenInfputChange = false;

  function onHiddenInput() {
    if (_suppressHiddenInfputChange) return;
    var val = _elmHiddenInput.val();
    _suppressHiddenInfputChange = true;
    _elmHiddenInput.val("");
    _suppressHiddenInfputChange = false;
    _elmHiddenInput.prop("disabled", true);
    setCaretBlinkie(false);
    _composer.show(val, _inputType);
  }

  function onComposerClosed(e) {
    _elmHiddenInput.prop("disabled", false);
    _elmHiddenInput.focus();
    setCaretBlinkie(true);
    if (e.result) {
      replaceSel(e.result, e.withSpace);
    }
  }

  function onMouseDown(e) {
  }

  function onKeyDown(e) {
    var plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    var handled = false;
    switch (e.keyCode) {
      //case 13: // Enter
      //case 27: // Esc
      case 8: // Backspace
        if (_sel.end != _sel.start || _sel.start > 0) {
          if (_sel.end == _sel.start) --_sel.start; 
          replaceSel([], false);
          handled = true;
        }
        break;
      case 32: // Space
        replaceSel([], true);
        handled = true;
        break;
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

  function getContent() {
    return converter.dom2para(_elmPara);
  }

  function replaceSel(chars, withSpace) {
    let evt = new CustomEvent("onReplace", {
      detail: {
        start: _sel.start,
        end: _sel.end,
        newText: chars,
      }
    });

    var oldCont = converter.dom2para(_elmPara);
    var newCont = [];
    for (var i = 0; i < _sel.start; ++i) newCont.push(oldCont[i]);
    for (var i = 0; i < chars.length; ++i) newCont.push(chars[i]);
    if (withSpace) newCont.push({ hanzi: " ", pinyin: " " });
    for (var i = _sel.end; i < oldCont.length; ++i) newCont.push(oldCont[i]);
    _elmPara = converter.para2dom(newCont);
    _elmHost.find(".para").remove();
    _elmHost.append(_elmPara);
    _sel.start += chars.length;
    if (withSpace) ++_sel.start;
    _sel.end = _sel.start;
    _sel.caretAtStart = false;
    updateSelection();

    _elmHost[0].dispatchEvent(evt);
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
    setCaretBlinkie(true);
  }

  function handleRight(ctrlKey, shiftKey) {
    const charCount = _elmPara.find("div.hanzi>span.x").length;
    // Moving one char at a time
    if (!ctrlKey) {
      // We have a selection and shift is not pressed: Selection gone, caret is at right of selection
      if (_sel.end != _sel.start && !shiftKey) {
        _sel.start = _sel.end;
        _sel.caretAtStart = true;
      }
      // Caret at end of para: cannot go further
      else if (_sel.end == charCount - 1) return;
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
    setCaretBlinkie(true);
  }

  function updateSelection() {
    var hanziCaretX = 0, hanziCaretY = 0, pinyinCaretX = 0, pinyinCaretY = 0;
    var ix = 0;
    var wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount; ++i) {
      var elmWord = _elmHost.find(".word").eq(i);
      var spanCount = elmWord.find(".hanzi>span").length;
      for (var j = 0; j < spanCount; ++j) {
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
        if (elmHanzi.hasClass("x")) ++ix;
      }
    }
    _elmHanziCaret.css("left", hanziCaretX + "px");
    _elmHanziCaret.css("top", hanziCaretY + "px");
    _elmPinyinCaret.css("left", pinyinCaretX + "px");
    _elmPinyinCaret.css("top",  pinyinCaretY + "px");
  }

  function onReplace(handler) {
    _elmHost[0].addEventListener("onReplace", handler);
  }

  return {
    setContent,
    getContent,
    setInputType,
    onReplace,
  };
});
