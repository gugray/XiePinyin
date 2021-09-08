"use strict";
var $ = require("jquery");
var auth = require("./auth.js");
var localDocData = require("./localdocdata");
var onlineDocData = require("./onlinedocdata");

const initialInputType = "simp";

const htmlPage = `
<div class="document">
  <div class="header"></div>
  <div class="page"></div>
</div>
`;

const htmlLogin = `
<div class="document">
  <article>
    <h1>Log in to open document</h1>
    <p class="loginPara"></p>
  </article>
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
    inputType: initialInputType,
  };

  if (_local) loadLocalDoc();
  else if (!auth.isLoggedIn()) loginAndLoadOnline();
  else loadOnlineDoc();

  function loginAndLoadOnline() {
    _elmHost.empty();
    _elmHost.html(htmlLogin);

    var loginCtrl = new Comps.LoginControl({
      target: _elmHost.find(".loginPara")[0],
      props: {
        showCancelButton: false,
      }
    });
    loginCtrl.$on("done", () => {
      if (!auth.isLoggedIn()) return;
      _elmHost.empty();
      loadOnlineDoc();
    });

  }

  function initError(msg) {
    _elmHost.empty();
    _elmHost.html(htmlOpenFail);
    _elmHost.find(".explanation").text(msg);
  }

  function onConnectionTragedy(msg) {
    _elmHost.empty();
    _elmHost.html(htmlTragedy);
    _elmHost.find(".explanation").text(msg);
    _elmHost.find(".reload").attr("href", window.location.href);
  }

  function loadLocalDoc() {
    _docData = localDocData(_id);
    _docData.startSession((error, loadData) => {
      if (error) initError(true, error);
      else init(loadData.name, loadData.baseText);
    });
  }

  function loadOnlineDoc() {
    // Retrieve online document
    var req = $.ajax({
      url: "/api/doc/open",
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
      _docData = onlineDocData(data.data, _id);
      _docData.startSession(function (error, loadData) {
        if (error) initError("Failed to start session; the server said: " + error);
        else init(loadData.name, loadData.baseText, loadData.sel, loadData.peerSelections);
      }, onConnectionTragedy, onRemoteUpdate);
    });
    req.fail(function () {
      initError("The server returned an error. Maybe the document no longer exists, or you are not logged in.");
    });
  }

  function init(name, baseText, sel, peerSelections) {
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
    _header.$on("exportDocx", onExportDoc);
    _header.$on("close", _ => {
      //_docData.saveContent(_editor.getContent());
      _navigateTo("");
    });

    _editor = require("./editor/editor")(_elmHost.find(".page"), onKeyDown);
    _editor.setContent(baseText, sel);
    _editor.setPeerSelections(peerSelections);
    _editor.setInputType(_state.inputType);
    _editor.onReplace(onReplace);
    _editor.onSelChange(onSelChange);
  }

  function onKeyDown(e) {
    var ctrlOnly = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    var handled = false;
    switch (e.code) {
      case "KeyM":
        if (ctrlOnly) {
          let newInputType = _state.inputType == "simp" ? "trad" : "simp";
          _header.$set({ inputType: newInputType });
          _state.inputType = newInputType;
          _editor.setInputType(newInputType);
          handled = true;
        }
        break;
    }
    return handled;
  }

  function onRemoteUpdate(updater, peerSelections) {
    if (updater != null) {
      let text = _editor.getContent();
      let sel = _editor.getSel();
      let updated = updater(text, sel.start, sel.end);
      _editor.setContent(updated.text, { start: updated.selStart, end: updated.selEnd });
    }
    _editor.setPeerSelections(peerSelections);
  }

  function onReplace(e) {
    let peerSelections = _docData.processEdit(e.detail.start, e.detail.end, e.detail.newText);
    _editor.setPeerSelections(peerSelections);
  }

  function onSelChange(e) {
    _docData.processSelChange(e.detail);
  }

  function beforeLeave() {
    if (_docData.closeSession) _docData.closeSession();
    _header.$destroy();
    _header = null;
  }

  function onExportDoc() {
    _header.$set({ docxEnabled: false });
    var req = $.ajax({
      url: "/api/doc/exportdocx",
      type: "POST",
      data: {
        docId: _id,
      }
    });
    req.done(function (data) {
      _header.$set({ docxEnabled: true });
      if (!data.result == "OK") return;
      const fn = data.data;
      window.open("/api/doc/download?name=" + fn, '_blank');
      //window.location.href = "/api/doc/download?name=" + fn;
    });
    req.fail(function () {
      _header.$set({ docxEnabled: true });
    });

  }

  return {
    beforeLeave: beforeLeave,
  };
});

