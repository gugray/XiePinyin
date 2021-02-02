﻿"use strict";
var $ = require("jquery");
var converter = require("./converter");
var composer = require("./composer");

const htmlHanziCaret = '<div class="caret hanzi hidden">&nbsp;</div>';
const htmlPinyinCaret = '<div class="caret pinyin hidden">&nbsp;</div>';
const htmlHiddenInput = '<input type="text" id="hiddenInput" autofocus="autofocus"/>';
const htmlComposer = '<div class="composer"></div>';

module.exports = (function (elmHost, shortcutHandler) {
  var _elmHost = elmHost;
  var _shortcutHandler = shortcutHandler;
  var _inputType = "simp";
  // Used only for focus chasing
  var _mouseButtonPressed = false;
  // Positive value indicates that mouse button is pressed and selection tracks cursor
  var _mousePressSelStartIx = -1;
  var _elmHanziCaret = $(htmlHanziCaret);
  var _elmPinyinCaret = $(htmlPinyinCaret);
  var _elmHiddenInput = $(htmlHiddenInput);
  var _elmComposer = $(htmlComposer);
  var _elmParas = converter.text2dom([]);
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

    // Magic around blinking caret, focus chasing etc.
    $(document).mousedown(() => _mouseButtonPressed = true);
    $(document).mouseup(() => _mouseButtonPressed = false);
    $(document).focusout(() => { if (!_mouseButtonPressed) setCaretBlinkie(false, false); });
    _elmHiddenInput.focusin(() => setCaretBlinkie(true, false));
    _elmHiddenInput.focus();
    $(document).focus(() => _elmHiddenInput.focus());
    _elmHiddenInput.on("input", onHiddenInput);
    _caretInterval = setInterval(caretInterval, 500);
    $("body").click(() => _elmHiddenInput.focus());

    // Composer
    _elmHost.append(_elmComposer);
    _composer = composer(_elmComposer);
    _composer.closed(onComposerClosed);

    // Mouse and keyboard handlers
    _elmHost.mousedown(onMouseDown);
    _elmHiddenInput.keydown(onKeyDown);
    _elmHost.mousemove(onMouseMove);
    _elmHost.mouseup(onMouseUp);
  }

  function caretInterval() {
    if (_elmHanziCaret.hasClass("hidden")) {
      _elmHanziCaret.removeClass("hidden");
      _elmPinyinCaret.removeClass("hidden");
    }
    else {
      _elmHanziCaret.addClass("hidden");
      _elmPinyinCaret.addClass("hidden");
    }
  }

  function setCaretBlinkie(blinking, restart) {
    if (restart) {
      clearInterval(_caretInterval);
      _caretInterval = setInterval(caretInterval, 500);
    }
    if (blinking) {
      _elmHanziCaret.removeClass("frozen");
      _elmPinyinCaret.removeClass("frozen");
      if (restart) {
        _elmHanziCaret.removeClass("hidden");
        _elmPinyinCaret.removeClass("hidden");
      }
    }
    else {
      _elmHanziCaret.addClass("frozen");
      _elmPinyinCaret.addClass("frozen");
    }
  }

  function setContent(content, newSel) {
    _elmParas = converter.text2dom(content);
    _elmHost.find(".para").remove();
    for (let i = 0; i < _elmParas.length; ++i) _elmHost.append(_elmParas[i]);
    if (!newSel) {
      _sel.start = _sel.end = 0;
      _sel.caretAtStart = false;
    }
    else {
      _sel.start = newSel.start;
      _sel.end = newSel.end;
      _sel.caretAtStart = newSel.caretAtStart;
    }
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
    // If we're in alfa mode, insert characters into text. This also gracefully handles pasting.
    if (_inputType == "alfa") {
      let text = [];
      for (const c of val) text.push({ hanzi: c });
      replaceSel(text);
    }
    // In biscriptal mode, show composer window
    else {
      // But if there are multiple characters (paste?!), just swalling zis.
      if (val.length > 1) return;
      _elmHiddenInput.prop("disabled", true);
      setCaretBlinkie(false);
      let caretTop = _elmHanziCaret.offset().top - _elmHost.offset().top;
      let caretBottom = _elmPinyinCaret.offset().top - _elmHost.offset().top+ _elmPinyinCaret.height();
      let caretLeft = _elmHanziCaret.offset().left - _elmHost.offset().left;
      _composer.show(val, _inputType, caretLeft, caretTop, caretBottom);
    }
  }

  function onComposerClosed(e) {
    _elmHiddenInput.prop("disabled", false);
    _elmHiddenInput.focus();
    setCaretBlinkie(true, true);
    if (e.result) {
      replaceSel(e.result);
    }
  }

  function trackSelectionTo(ix) {
    if (_sel.start == _sel.end) {
      if (ix < _sel.start) {
        _sel.start = ix;
        _sel.caretAtStart = true;
      }
      else if (ix > _sel.end) {
        _sel.end = ix;
        _sel.caretAtStart = false;
      }
    }
    else {
      const nonCaretEnd = _sel.caretAtStart ? _sel.end : _sel.start;
      if (ix > nonCaretEnd) {
        _sel.start = nonCaretEnd;
        _sel.end = ix;
        _sel.caretAtStart = false;
      }
      else if (ix < nonCaretEnd) {
        _sel.start = ix;
        _sel.end = nonCaretEnd;
        _sel.caretAtStart = true;
      }
      else {
        _sel.start = _sel.end = ix;
        _sel.caretAtStart = false;
      }
    }
  }

  function onMouseDown(e) {
    // We only care about left button.
    if (e.originalEvent.buttons != 1) return;
    console.log(e.originalEvent.x, e.originalEvent.y);
    const pos = getContentIxFromCoords(e.originalEvent.x, e.originalEvent.y);
    if (pos.ix == -1) return;
    const ix = pos.before ? pos.ix : pos.ix + 1;
    // Shift+click: selection
    if (e.originalEvent.shiftKey) trackSelectionTo(ix);
    // Just a click
    else {
      _sel.start = _sel.end = ix;
      _sel.caretAtStart = false;
    }
    // Selection now tracks cursor
    _mousePressSelStartIx = _sel.caretAtStart ? _sel.end : _sel.start;
    // Selection has changed, update display
    updateSelection();
    setCaretBlinkie(true, true);
  }

  function onMouseUp(e) {
    _mousePressSelStartIx = -1;
  }

  function onMouseMove(e) {
    if (_mousePressSelStartIx == -1) return;
    console.log(e.originalEvent.x, e.originalEvent.y);
    const pos = getContentIxFromCoords(e.originalEvent.x, e.originalEvent.y);
    if (pos.ix == -1) return;
    const ix = pos.before ? pos.ix : pos.ix + 1;
    console.log(pos);
    trackSelectionTo(ix);
    updateSelection();
  }

  function onKeyDown(e) {
    var plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    var handled = false;
    switch (e.code) {
      case "Backspace":
        if (_sel.end != _sel.start || _sel.start > 0) {
          if (_sel.end == _sel.start) --_sel.start; 
          replaceSel([]);
          handled = true;
        }
        break;
      case "Enter":
        replaceSel([{ hanzi: "\n", pinyin: "\n" }]);
        handled = true;
        break;
      case "Space":
        let spaceChar = _inputType == "alfa" ? { hanzi: " " } : { hanzi: " ", pinyin: " " };
        replaceSel([spaceChar]);
        handled = true;
        break;
      case "ArrowLeft":
        handleLeft(e.ctrlKey, e.shiftKey);
        handled = true;
        break;
      case "ArrowRight":
        handleRight(e.ctrlKey, e.shiftKey);
        handled = true;
        break;
    }
    if (!handled) handled = _shortcutHandler(e);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function getContent() {
    return converter.dom2text(_elmParas);
  }

  function getSel() {
    return {
      start: _sel.start,
      end: _sel.end,
      caretAtStart: _sel.caretAtStart,
    };
  }

  function broadcastSelChange() {
    let evt = new CustomEvent("onSelChange", {
      detail: {
        start: _sel.start,
        end: _sel.end,
        caretAtStart: _sel.caretAtStart,
      }
    });
    _elmHost[0].dispatchEvent(evt);
  }

  function replaceSel(chars) {
    let evt = new CustomEvent("onReplace", {
      detail: {
        start: _sel.start,
        end: _sel.end,
        newText: chars,
      }
    });

    var oldCont = converter.dom2text(_elmParas);
    var newCont = [];
    for (var i = 0; i < _sel.start; ++i) newCont.push(oldCont[i]);
    for (var i = 0; i < chars.length; ++i) newCont.push(chars[i]);
    for (var i = _sel.end; i < oldCont.length; ++i) newCont.push(oldCont[i]);
    _elmParas = converter.text2dom(newCont);
    _elmHost.find(".para").remove();
    for (let i = 0; i < _elmParas.length; ++i) _elmHost.append(_elmParas[i]);
    _sel.start += chars.length;
    _sel.end = _sel.start;
    _sel.caretAtStart = false;
    updateSelection();
    if (_elmHiddenInput.is(":focus")) setCaretBlinkie(true, true);

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
    setCaretBlinkie(true, true);
    broadcastSelChange();
  }

  function handleRight(ctrlKey, shiftKey) {
    const charCount = _elmHost.find(".para div.hanzi>span.x").length;
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
    setCaretBlinkie(true, true);
    broadcastSelChange();
  }

  function getContentIxFromCoords(x, y) {
    let res = {
      ix: -1,
      before: true,
    };
    let ix = 0;
    const contentLength = _elmHost.find(".hanzi>span.x").length - 1;
    const wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount && res.ix == -1; ++i) {
      const elmWord = _elmHost.find(".word").eq(i);
      const spanCount = elmWord.find(".hanzi>span.x").length;
      for (var j = 0; j < spanCount && res.ix == -1; ++j, ++ix) {
        const elmHanzi = elmWord.find(".hanzi>span.x").eq(j);
        const elmPinyin = elmWord.find(".pinyin>span.x").eq(j);
        let elm = null;
        if (y >= elmWord.offset().top && y < elmHanzi.offset().top + elmHanzi.height()) elm = elmHanzi;
        else if (elmPinyin.length == 0 && y >= elmWord.offset().top && y < elmWord.offset().top + elmWord.outerHeight(true)) elm = elmHanzi;
        else if (elmPinyin.length > 0 && y >= elmPinyin.offset().top && y < elmWord.offset().top + elmWord.outerHeight(true)) elm = elmPinyin;
        if (elm != null) {
          if (x < elm.offset().left) {
            res.ix = ix;
            res.before = true;
          }
          else if (x >= elm.offset().left && x < elm.offset().left + elm.width()) {
            res.ix = ix;
            res.before = x < elm.offset().left + elm.width() / 2;
          }
          else if (ix == contentLength && x >= elm.offset().left + elm.width()) {
            res.ix = ix;
            res.before = false;
          }
        }
        else if (ix == contentLength - 1 && elmWord.offset().top + elmWord.outerHeight(true)) {
          res.ix = contentLength;
          res.before = true;
        }
        else if (y < elmHanzi.offset().top) {
          res.ix = ix == 0 ? 0 : ix - 1;
          res.before = true;
        }
      }
    }
    return res;
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
        if (ix == _sel.start && (_sel.caretAtStart || _sel.end == _sel.start) || ix == _sel.end - 1 && !_sel.caretAtStart) {
          hanziCaretY = elmHanzi.offset().top - _elmHost.offset().top;
          if (elmPinyin.length != 0) pinyinCaretY = elmPinyin.offset().top - _elmHost.offset().top;
          else pinyinCaretY = hanziCaretY + _elmHanziCaret.height();
          if (_sel.caretAtStart || _sel.end == _sel.start) {
            hanziCaretX = elmHanzi.offset().left - _elmHost.offset().left - 2;
            if (elmPinyin.length != 0) pinyinCaretX = elmPinyin.offset().left - _elmHost.offset().left - 2;
            else pinyinCaretX = hanziCaretX;
          }
          else {
            hanziCaretX = elmHanzi.offset().left + elmHanzi.width() - _elmHost.offset().left - 2;
            if (elmPinyin.length != 0) pinyinCaretX = elmPinyin.offset().left + elmPinyin.width() - _elmHost.offset().left - 2;
            else pinyinCaretX = hanziCaretX;
          }
        }
        if (elmHanzi.hasClass("x")) ++ix;
      }
    }
    _elmHanziCaret.css("left", hanziCaretX + "px");
    _elmHanziCaret.css("top", hanziCaretY + "px");
    _elmPinyinCaret.css("left", pinyinCaretX + "px");
    _elmPinyinCaret.css("top", pinyinCaretY + "px");
    _elmHiddenInput.css("left", hanziCaretX + "px");
    _elmHiddenInput.css("top", hanziCaretY + "px");
    setTimeout(scrollToCaret, 20);
  }

  function scrollToCaret() {
    if (_elmPinyinCaret[0].getBoundingClientRect().bottom > window.innerHeight - 20) {
      const diff = _elmPinyinCaret[0].getBoundingClientRect().bottom - window.innerHeight;
      let scrollTop = $("#app").scrollTop();
      scrollTop += (diff + 20);
      $("#app").scrollTop(scrollTop);
      //_elmPinyinCaret[0].scrollIntoView(false);
    } else if (_elmHanziCaret[0].getBoundingClientRect().top < $(".header").height() + 10) {
      const diff = $(".header").height() - _elmHanziCaret[0].getBoundingClientRect().top;
      let scrollTop = $("#app").scrollTop();
      scrollTop -= (diff + 10);
      if (scrollTop < 0) scrollTop = 0;
      $("#app").scrollTop(scrollTop);
    }
  }

  function setPeerSelections(pss) {
    _elmHost.find(".caret.peer").remove();
    let elmHanziCarets = [], elmPinyinCarets = [];
    for (let i = 0; i < pss.length; ++i) {
      let hc = $(htmlHanziCaret);
      hc.addClass("peer");
      hc.addClass("peer" + (i % 5 + 1));
      hc.removeClass("hidden");
      elmHanziCarets.push(hc);
      let pc = $(htmlPinyinCaret);
      pc.addClass("peer");
      pc.addClass("peer" + (i % 5 + 1));
      pc.removeClass("hidden");
      elmPinyinCarets.push(pc);
      pss[i].hanziCaretX = 0;
      pss[i].hanziCaretY = 0;
      pss[i].pinyinCaretX = 0;
      pss[i].pinyinCaretY = 0;
      pss[i].ix = pss[i].caretAtStart ? pss[i].start : pss[i].end;
    }

    var ix = 0;
    var wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount; ++i) {
      var elmWord = _elmHost.find(".word").eq(i);
      var spanCount = elmWord.find(".hanzi>span").length;
      for (var j = 0; j < spanCount; ++j) {
        var elmHanzi = elmWord.find(".hanzi>span").eq(j);
        var elmPinyin = elmWord.find(".pinyin>span").eq(j);
        for (let k = 0; k < pss.length; ++k) {
          if (ix == pss[k].ix) {
            pss[k].hanziCaretY = elmHanzi.offset().top - _elmHost.offset().top;
            if (elmPinyin.length != 0) pss[k].pinyinCaretY = elmPinyin.offset().top - _elmHost.offset().top;
            else pss[k].pinyinCaretY = pss[k].hanziCaretY + _elmHanziCaret.height();
            pss[k].hanziCaretX = elmHanzi.offset().left - _elmHost.offset().left - 2;
            if (elmPinyin.length != 0) pss[k].pinyinCaretX = elmPinyin.offset().left - _elmHost.offset().left - 2;
            else pss[k].pinyinCaretX = pss[k].hanziCaretX;
          }
        }
        if (elmHanzi.hasClass("x")) ++ix;
      }
    }
    for (let i = 0; i < pss.length; ++i) {
      elmHanziCarets[i].css("left", pss[i].hanziCaretX + "px");
      elmHanziCarets[i].css("top", pss[i].hanziCaretY + "px");
      elmPinyinCarets[i].css("left", pss[i].pinyinCaretX + "px");
      elmPinyinCarets[i].css("top", pss[i].pinyinCaretY + "px");
      _elmHost.prepend(elmHanziCarets[i]);
      _elmHost.prepend(elmPinyinCarets[i]);
    }
  }

  function onReplace(handler) {
    _elmHost[0].addEventListener("onReplace", handler);
  }

  function onSelChange(handler) {
    _elmHost[0].addEventListener("onSelChange", handler);
  }

  return {
    setContent,
    setPeerSelections,
    getContent,
    getSel,
    setInputType,
    onReplace,
    onSelChange,
  };
});
