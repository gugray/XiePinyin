"use strict";
var $ = require("jquery");
var CS = require('./editor/changeset');

module.exports = (function (sessionKey) {

  var _sessionKey = sessionKey
  var _name = "* unknown *";
  var _ws = null;
  var _wsOpen = false;
  var _pingInterval = null;
  var _startCB = null;
  var _tragedyCB = null;
  var _baseText = null;
  var _revisionId = -1;
  var _receivedChanges = null;
  var _sentChanges = null;
  var _localChanges = null;
  var _receivedChangeCB = null;
  var _sendChangeInterval = null;

  function startSession(cbStart, cbTragedy) {
    let sockUrl = window.location.protocol == "https" ? "wss://" : "ws://";
    sockUrl += window.location.host;
    sockUrl += "/sock";
    _ws = new WebSocket(sockUrl);
    _ws.onopen = onSocketOpen;
    _ws.onclose = onSocketClose;
    _ws.onerror = onSocketError;
    _ws.onmessage = onSocketMessage;
    _startCB = cbStart;
    _tragedyCB = cbTragedy;
  }

  function closeSession() {
    clearInterval(_pingInterval);
    clearInterval(_sendChangeInterval);
    _pingInterval = null;
    _sendChangeInterval = null;
    _ws.close();
    _wsOpen = false;
    _ws = null;
    _receivedChangeCB = null;
  }

  function onSocketOpen() {
    _wsOpen = true;
    _ws.send("SESSIONKEY " + _sessionKey);
  };

  function onSocketClose(e) {
    let closeReason = "";
    if (e.reason) closeReason = "Server said: " + e.reason;
    else closeReason = "Server said nothing.";
    _wsOpen = false;
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(closeReason);
    }
  }

  function onSocketError() {
    let closeReason = "Socket error.";
    _wsOpen = false;
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(closeReason);
    }
    else shoutTragedy(closeReason);
  }

  function processHello(detail) {
    const data = JSON.parse(detail);
    _name = data.name;
    _baseText = data.text;
    _revisionId = data.revisionId;
    _receivedChanges = CS.makeIdent(_baseText.length);
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(null, {
        name: _name,
        baseText: _baseText,
      });
    }
    _pingInterval = setInterval(doPing, 15000);
    _sendChangeInterval = setInterval(doSendChange, 500);
  }

  function processUpdate(detail) {
    const upd = JSON.parse(detail);
  }

  function processAckChange(detail) {

  }

  function onSocketMessage(e) {
    const msg = e.data;
    if (typeof msg !== "string") return;
    if (msg.startsWith("HELLO ")) processHello(msg.substring(6));
    else if (msg.startsWith("UPDATE ")) processUpdate(msg.substring(7));
    else if (msg.startsWith("ACKCHANGE ")) processAckChange(msg.substring(10));
  };

  function doPing() {
    if (_ws && _wsOpen)
      _ws.send("PING");
  }

  function onReceivedChange(cb) {
    _receivedChangeCB = cb;
  }

  function doSendChange() {
    if (_sentChanges != null || _localChanges == null) return;
    if (!_ws || !_wsOpen) {
      shoutTragedy("Trying to send changes but socket is not open.");
      return;
    }
    _sentChanges = _localChanges;
    _localChanges = null;
    let msg = "CHANGE " + _revisionId + " " + JSON.stringify(_sentChanges);
    _ws.send(msg);
  }

  function processEdit(start, end, newText) {
    if (_localChanges == null) {
      if (_sentChanges != null) _localChanges = CS.makeIdent(_sentChanges.lengthAfter);
      else _localChanges = CS.makeIdent(_receivedChanges.lengthAfter);
    }
    _localChanges = CS.addReplace(_localChanges, start, end, newText);
  }

  function shoutTragedy(msg) {
    if (_tragedyCB)
      setTimeout(() => _tragedyCB(msg), 0);
  }

  return {
    startSession,
    closeSession,
    processEdit,
    onReceivedChange,
  };
});
