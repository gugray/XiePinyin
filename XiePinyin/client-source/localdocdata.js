"use strict";
var $ = require("jquery");
var samplePara = require("./samplepara");
var CS = require('./editor/changeset');

module.exports = (function (id) {

  var _id = id;
  var _baseText = null;
  var _changes = null;

  function getDocInfo() {
    if (_id == "sample") {
      return {
        name: "Sample document",
        id: "sample",
        lastEditedIso: new Date().toISOString(),
      };
    }
    let docsJson = localStorage.getItem("docs");
    let docInfos = JSON.parse(docsJson);
    return docInfos.find(itm => itm.id == id);
  }

  function touch() {
    var di = getDocInfo();
    di.lastEditedIso = new Date().toISOString();
    saveDocInfo(di);
  }

  function saveDocInfo(di) {
    if (di.id == "sample") return;
    var docInfos = [];
    var docsJson = localStorage.getItem("docs");
    if (docsJson) docInfos = JSON.parse(docsJson);
    var newInfos = [];
    for (var i = 0; i < docInfos.length; ++i) {
      if (docInfos[i].id != di.id) newInfos.push(docInfos[i]);
      else newInfos.push(di);
    }
    localStorage.setItem("docs", JSON.stringify(newInfos));
  }

  function startSession(startCB) {
    if (_id == "sample") _baseText = samplePara();
    else {
      let docDataJson = localStorage.getItem("doc-" + _id);
      let docData = JSON.parse(docDataJson);
      _baseText = docData.xieText;
    }
    _changes = CS.makeIdent(_baseText.length);
    
    setTimeout(() => {
      startCB(null, {
        name: getDocInfo().name,
        baseText: _baseText
      });
    }, 0);
  }

  function saveContent() {
    if (_id == "sample") return;

    let newText = CS.apply(_baseText, _changes);

    var docJson = localStorage.getItem("doc-" + _id);
    var doc = JSON.parse(docJson);

    // No touchie if content didn't actually change
    var oldContentJson = JSON.stringify(doc.xieText);
    var newContentJson = JSON.stringify(newText);
    if (oldContentJson == newContentJson) return;

    doc.xieText = newText;
    localStorage.setItem("doc-" + _id, JSON.stringify(doc));
    touch();
  }

  function processEdit(start, end, newText) {
    _changes = CS.addReplace(_changes, start, end, newText);
    saveContent();
  }

  return {
    startSession,
    processEdit,
  };
});
