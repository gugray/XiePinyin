"use strict";
var $ = require("jquery");
var CS = require('./editor/changeset');

const pingInterval = 15000;
const sendChangeInterval = 500;

module.exports = (function (sessionKey, docId) {

  var _sessionKey = sessionKey
  var _docId = docId;
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
  var _peerSelections = []; // Selections of peers, always in head text, ie, _baseText + _receivedChanges
  var _sentChanges = null;
  var _sentChangesFromId = -1;
  var _localChanges = null;
  var _displaySel = null;
  var _displaySelChangedLocally = false;
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

  function updateDocInfoLocally() {
    var docInfos = [];
    var docsJson = localStorage.getItem("online-docs");
    if (docsJson) docInfos = JSON.parse(docsJson);
    var newInfos = [];
    var foundMyself = false;
    for (var i = 0; i < docInfos.length; ++i) {
      if (docInfos[i].id != _docId) newInfos.push(docInfos[i]);
      else {
        newInfos.push({ name: _name, lastEditedIso: new Date().toISOString(), id: _docId });
        foundMyself = true;
      }
    }
    if (!foundMyself) {
      newInfos.unshift({ name: _name, lastEditedIso: new Date().toISOString(), id: _docId });
    }
    localStorage.setItem("online-docs", JSON.stringify(newInfos));
  }

  function processHello(detail) {
    const data = JSON.parse(detail);
    _name = data.name;
    _baseText = data.text;
    _revisionId = data.revisionId;
    _peerSelections = data.peerSelections;
    if (_startCB != null) {
      let cb = _startCB;
      _startCB = null;
      _displaySel = { start: 0, end: 0, caretAtStart: false };
      _displaySelChangedLocally = false;
      cb(null, {
        name: _name,
        baseText: _baseText,
        sel: { start: _displaySel.start, end: _displaySel.end, caretAtStart: _displaySel.caretAtStart },
        peerSelections: _peerSelections,
      });
      updateDocInfoLocally();
    }
    _pingInterval = setInterval(doPing, pingInterval);
    _sendChangeInterval = setInterval(doSendChange, sendChangeInterval);
  }

  function forwardPeerSelections() {
    let poss = [];
    for (const ps of _peerSelections)
      poss = [...poss, ps.start, ps.end];
    if (_sentChanges != null) CS.forwardPositions(_sentChanges, poss);
    if (_localChanges != null) CS.forwardPositions(_localChanges, poss);
    let res = [];
    for (let i = 0; i < _peerSelections.length; ++i) {
      const ps = _peerSelections[i];
      if (ps.sessionKey == _sessionKey) continue;
      res.push({
        sessionKey: ps.sessionKey,
        start: poss[2 * i],
        end: poss[2 * i + 1],
        caretAtStart: ps.caretAtStart,
      });
    }
    return res;
  }

  function processUpdate(detail) {
    const ix1 = detail.indexOf(" ");
    const newRevisionId = parseInt(detail.substring(0, ix1), 10);
    const ix2 = detail.indexOf(" ", ix1 + 1);
    const senderKey = detail.substring(ix1 + 1, ix2);
    let ix3 = detail.indexOf(" ", ix2 + 1);
    if (ix3 == -1) ix3 = detail.length;
    _peerSelections = JSON.parse(detail.substring(ix2 + 1, ix3));
    const cs = ix3 < detail.length ? JSON.parse(detail.substring(ix3 + 1)) : null;
    // If there is not change set: just update this peer's selection/cursor
    if (cs == null) {
      // *MUST* be for current revision
      if (newRevisionId != _revisionId) {
        shoutTragedy("Received selection updated for revision " + newRevisionId + " but our current revision is " + _revisionId);
        return;
      }
      _updateCB(null, forwardPeerSelections());
      return;
    }
    // *MUST* be for next revision in line
    if (newRevisionId != _revisionId + 1) {
      shoutTragedy("Received changeset to next revision " + newRevisionId + " but our current revision is " + _revisionId);
      return;
    }
    // Process change set
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
      let poss = [selStart, selEnd];
      let newText = CS.apply(currText, editorChanges, poss);
      return {
        text: newText,
        selStart: poss[0],
        selEnd: poss[1],
      };
    }, forwardPeerSelections());
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
    if (_sentChanges != null || (_localChanges == null && !_displaySelChangedLocally)) return;
    if (!_ws || !_wsOpen) {
      shoutTragedy("Trying to send changes but socket is not open.");
      return;
    }
    try {
      _sentChanges = _localChanges;
      _localChanges = null;
      _displaySelChangedLocally = false;
      _sentChangesFromId = _revisionId;
      let msg = "CHANGE " + _revisionId + " " + JSON.stringify(_displaySel);
      if (_sentChanges != null) msg += " " + JSON.stringify(_sentChanges);
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
      _displaySel = { start: start + newText.length, end: start + newText.length, caretAtStart: false };
      _displaySelChangedLocally = true;
      return forwardPeerSelections();
    }
    catch (e) {
      shoutTragedy("An exception occurred while processing change from the editor: " + e);
    }
  }

  function processSelChange(newSel) {
    _displaySel = { start: newSel.start, end: newSel.end, caretAtStart: newSel.caretAtStart };
    _displaySelChangedLocally = true;
  }

  function shoutTragedy(msg) {
    if (_tragedyCB)
      setTimeout(() => _tragedyCB(msg), 0);
  }

  return {
    startSession,
    closeSession,
    processEdit,
    processSelChange,
  };
});
