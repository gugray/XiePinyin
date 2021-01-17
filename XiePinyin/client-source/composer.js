"use strict";
var $ = require("jquery");
var EventTarget = require("./eventtarget");

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

  init();

  function init() {
    _elmHost.append($(widgetHtml));
    _elmInput = _elmHost.find("input#composer");
    _elmHiddenInput = _elmHost.find("input#composerHidden");
    _elmHost.find("input").keydown(onKeyDown);
    _elmInput.on("input", onInput);
    _elmInput.on("paste", function (e) { e.preventDefault(); });
    _elmSuggestions = _elmHost.find(".suggestions");
  }

  function show(initialText, inputType) {
    _inputType = inputType;
    _elmInput.val(initialText);
    _elmHost.find("input").prop("disabled", false);
    _elmHost.addClass("visible");
    _elmInput.focus();
    _elmInput.focus(() => _elmSuggestions.find("span").removeClass("focus"));
    _elmSuggestions.addClass("info")
    _elmSuggestions.html(htmlPlaceholder);
    _elmSuggestions = _elmHost.find(".suggestions");
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
      _elmSuggestions.html(htmlPlaceholder);
      _elmSuggestions.addClass("info")
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
      _elmSuggestions.find("span").click(onSuggestionClick);
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
      if (withSpace) evt.withSpace = true;
      else evt.withSpace = false;
    }
    _evtTarget.dispatchEvent(evt);
  }

  function onSuggestionClick() {
    close($(this).text());
  }

  function onKeyDown(e) {
    var isHidden = e.target.id == "composerHidden";
    var handled = false;
    switch (e.keyCode) {
      case 9: // Tab
        handled = true;
        break;
      case 32: // Space
        handled = true;
        var sstart = _elmInput[0].selectionStart;
        var ssend = _elmInput[0].selectionEnd;
        // We don't allow spaces inside. If space hit at end, that's like Enter.
        if (sstart == ssend && sstart == _elmInput.val().length && _elmInput.val().length != 0)
          close(_elmSuggestions.find("span.sel").text(), true);
        break;
      case 13: // Enter
        close(_elmSuggestions.find("span.sel").text());
        break;
      case 27: // Esc
        close(null);
        break;
      case 40: // Down arrow
        if (isHidden) navigateSuggestions("down");
        else {
          _elmHiddenInput.focus();
          _elmSuggestions.find("span.sel").addClass("focus");
        }
        handled = true;
        break;
      case 38: // Up arrow
        if (isHidden) {
          navigateSuggestions("up");
          handled = true;
        }
        break;
      case 37: // Left arrow
        if (isHidden) {
          navigateSuggestions("left");
          handled = true;
        }
        break;
      case 39: // Right arrow
        if (isHidden) {
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
