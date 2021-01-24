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
      <span class="explanation">Something went wrong.</span><br/>
      <i>Let's go back to the <a href="/" class="spa">start page</a>.</i>
    </p>
  </article>
</div>
`;

const htmlTragedy = `
<div class="document error">
  <article>
    <h1>Ouch! Something went wrong.</h1>
    <p>
      Your document's connection to the server has been lost. This is what we know:<br/>
      <span class="explanation">~ sorry, we don't have any details ~</span><br/><br/>
      <i>Let's go back to the <a href="/" class="spa">start page</a>, or try and <a class="reload" href="">reload the document</a>.</i>
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
  var _local = path.startsWith("doc/local-") || path == "doc/sample";
  var _docData = null;
  var _state = {
    inputType: "simp",
  };

  loadDoc();

  function initError(msg) {
    _elmHost.empty();
    _elmHost.html(htmlOpenFail);
    _elmHost.find(".explanation").text(msg);
  }

  function onConnectionTragedy(msg) {
    _elmHost.empty();
    _elmHost.html(htmlTragedy);
    _elmHost.find(".explanation").text(msg);
    _elmHist.find(".reload").attr("href", window.location.href);
  }

  function loadDoc() {
    // Local document (including sample)
    if (_local) {
      _docData = localDocData(_id);
      _docData.startSession((error, loadData) => {
        if (error) initError(true, error);
        else init(loadData.name, loadData.baseText);
      });
      return;
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
        initError("Unexpected response from server.");
        return;
      }
      _docData = onlineDocData(data.data);
      _docData.startSession(function (error, loadData) {
        if (error) initError("Failed to start session; the server said: " + error);
        else init(loadData.name, loadData.baseText);
      }, onConnectionTragedy);
    });
    req.fail(function () {
      initError("The server returned an error. Most likely the document no longer exists.");
    });
  }

  function init(name, baseText) {
    _elmHost.empty();
    _elmHost.html(htmlPage);
    _header = new Comps.EditorHeader({
      target: _elmHost.find(".header")[0],
      props: {
        name: name,
        inputType: _state.inputType,
      }
    });
    _header.$on("inputType", e => {
      _state.inputType = e.detail.val;
      _editor.setInputType(_state.inputType);
    });
    _header.$on("close", () => {
      //_docData.saveContent(_editor.getContent());
      _navigateTo("");
    });

    _editor = require("./editor/editor")(_elmHost.find(".page"));
    _editor.setContent(baseText);
    _editor.setInputType(_state.inputType);
    _editor.onReplace(onReplace);
  }

  function onReplace(e) {
    _docData.processEdit(e.detail.start, e.detail.end, e.detail.newText);
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

