"use strict";
var $ = require("jquery");
var CS = require('./editor/changeset');

const pingInterval = 30000;
const sendChangeInterval = 5000;

module.exports = (function (sessionKey) {

  var _sessionKey = sessionKey
  var _name = "* unknown *";
  var _ws = null;
  var _wsOpen = false;
  var _pingInterval = null;
  var _startCB = null;
  var _tragedyCB = null;
  var _updateCB = null;
  var _baseText = null;
  var _revisionId = -1;
  var _receivedChanges = null;
  var _sentChanges = null;
  var _sentChangesFromId = -1;
  var _localChanges = null;
  var _sendChangeInterval = null;

  function startSession(cbStart, cbTragedy, cbUpdate) {
    let sockUrl = window.location.protocol.startsWith("https") ? "wss://" : "ws://";
    sockUrl += window.location.host;
    sockUrl += "/sock";
    _ws = new WebSocket(sockUrl);
    _ws.onopen = onSocketOpen;
    _ws.onclose = onSocketClose;
    _ws.onerror = onSocketError;
    _ws.onmessage = onSocketMessage;
    _startCB = cbStart;
    _tragedyCB = cbTragedy;
    _updateCB = cbUpdate;
  }

  function closeSession() {
    clearInterval(_pingInterval);
    clearInterval(_sendChangeInterval);
    _pingInterval = null;
    _sendChangeInterval = null;
    _tragedyCB = null;
    _ws.close();
    _wsOpen = false;
    _ws = null;
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
    else shoutTragedy(closeReason);
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
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      cb(null, {
        name: _name,
        baseText: _baseText,
      });
    }
    _pingInterval = setInterval(doPing, pingInterval);
    _sendChangeInterval = setInterval(doSendChange, sendChangeInterval);
  }

  function processUpdate(detail) {
    const ix = detail.indexOf(" ");
    const newRevisionId = parseInt(detail.substring(0, ix), 10);
    if (newRevisionId != _revisionId + 1) {
      shoutTragedy("Received update to next revision " + newRevisionId + " but our current revision is " + _revisionId);
      return;
    }
    const cs = JSON.parse(detail.substring(ix + 1));
    let newReceivedChanges = _receivedChanges == null ? cs : CS.compose(_receivedChanges, cs);
    let newSentChanges = null;
    if (_sentChanges != null) newSentChanges = CS.follow(cs, _sentChanges);
    let newLocalChanges = null;
    if (_localChanges != null) {
      let sentie = _sentChanges;
      if (sentie == null && _receivedChanges != null) sentie = CS.makeIdent(_receivedChanges.lengthAfter);
      if (sentie == null) sentie = CS.makeIdent(_baseText.length);
      let x = CS.follow(sentie, cs);
      newLocalChanges = CS.follow(x, _localChanges);
    }

    // Changeset to update view (editor content)
    let sentie = _sentChanges;
    if (sentie == null && _receivedChanges != null) sentie = CS.makeIdent(_receivedChanges.lengthAfter);
    if (sentie == null) sentie = CS.makeIdent(_baseText.length);
    let localie = _localChanges;
    if (localie == null && _sentChanges != null) localie = CS.makeIdent(_sentChanges.lengthAfter);
    if (localie == null && _receivedChanges != null) localie =  CS.makeIdent(_receivedChanges.lengthAfter);
    if (localie == null) localie = CS.makeIdent(_baseText.length);
    let x = CS.follow(sentie, cs);
    let editorChanges = CS.follow(localie, x);

    _receivedChanges = newReceivedChanges;
    _sentChanges = newSentChanges;
    _localChanges = newLocalChanges;
    _revisionId = newRevisionId;
    _updateCB(function (currText, selStart, selEnd) {
      let newText = CS.apply(currText, editorChanges);
      return {
        text: newText,
        selStart: 0,
        selEnd: 0,
      };
    });
  }

  function processAckChange(detail) {
    const ix = detail.indexOf(" ");
    const baseRevisionId = parseInt(detail.substring(0, ix), 10);
    const newRevisionId = parseInt(detail.substring(ix + 1), 10);
    if (baseRevisionId != _sentChangesFromId) {
      shoutTragedy("Received change ACK for change sent at " + _sentChangesFromId + " but ACK is for " + baseRevisionId);
      return;
    }
    if (newRevisionId != _revisionId + 1) {
      shoutTragedy("Received change ACK for change, saying latest revision is " + newRevisionId + " but our current revision is " + _revisionId);
      return;
    }
    if (_receivedChanges == null) _receivedChanges = _sentChanges;
    else _receivedChanges = CS.compose(_receivedChanges, _sentChanges);
    _sentChanges = null;
    _sentChangesFromId = -1;
    _revisionId = newRevisionId;
  }

  function onSocketMessage(e) {
    let verb = "n/a";
    try {
      const msg = e.data;
      if (typeof msg !== "string") return;
      let ixSpace = msg.indexOf(" ");
      if (ixSpace != -1) verb = msg.substring(0, ixSpace);
      if (msg.startsWith("HELLO ")) processHello(msg.substring(6));
      else if (msg.startsWith("UPDATE ")) processUpdate(msg.substring(7));
      else if (msg.startsWith("ACKCHANGE ")) processAckChange(msg.substring(10));
    }
    catch (e) {
      shoutTragedy("Error processing message '" + verb + "'; details: " + e);
    }
  };

  function doPing() {
    if (_ws && _wsOpen)
      _ws.send("PING");
  }

  function doSendChange() {
    if (_sentChanges != null || _localChanges == null) return;
    if (!_ws || !_wsOpen) {
      shoutTragedy("Trying to send changes but socket is not open.");
      return;
    }
    try {
      _sentChanges = _localChanges;
      _localChanges = null;
      _sentChangesFromId = _revisionId;
      let msg = "CHANGE " + _revisionId + " " + JSON.stringify(_sentChanges);
      _ws.send(msg);
    }
    catch (e) {
      shoutTragedy("An exception occurred while sending local changes: " + e);
    }
  }

  function processEdit(start, end, newText) {
    try {
      if (_localChanges == null) {
        if (_sentChanges != null) _localChanges = CS.makeIdent(_sentChanges.lengthAfter);
        else _localChanges = CS.makeIdent(_receivedChanges == null ? _baseText.length : _receivedChanges.lengthAfter);
      }
      _localChanges = CS.addReplace(_localChanges, start, end, newText);
    }
    catch (e) {
      shoutTragedy("An exception occurred while processing change from the editor: " + e);
    }
  }

  function shoutTragedy(msg) {
    if (_tragedyCB)
      setTimeout(() => _tragedyCB(msg), 0);
  }

  return {
    startSession,
    closeSession,
    processEdit,
  };
});
