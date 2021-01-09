"use strict";
var $ = require("jquery");
var EventTarget = require("./eventtarget");

const html = `
<div class="inputarea"><input id="composer" type="text" disabled /></div>
<div class="suggestions">
  <span class="sel focus">拉面</span>
  <span>la1mian4</span>
</div>
`;

module.exports = (function (elmHost) {
  var _elmHost = elmHost;
  var _elmInput;
  var _elmSuggestions;
  var _evtTarget = new EventTarget();

  init();

  function init() {
    _elmHost.append($(html));
    _elmInput = _elmHost.find("input");
    _elmInput.keydown(onKeyDown);
    _elmSuggestions = _elmHost.find(".suggestions");
  }

  function show(initialText) {
    _elmInput.val(initialText);
    _elmInput.prop("disabled", false);
    _elmHost.addClass("visible");
    _elmInput.focus();
  }

  function close(result) {
    _elmInput.prop("disabled", true);
    _elmHost.removeClass("visible");
    var evt = new Event('closed');
    evt.result = result;
    _evtTarget.dispatchEvent(evt);
  }

  function onKeyDown(e) {
    var handled = false;
    switch (e.keyCode) {
      //case 13: // Enter
      case 27: // Esc
        close(null);
        break;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return {
    show: show,
    closed: function (handler) {
      _evtTarget.addEventListener("closed", handler);
    },
  };
});
