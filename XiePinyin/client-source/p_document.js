"use strict";
var $ = require("jquery");
var samplePara = require("./samplepara");

const htmlPage = `
<div class="document">
  <div class="header"></div>
  <div class="page"></div>
</div>
`;

module.exports = (function (elmHost, path) {
  var _elmHost = elmHost;
  var _header = null;
  var _editor = null;
  var _state = {
    inputType: "trad",
  };

  init();

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);
    _header = new Comps.EditorHeader({
      target: _elmHost.find(".header")[0],
      props: {
        inputType: _state.inputType,
      }
    });
    _header.$on("inputType", e => {
      _state.inputType = e.detail.val;
      _editor.setInputType(_state.inputType);
    });

    _editor = require("./editor")(_elmHost.find(".page"));
    _editor.setContent(samplePara());
    _editor.setInputType(_state.inputType);

  }

  function beforeLeave() {
    _header.$destroy();
    _header = null;
  }

  return {
    beforeLeave: beforeLeave,
  };
});

