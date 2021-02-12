﻿"use strict";
var $ = require("jquery");
var EventTarget = require("../eventtarget");

const widgetHtml = `
<input id="composerHidden" type="text" disabled />
<div class="inputarea"><input id="composer" type="text" disabled /></div>
<div class="suggestions" data-pinyinSylls=""></div>
`;

const htmlPlaceholder = "<span>Type pin1yin1 with tone marks.</span>"

module.exports = (function (elmHost) {
  var _elmHost = elmHost;
  var _elmInput;
  var _elmHiddenInput;
  var _elmSuggestions;
  var _evtTarget = new EventTarget();
  var _inputType = null;
  var _glueBottom = false;

  init();

  function init() {
    _elmHost.append($(widgetHtml));
    _elmInput = _elmHost.find("input#composer");
    _elmHiddenInput = _elmHost.find("input#composerHidden");
    _elmHost.find("input").keydown(onKeyDown);
    _elmInput.on("input", onInput);
    _elmInput.on("paste", function (e) { e.preventDefault(); });
    _elmSuggestions = _elmHost.find(".suggestions");

    // If composer loses focus, and it's not because document as a whole loses it, let's close with cancel
    _elmHost.focusout(function () {
      setTimeout(function () {
        if (_elmHost.find(":focus").length > 0) return;
        if (document.hasFocus()) close(null);
      }, 0);
    });
  }

  function show(initialText, inputType, caretLeft, caretTop, caretBottom) {
    _inputType = inputType;
    _elmInput.val(initialText);

    _elmSuggestions.addClass("info")
    _elmSuggestions.html(htmlPlaceholder);
    _elmSuggestions = _elmHost.find(".suggestions");

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

    _elmHost.addClass("visible");
    _elmHost.find("input").prop("disabled", false);
    _elmInput.focus();
    _elmInput.focus(() => _elmSuggestions.find("span").removeClass("focus"));

    refreshSuggestions();
  }

  function onInput() {
    refreshSuggestions();
  }

  function refreshSuggestions() {
    _elmSuggestions.addClass("loading");
    _elmSuggestions.data("pinyinSylls", "");
    var prompt = (_elmInput.val());
    if (prompt == "") {
      let ofsBefore = _elmHost.offset();
      let heightBefore = _elmHost.height();
      _elmSuggestions.html(htmlPlaceholder);
      _elmSuggestions.addClass("info")
      if (_glueBottom) {
        let heightDiff = _elmHost.height() - heightBefore;
        _elmHost.offset({ top: ofsBefore.top - heightDiff, left: ofsBefore.left });
      }
      return;
    }
    var req = $.ajax({
      url: "/api/compose/",
      type: "POST",
      data: {
        prompt: prompt,
        isSimp: _inputType == "simp",
      }
    });
    req.done(function (data) {
      let ofsBefore = _elmHost.offset();
      let heightBefore = _elmHost.height();
      _elmSuggestions.removeClass("loading");
      _elmSuggestions.removeClass("info");
      _elmSuggestions.html("");
      if (data.pinyinSylls) _elmSuggestions.data("pinyinSylls", data.pinyinSylls.join(" "));
      for (var i = 0; i < data.words.length; ++i) {
        var elm = $("<span></span>");
        elm.text(data.words[i].join(" "));
        _elmSuggestions.append(elm);
      }
      var elm = $("<span></span>");
      elm.text(prompt);
      _elmSuggestions.append(elm);
      _elmSuggestions.find("span:first-child").addClass("sel");
      _elmSuggestions.find("span").mousedown(onSuggestionClick);
      if (_glueBottom) {
        let heightDiff = _elmHost.height() - heightBefore;
        _elmHost.offset({ top: ofsBefore.top - heightDiff, left: ofsBefore.left });
      }
    });
    req.fail(function () {
      _elmSuggestions.removeClass("loading");
      _elmSuggestions.addClass("error");
      _elmSuggestions.addClass("info");
      _elmSuggestions.html("<span>Something went wrong.</span>")
    });
  }

  function close(selectedText, withSpace) {
    _elmHost.find("input").prop("disabled", true);
    _elmSuggestions.removeClass("loading");
    _elmSuggestions.removeClass("info");
    _elmSuggestions.removeClass("error");
    _elmSuggestions.html("");
    _elmHost.removeClass("visible");
    var evt = new Event('closed');
    evt.result = null;
    if (selectedText != null) {
      var hanzi = selectedText;
      var pinyin = selectedText == _elmInput.val() ? selectedText : _elmSuggestions.data("pinyinSylls");
      hanzi = hanzi.split(/(\s+)/).filter((e) => e.trim().length > 0);
      pinyin = pinyin.split(/(\s+)/).filter((e) => e.trim().length > 0);
      evt.result = [];
      for (var i = 0; i < hanzi.length; ++i)
        evt.result.push({ hanzi: hanzi[i], pinyin: pinyin[i] });
      if (withSpace) evt.result.push({ hanzi: " ", pinyin: " " });
    }
    _evtTarget.dispatchEvent(evt);
  }

  function onSuggestionClick(e) {
    e.preventDefault();
    e.stopPropagation();
    close($(this).text());
  }

  function onKeyDown(e) {
    var fromHiddenInput = e.target.id == "composerHidden";
    var handled = false;
    switch (e.code) {
      case "Tab":
        handled = true;
        break;
      case "Space":
        handled = true;
        var sstart = _elmInput[0].selectionStart;
        var ssend = _elmInput[0].selectionEnd;
        // We don't allow spaces inside. If space hit at end, that's like Enter.
        if (sstart == ssend && sstart == _elmInput.val().length && _elmInput.val().length != 0)
          close(_elmSuggestions.find("span.sel").text(), true);
        break;
      case "Enter":
        close(_elmSuggestions.find("span.sel").text());
        break;
      case "Escape":
        close(null);
        break;
      case "ArrowDown":
        if (fromHiddenInput) navigateSuggestions("down");
        else {
          _elmHiddenInput.focus();
          _elmSuggestions.find("span.sel").addClass("focus");
        }
        handled = true;
        break;
      case "ArrowUp":
        if (fromHiddenInput) {
          navigateSuggestions("up");
          handled = true;
        }
        break;
      case "ArrowLeft":
        if (fromHiddenInput) {
          navigateSuggestions("left");
          handled = true;
        }
        break;
      case "ArrowRight":
        if (fromHiddenInput) {
          navigateSuggestions("right");
          handled = true;
        }
        // If cursor is at end of pinyin input and user presses right, take it as "down + right"
        else if (_elmInput[0].selectionStart == _elmInput.val().length) {
          _elmHiddenInput.focus();
          _elmSuggestions.find("span.sel").addClass("focus");
          navigateSuggestions("right");
          handled = true;
        }
        break;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
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
      // Up arrow and we're in top row: we go back to input field
      if (rectFocus.top == 0 && dir == "up") {
        elmFocus.removeClass("focus");
        _elmInput.focus();
      }
      // Up arrow in non-top-row
      else if (dir == "up") {
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
    show: show,
    closed: function (handler) {
      _evtTarget.addEventListener("closed", handler);
    },
  };
});
