"use strict";
var $ = require("jquery");
var samplePara = require("./editor/samplepara");
var localdocdata = require("./localdocdata");

const htmlPage = `
<div class="document">
  <div class="header"></div>
  <div class="page"></div>
</div>
`;

const htmlNoSuchDoc = `
<div class="document error">
  <article>
    <h1>Document not found</h1>
    <p>
      I'm sorry; this document does not seem to exist.<br/>
      <i>Let's go back to the <a href="/" class="ajax">start page</a>.</i>
    </p>
  </article>
</div>
`;

module.exports = (function (elmHost, path, navigateTo) {
  var _elmHost = elmHost;
  var _navigateTo = navigateTo;
  var _header = null;
  var _editor = null;
  var _id = path.replace("doc/local-", "").replace("doc/", "");
  var _local = path.startsWith("doc/local-");
  var _docData = localdocdata(_id);
  var _content = samplePara();
  var _state = {
    inputType: "simp",
  };

  loadDoc();

  function loadDoc() {
    if (_id == "sample") {
      init();
      return;
    }
    _content = _docData.getContent();
    if (_content) {
      init();
      return;
    }
    _elmHost.empty();
    _elmHost.html(htmlNoSuchDoc);
  }

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);
    _header = new Comps.EditorHeader({
      target: _elmHost.find(".header")[0],
      props: {
        name: _docData.getName(),
        inputType: _state.inputType,
      }
    });
    _header.$on("inputType", e => {
      _state.inputType = e.detail.val;
      _editor.setInputType(_state.inputType);
    });
    _header.$on("close", () => {
      _docData.saveContent(_editor.getContent());
      _navigateTo("");
    });

    _editor = require("./editor/editor")(_elmHost.find(".page"));
    _editor.setContent(_content);
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

