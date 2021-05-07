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
  var _glueBottom = false;

  init();

  function init() {
    _elmHost.append($(widgetHtml));
    _elmSuggestions = _elmHost.find(".suggestions");

    // If composer loses focus, and it's not because document as a whole loses it, let's close with cancel
    _elmHost.focusout(function () {
      setTimeout(function () {
        if (_elmHost.find(":focus").length > 0) return;
        if (document.hasFocus()) close(null);
      }, 0);
    });
  }

  function refresh(prompt, inputType, caretLeft, caretTop, caretBottom) {
    _inputType = inputType;
    _prompt = prompt;

    // If currently not visible, calculate where window will go
    if (!_elmHost.hasClass("visible")) {
      let cx = caretLeft - _elmHost.width() / 2;
      if (cx < 0) cx = 0;
      else if (cx + _elmHost.width() > _elmHost.parent().outerWidth()) cx = _elmHost.parent().outerWidth() - _elmHost.width();
      let cy = caretBottom;
      _glueBottom = false;
      if (cy + _elmHost.height() + _elmHost.parent().offset().top > $(window).height()) {
        cy = caretTop - _elmHost.height();
        _glueBottom = true;
      }
      _elmHost.css("left", cx + "px");
      _elmHost.css("top", cy + "px");
    }
    // If visible, disable current content while we're waiting for results
    _elmSuggestions.addClass("loading")
    refreshSuggestions();
  }

  

  function refreshSuggestions() {
    let prompt = "";
    for (const x of _prompt) prompt += x.hanzi;
    var req = $.ajax({
      url: "/api/compose/",
      type: "POST",
      data: {
        prompt: prompt,
        isSimp: _inputType == "simp",
      }
    });
    req.done(function (data) {

      if (data.words.length == 0) {
        close();
        return;
      }

      let ofsBefore = _elmHost.offset();
      let heightBefore = _elmHost.height();
      _elmSuggestions.removeClass("loading");
      _elmSuggestions.removeClass("info");
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
    });
    req.fail(function () {
      close();
    });
  }

  function close(selectedText, withSpace) {
    _elmSuggestions.removeClass("loading");
    _elmSuggestions.removeClass("info");
    _elmSuggestions.removeClass("error");
    _elmSuggestions.html("");
    _elmHost.removeClass("visible");
    var evt = new Event('insert');
    evt.result = null;
    if (selectedText) {
      evt.prompt = _prompt;
      evt.result = constructSuggestion(selectedText);
      if (withSpace) evt.result.push({ hanzi: " ", pinyin: " " });
    }
    _evtTarget.dispatchEvent(evt);
  }

  function constructSuggestion(selectedText) {
    var hanzi = selectedText;
    var pinyin = _elmSuggestions.data("pinyinSylls");
    hanzi = hanzi.split(/(\s+)/).filter((e) => e.trim().length > 0);
    pinyin = pinyin.split(/(\s+)/).filter((e) => e.trim().length > 0);
    var result = [];
    for (var i = 0; i < hanzi.length; ++i)
      result.push({ hanzi: hanzi[i], pinyin: pinyin[i] });
    return result;
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
    close($(this).text());
  }

  function onKeyDown(e) {
    var handled = false;
    switch (e.code) {
      case "Enter":
        close(_elmSuggestions.find("span.sel").text());
        handled = true;
        break;
      case "Space":
        close(_elmSuggestions.find("span.sel").text(), true);
        handled = true;
        break;
      case "Escape":
        close(null);
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
    refresh: refresh,
    close: function () {
      close(null);
    },
    getSuggestion,
    onKeyDown: onKeyDown,
    isVisible,
    insert: function (handler) {
      _evtTarget.addEventListener("insert", handler);
    },
  };
});
