"use strict";
var $ = require("jquery");
var EventTarget = require("../eventtarget");

const widgetHtml = `
<div class="suggestions" data-pinyinSylls=""></div>
`;

const htmlPlaceholder = "<span>Type pin1yin1 with tone marks.</span>"

module.exports = (function (elmHost) {
  var _elmHost = elmHost;
  var _elmSuggestions;
  var _evtTarget = new EventTarget();
  var _inputType = null;
  var _prompt = null;
  var _plainPrompt = "";
  var _glueBottom = false;
  var _reqIx = 0;
  var _caretPosAtShow = {
    left: 0,
    top: 0,
    bottom: 0,
  };

  init();

  function init() {
    _elmHost.append($(widgetHtml));
    _elmSuggestions = _elmHost.find(".suggestions");

    // If composer loses focus, and it's not because document as a whole loses it, let's close with cancel
    _elmHost.focusout(function () {
      setTimeout(function () {
        if (_elmHost.find(":focus").length > 0) return;
        if (document.hasFocus()) close(true);
      }, 0);
    });
  }

  function refresh(prompt, inputType, caretLeft, caretTop, caretBottom) {

    const plainPrompt = getPlainStr(prompt);
    var promptUpdate = _plainPrompt.length > 0 && plainPrompt.startsWith(_plainPrompt);
    promptUpdate |= plainPrompt.length > 0 && _plainPrompt.startsWith(plainPrompt);

    _inputType = inputType;
    _prompt = prompt;
    _plainPrompt = plainPrompt;

    // Store current caret position, which we will use to position composition window when results come in
    // Do this when first shown (so windows doesn't jump around as user keeps typing)
    // And if caret Y changes (when input wrapped to new line)
    if ((!promptUpdate && !isVisible()) || caretBottom != _caretPosAtShow.bottom) {
      _caretPosAtShow.left = caretLeft;
      _caretPosAtShow.top = caretTop;
      _caretPosAtShow.bottom = caretBottom;
    }
    refreshSuggestions();
  }

  function positionHost() {

    _elmHost.css("left", "");

    let cx = _caretPosAtShow.left - 10;
    if (cx + _elmHost.width() > _elmHost.parent().outerWidth())
      cx = _elmHost.parent().outerWidth() - _elmHost.width();
    let cy = _caretPosAtShow.bottom;
    _glueBottom = false;
    if (cy + _elmHost.height() + _elmHost.parent().offset().top > $(window).height()) {
      cy = _caretPosAtShow.top - _elmHost.height();
      _glueBottom = true;
    }
    _elmHost.css("left", cx + "px");
    _elmHost.css("top", cy + "px");
  }

  function getPlainStr(biStr) {
    let str = "";
    for (const x of biStr) str += x.hanzi;
    return str;
  }

  function refreshSuggestions() {

    // If visible, disable current content while we're waiting for results
    _elmSuggestions.addClass("loading");

    let reqIx = ++_reqIx;
    var req = $.ajax({
      url: "/api/compose",
      type: "POST",
      data: {
        prompt: _plainPrompt,
        isSimp: _inputType == "simp",
      }
    });
    req.done(function (data) {

      // An earlier request just finished: ignore; we're behind the times
      if (_reqIx != reqIx) return;

      // No results: hide widget
      if (data.words.length == 0) {
        close(false);
        return;
      }

      let ofsBefore = _elmHost.offset();
      let heightBefore = _elmHost.height();
      _elmSuggestions.removeClass("loading");
      _elmSuggestions.html("");
      _elmHost.addClass("visible");

      if (data.pinyinSylls) _elmSuggestions.data("pinyinSylls", data.pinyinSylls.join(" "));
      for (var i = 0; i < data.words.length; ++i) {
        var elm = $("<span></span>");
        elm.text(data.words[i].join(" "));
        if (i == 0) elm.addClass("focus");
        _elmSuggestions.append(elm);
      }
      _elmSuggestions.find("span:first-child").addClass("sel");
      _elmSuggestions.find("span").mousedown(onSuggestionClick);
      if (_glueBottom) {
        let heightDiff = _elmHost.height() - heightBefore;
        _elmHost.offset({ top: ofsBefore.top - heightDiff, left: ofsBefore.left });
      }

      positionHost();

    });
    req.fail(function () {
      close(false);
    });
  }

  function constructSuggestion(convertedText) {
    var hanzi = convertedText;
    var pinyin = _elmSuggestions.data("pinyinSylls");
    hanzi = hanzi.split(/(\s+)/).filter((e) => e.trim().length > 0);
    pinyin = pinyin.split(/(\s+)/).filter((e) => e.trim().length > 0);
    var result = [];
    for (var i = 0; i < hanzi.length; ++i)
      result.push({ hanzi: hanzi[i], pinyin: pinyin[i] });
    return result;
  }

  function fire(convertedText) {

    var evt = new Event('insert');
    evt.result = null;
    evt.prompt = _prompt;
    evt.result = constructSuggestion(convertedText);

    close(true);

    _evtTarget.dispatchEvent(evt);

  } 

  function close(reset) {

    _elmSuggestions.removeClass("loading");
    _elmSuggestions.removeClass("error");
    _elmSuggestions.html("");
    _elmHost.removeClass("visible");

    if (reset) {
      _prompt = null;
      _plainPrompt = "";
    }
  }

  function getSuggestion() {
    if (!isVisible()) return null;
    if (_elmSuggestions.find("span.sel").length == 0) return null;
    return {
      prompt: _prompt,
      result: constructSuggestion(_elmSuggestions.find("span.sel").text()),
    };
  }

  function isVisible() {
    return _elmHost.hasClass("visible");
  }

  function onSuggestionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    fire($(this).text());
  }

  function onKeyDown(e) {
    var handled = false;
    switch (e.code) {
      case "Enter":
        fire(_elmSuggestions.find("span.sel").text());
        handled = true;
        break;
      case "Escape":
        close(true);
        handled = true;
        break;
      case "ArrowDown":
        navigateSuggestions("down");
        handled = true;
        break;
      case "ArrowUp":
        navigateSuggestions("up");
        handled = true;
        break;
      case "ArrowLeft":
        navigateSuggestions("left");
        handled = true;
        break;
      case "ArrowRight":
        navigateSuggestions("right");
        handled = true;
        break;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
    return handled;
  }

  function getRelRect(elm) {
    var parentPos = elm.parent().offset();
    var elmPos = elm.offset();
    return {
      top: elmPos.top - parentPos.top,
      left: elmPos.left - parentPos.left,
      width: elm.width(),
      height: elm.height(),
    };
  }

  function navigateSuggestions(dir) {
    // Index of focused span among spans within suggestions, and element itself
    var ixFocus = 0;
    var elmFocus = _elmSuggestions.find("span:first-child");
    for (var i = 0; i < _elmSuggestions.find("span").length; ++i) {
      if (_elmSuggestions.find("span:nth-child(" + (i + 1) + ")").hasClass("focus")) {
        ixFocus = i;
        elmFocus = _elmSuggestions.find("span:nth-child(" + (i + 1) + ")");
        break;
      }
    }
    var elmNew = null;
    // Right: next one
    if (dir == "right") {
      if (ixFocus < _elmSuggestions.find("span").length - 1) {
        elmNew = _elmSuggestions.find("span:nth-child(" + (ixFocus + 2) + ")");
      }
    }
    // Left: previous one
    else if (dir == "left") {
      if (ixFocus > 0) {
        elmNew = _elmSuggestions.find("span:nth-child(" + (ixFocus) + ")");
      }
    }
    // Up and down: Y position trickery
    else {
      var rectFocus = getRelRect(elmFocus);
      if (dir == "up" && rectFocus.top != 0) {
        for (var i = ixFocus - 1; i >= 0; --i) {
          var elm = _elmSuggestions.find("span:nth-child(" + (i + 1) + ")");
          var elmRect = getRelRect(elm);
          if (elmRect.top < rectFocus.top && elmRect.left <= rectFocus.left && elmRect.left + elmRect.width >= rectFocus.left) {
            elmNew = elm;
            break;
          }
        }
      }
      // Down arrow
      else if (dir == "down") {
        for (var i = ixFocus + 1; i < _elmSuggestions.find("span").length; ++i) {
          var elm = _elmSuggestions.find("span:nth-child(" + (i + 1) + ")");
          var elmRect = getRelRect(elm);
          if (elmRect.top > rectFocus.top && elmRect.left <= rectFocus.left && elmRect.left + elmRect.width >= rectFocus.left) {
            elmNew = elm;
            break;
          }
        }
      }
    }
    // Got a new focus element? Show it.
    if (elmNew != null) {
      elmFocus.removeClass("sel");
      elmFocus.removeClass("focus");
      elmNew.addClass("sel");
      elmNew.addClass("focus");
    }
  }

  return {
    refresh,
    close: _ => close(true),
    getSuggestion,
    onKeyDown,
    isVisible,
    insert: (handler) => _evtTarget.addEventListener("insert", handler),
  };
});
