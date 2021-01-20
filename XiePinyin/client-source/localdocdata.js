"use strict";
var $ = require("jquery");

module.exports = (function (id) {

  var _id = id;

  var _sample = {
    name: "Sample document",
    id: "sample",
    lastEditedIso: new Date().toISOString(),
  };

  function getDocInfo() {
    var docInfos = [];
    var docsJson = localStorage.getItem("docs");
    if (docsJson) docInfos = JSON.parse(docsJson);
    docInfos.push(_sample);
    return docInfos.find(itm => itm.id == id);
  }

  function getName() {
    var di = getDocInfo();
    return di.name;
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

  function getContent() {
    let docDataJson = localStorage.getItem("doc-" + _id);
    if (docDataJson) {
      let docData = JSON.parse(docDataJson);
      return docData.paras[0];
    }
    return null;
  }

  function saveContent(para) {
    if (_id == "sample") return;
    var docJson = localStorage.getItem("doc-" + _id);
    var doc = JSON.parse(docJson);
    // No touchie if content didn't actually change
    var oldContentJson = JSON.stringify(doc.paras);
    var newContentJson = JSON.stringify([para]);
    if (oldContentJson == newContentJson) return;

    doc.paras[0] = para;
    localStorage.setItem("doc-" + _id, JSON.stringify(doc));
    touch();
  }

  return {
    getName,
    saveContent,
    getContent,
  };
});
