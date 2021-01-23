"use strict";
var $ = require("jquery");

module.exports = (function (sessionKey) {

  var _sessionKey = sessionKey
  var _name = "* unknown *";
  var _ws = null;
  var _wsOpen = false;
  var _wsCloseReason = null;
  var _pingInterval = null;
  var _startCB = null;
  var _baseText = null;
  var _revisionId = -1;

  function getName() {
    return _name;
  }

  function getContent() {
    return [];
  }

  function saveContent(para) {
  }

  function startSession(cb) {
    let sockUrl = window.location.protocol == "https" ? "wss://" : "ws://";
    sockUrl += window.location.host;
    sockUrl += "/sock";
    _ws = new WebSocket(sockUrl);
    _ws.onopen = onSocketOpen;
    _ws.onclose = onSocketClose;
    _ws.onerror = onSocketError;
    _ws.onmessage = onSocketMessage;
    _startCB = cb;
  }

  function closeSession() {
    clearInterval(_pingInterval);
    _pingInterval = null;
    _ws.close();
    _wsOpen = false;
    _ws = null;
  }

  function onSocketOpen() {
    _wsOpen = true;
    _ws.send("SESSIONKEY " + _sessionKey);
  };

  function onSocketClose(e) {
    if (e.reason) _wsCloseReason = "Server said: " + e.reason;
    else _wsCloseReason = "Server said nothing.";
    _wsOpen = false;
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(_wsCloseReason);
    }
  }

  function onSocketError() {
    _wsCloseReason = "Socket error.";
    _wsOpen = false;
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(_wsCloseReason);
    }
  }

  function onSocketMessage(e) {
    const msg = e.data;
    if (typeof msg !== "string") return;
    if (msg.startsWith("HELLO ")) {
      const data = JSON.parse(msg.substring(6));
      _name = data.name;
      _baseText = data.text;
      _revisionId = data.revisionId;
      if (_startCB != null) {
        let cb = _startCB;
        _startCB = null;
        cb();
      }
      _pingInterval = setInterval(doPing, 15000);
    }
  };

  function doPing() {
    if (_ws && _wsOpen)
      _ws.send("PING");
  }

  return {
    startSession,
    closeSession,
    getName,
    saveContent,
    getContent,
  };
});
