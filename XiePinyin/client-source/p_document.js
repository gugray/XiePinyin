"use strict";
var $ = require("jquery");
var samplePara = require("./editor/samplepara");
var localDocData = require("./localdocdata");
var onlineDocData = require("./onlinedocdata");

const htmlPage = `
<div class="document">
  <div class="header"></div>
  <div class="page"></div>
</div>
`;

const htmlOpenFail = `
<div class="document error">
  <article>
    <h1>Failed to open document</h1>
    <p>
      <span class="explanation">I'm sorry; this document does not seem to exist.</span><br/>
      <i>Let's go back to the <a href="/" class="spa">start page</a>.</i>
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
  var _docData = null;
  var _content = null;
  var _state = {
    inputType: "simp",
  };

  loadDoc();

  function loadDoc() {
    // Sample document: hard-wired data
    if (_id == "sample") {
      _content = samplePara();
      init();
      return;
    }
    // Local document: Get from local store
    if (_local) {
      _docData = localDocData(_id);
      _content = _docData.getContent();
      if (_content) {
        init();
        return;
      }
    }
    // Retrieve online document
    var req = $.ajax({
      url: "/api/doc/open/",
      type: "GET",
      data: {
        docId: _id,
      }
    });
    req.done(function (data) {
      if (data.result != "OK") {
        _elmHost.empty();
        _elmHost.html(htmlOpenFail);
        _elmHost.find(".explanation").text("Unexpected response from server.");
        return;
      }
      _docData = onlineDocData(data.data);
      _docData.startSession(function (error) {
        if (error) {
          _elmHost.empty();
          _elmHost.html(htmlOpenFail);
          _elmHost.find(".explanation").text("Failed to start session; the server said: " + error);
        }
        else {
          _content = _docData.getContent();
          init();
        }
      });
    });
    req.fail(function () {
      _elmHost.empty();
      _elmHost.html(htmlOpenFail);
      _elmHost.find(".explanation").text("The server returned an error. Most likely the document no longer exists.");
    });
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
    if (_docData.closeSession) _docData.closeSession();
    _header.$destroy();
    _header = null;
  }

  return {
    beforeLeave: beforeLeave,
  };
});

