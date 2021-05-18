"use strict";
var $ = require("jquery");
var converter = require("./converter");
var composer = require("./composer");
const { compose } = require("./changeset");

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
  // The "hidden" X coordinate of the caret that we aim to preserve when moving up/down in text
  var _desiredCaretX = -1;
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
    _composer.insert(onComposerInsert);

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
    if (!newSel) setSel(0, 0, false);
    else setSel(newSel.start, newSel.end, newSel.caretAtStart);
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
    // When typing a single punctuation mark, or a space:
    // Insert current suggestion, if any
    var sugg = _composer.getSuggestion();
    if (sugg && _sel.end == _sel.start && /^[\s\p{Punctuation}]$/u.test(val)) {
      onComposerInsert(sugg);
      _composer.close();
    }
    // Insert characters into text. This also gracefully handles pasting into hidden input field.
    let text = [];
    for (const c of val) text.push({ hanzi: c });
    const prompt = replaceSel(text);
    // Update composer widget
    updateComposer(prompt);
  }

  function updateComposer(prompt) {
    if (prompt.length == 0) {
      _composer.close();
      return;
    }
    let caretTop = _elmHanziCaret.offset().top - _elmHost.offset().top;
    let caretBottom = _elmPinyinCaret.offset().top - _elmHost.offset().top + _elmPinyinCaret.height();
    let caretLeft = _elmHanziCaret.offset().left - _elmHost.offset().left;
    _composer.refresh(prompt, _inputType, caretLeft, caretTop, caretBottom);
  }
  
  function onComposerInsert(e) {
    if (!e.result) return;
    setSel(_sel.end - e.prompt.length, _sel.end);
    replaceSel(e.result);
  }

  function trackSelectionTo(ix) {
    if (_sel.start == _sel.end) {
      if (ix < _sel.start) setSel(ix, _sel.end, true);
      else if (ix > _sel.end) setSel(_sel.start, ix, false);
    }
    else {
      const nonCaretEnd = _sel.caretAtStart ? _sel.end : _sel.start;
      if (ix > nonCaretEnd) setSel(nonCaretEnd, ix, false);
      else if (ix < nonCaretEnd) setSel(ix, nonCaretEnd, true);
      else setSel(ix, ix, false);
    }
  }

  function onMouseDown(e) {
    // We only care about left button.
    if (e.originalEvent.buttons != 1) return;
    const pos = getContentIxFromCoords(e.originalEvent.x, e.originalEvent.y);
    if (pos.ix == -1) return;
    const ix = pos.before ? pos.ix : pos.ix + 1;
    // Shift+click: selection
    if (e.originalEvent.shiftKey) trackSelectionTo(ix);
    // Just a click
    else setSel(ix, ix, false);
    _composer.close();
    // Selection now tracks cursor
    _mousePressSelStartIx = _sel.caretAtStart ? _sel.end : _sel.start;
    setCaretBlinkie(true, true);
  }

  function onMouseUp(e) {
    _mousePressSelStartIx = -1;
  }

  function onMouseMove(e) {
    if (_mousePressSelStartIx == -1) return;
    const pos = getContentIxFromCoords(e.originalEvent.x, e.originalEvent.y);
    if (pos.ix == -1) return;
    const ix = pos.before ? pos.ix : pos.ix + 1;
    trackSelectionTo(ix);
  }

  function onKeyDown(e) {
    if (_composer.isVisible()) {
      if (_composer.onKeyDown(e))
        return;
    }
    var handled = false;
    switch (e.code) {
      case "Backspace":
        if (_sel.end != _sel.start || _sel.start > 0) {
          // If no selection, select last char before cursor
          if (_sel.end == _sel.start) setSel(_sel.start - 1, _sel.end, _sel.caretAtStart);
          // If there is a non-empty selection, kill composer. (We want to keep it shown in selectionless Backspacing.)
          else _composer.close();
          const prompt = replaceSel([]);
          updateComposer(prompt);
          handled = true;
        }
        break;
      case "Enter":
        replaceSel([{ hanzi: "\n", pinyin: "\n" }]);
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
      case "ArrowDown":
        handleDown(e.shiftKey);
        handled = true;
        break;
      case "ArrowUp":
        handleUp(e.shiftKey);
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

    // Get old content from DOM
    var oldCont = converter.dom2text(_elmParas);

    // If new text is a single character, extract a composition prompt from the text before the caret
    const prompt = [];
    if (chars.length == 0 || (chars.length == 1 && !chars[0].pinyin && !/\s/.test(chars[0].hanzi))) {
      if (chars.length == 1) prompt.unshift(chars[0]);
      for (let i = _sel.start - 1; i >= 0; --i) {
        const char = oldCont[i];
        if (!char) continue;
        if (char.pinyin && char.pinyin != "") break;
        if (/\p{Punctuation}/u.test(char.hanzi)) break;
        if (/\s/.test(char.hanzi)) break;
        prompt.unshift(char);
      }
    }

    // Assemble new content in one
    var newCont = [];
    for (var i = 0; i < _sel.start; ++i) newCont.push(oldCont[i]);
    for (var i = 0; i < chars.length; ++i) newCont.push(chars[i]);
    for (var i = _sel.end; i < oldCont.length; ++i) newCont.push(oldCont[i]);
    _elmParas = converter.text2dom(newCont);
    _elmHost.find(".para").remove();
    for (let i = 0; i < _elmParas.length; ++i) _elmHost.append(_elmParas[i]);
    setSel(_sel.start + chars.length, _sel.start + chars.length, false);
    if (_elmHiddenInput.is(":focus")) setCaretBlinkie(true, true);

    // Dispatch onReplace event
    _elmHost[0].dispatchEvent(evt);

    // Return composition prompt
    return prompt;
  }

  function handleDown(shiftKey) {
    const hofs = _elmHost.offset();
    if (_desiredCaretX == -1)
      _desiredCaretX = Math.round(_elmHanziCaret.offset().left - hofs.left);
    const currY = _elmHanziCaret.offset().top - hofs.top;
    let nextY = -1;
    let nextIx = -1, ix = 0;
    const contentLength = _elmHost.find(".hanzi>span.x").length - 1;
    const wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount && nextIx == -1; ++i) {
      const elmWord = _elmHost.find(".word").eq(i);
      const spanCount = elmWord.find(".hanzi>span.x").length;
      for (var j = 0; j < spanCount && nextIx == -1; ++j, ++ix) {
        const elmHanzi = elmWord.find(".hanzi>span.x").eq(j);
        const thisY = elmHanzi.offset().top - hofs.top;
        if (thisY < currY + 1) continue;
        if (nextY == -1) nextY = thisY;
        else if (thisY > nextY) {
          nextIx = ix - 1;
          break;
        }
        const hanziMid = elmHanzi.offset().left - hofs.left + elmHanzi.width() / 2;
        if (hanziMid >= _desiredCaretX) nextIx = ix;
        else if (ix == contentLength) nextIx = ix;
      }
    }
    if (nextIx != -1) {
      if (!shiftKey) setSel(nextIx, nextIx, false, true);
      else {
        const nonCaretEnd = _sel.caretAtStart ? _sel.end : _sel.start;
        if (nextIx <= nonCaretEnd) setSel(nextIx, nonCaretEnd, true);
        else setSel(nonCaretEnd, nextIx, false);
      }
      _composer.close();
      setCaretBlinkie(true, true);
    }
  }

  function handleUp(shiftKey) {
    const hofs = _elmHost.offset();
    if (_desiredCaretX == -1)
      _desiredCaretX = Math.round(_elmHanziCaret.offset().left - hofs.left);
    const lnHeight = _elmHost.find(".word").outerHeight(true);
    const currY = _elmHanziCaret.offset().top - hofs.top;
    if (currY < lnHeight) return;
    let prevIx = -1, ix = 0;
    const wordCount = _elmHost.find(".word").length;
    for (var i = 0; i < wordCount && prevIx == -1; ++i) {
      const elmWord = _elmHost.find(".word").eq(i);
      const spanCount = elmWord.find(".hanzi>span.x").length;
      for (var j = 0; j < spanCount && prevIx == -1; ++j, ++ix) {
        const elmHanzi = elmWord.find(".hanzi>span.x").eq(j);
        const thisY = elmHanzi.offset().top - hofs.top;
        if (thisY < currY - lnHeight - 1) continue;
        if (Math.abs(thisY - currY) < 1) {
          prevIx = ix - 1;
          continue;
        }
        const hanziMid = elmHanzi.offset().left - hofs.left + elmHanzi.width() / 2;
        if (hanziMid >= _desiredCaretX) prevIx = ix;
      }
    }
    if (prevIx != -1) {
      if (!shiftKey) setSel(prevIx, prevIx, false, true);
      else {
        const nonCaretEnd = _sel.caretAtStart ? _sel.end : _sel.start;
        if (prevIx <= nonCaretEnd) setSel(prevIx, nonCaretEnd, true);
        else setSel(nonCaretEnd, prevIx, false);
      }
      _composer.close();
      setCaretBlinkie(true, true);
    }
  }

  function handleLeft(ctrlKey, shiftKey) {
    // Moving one char at a time
    if (!ctrlKey) {
      // We have a selection and shift is not pressed: Selection gone, caret is at left of selection
      if (_sel.end != _sel.start && !shiftKey) setSel(_sel.start, _sel.start, true);
      // Caret at start of para: cannot go further
      else if (_sel.start == 0 && (_sel.caretAtStart || _sel.end == _sel.start)) return;
      // Shift not pressed: move caret left
      else if (!shiftKey) setSel(_sel.start - 1, _sel.start - 1, true);
      // Shift pressed: expand/shrink selection
      else if (shiftKey) {
        if (_sel.caretAtStart || _sel.start == _sel.end) setSel(_sel.start - 1, _sel.end, true);
        else setSel(_sel.start, _sel.end - 1, _sel.start == _sel.end - 1);
      }
    }
    _composer.close();
    setCaretBlinkie(true, true);
    broadcastSelChange();
  }

  function handleRight(ctrlKey, shiftKey) {
    const charCount = _elmHost.find(".para div.hanzi>span.x").length;
    // Moving one char at a time
    if (!ctrlKey) {
      // Caret at end of para: cannot go further
      if (_sel.end == charCount - 1 && (shiftKey && !_sel.caretAtStart || _sel.end == _sel.start)) return;
      if (!shiftKey) {
        // We have a selection and shift is not pressed: Selection gone, caret is at right of selection
        if (_sel.end != _sel.start) setSel(_sel.end, _sel.end, true);
        // No selection: move caret right
        else setSel(_sel.end + 1, _sel.end + 1, true);
      }
      // Shift pressed: expand/shrink selection
      else {
        if (_sel.start == _sel.end) setSel(_sel.start, _sel.start + 1, false);
        else {
          const nonCaretEnd = _sel.caretAtStart ? _sel.end : _sel.start;
          if (nonCaretEnd == _sel.end) setSel(_sel.start + 1, _sel.end, true);
          else setSel(_sel.start, _sel.end + 1, false);
        }
      }
    }
    _composer.close();
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

  function setSel(start, end, caretAtStart, preserveDesiredCaretX) {

    if (_sel.start == start && _sel.end == end && _sel.caretAtStart == caretAtStart)
      return;

    _sel.start = start;
    _sel.end = end;
    _sel.caretAtStart = caretAtStart;
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
    if (!preserveDesiredCaretX) _desiredCaretX = -1;
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
