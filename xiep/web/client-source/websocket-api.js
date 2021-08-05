"use strict";

module.exports = (function () {
  var locationInput, messageInput;
  var plainTextSubprotocolCheckbox, jsonSubprotocolCheckbox;
  var connectButton, disconnectButton, sendButton;
  var consoleOutput;

  var _ws;

  var openWebSocket = function () {
    _ws = new WebSocket(locationInput.value);
    _ws.onopen = onSocketOpen;
    _ws.onclose = onSocketClose;
    _ws.onerror = onSocketError;
    _ws.onmessage = onSocketMessage;
  };

  var closeWebSocket = function () {
    _ws.close();
  }

  function sendToWebSocket() {
    var text = messageInput.value;

    writeToConsole('[-- SEND --]: ' + text);
    _ws.send(text);
  }

  var onSocketOpen = function () {
    if (_ws.protocol) {
      writeToConsole('[-- CONNECTION ESTABLISHED (' + _ws.protocol + ') --]');
    } else {
      writeToConsole('[-- CONNECTION ESTABLISHED --]');
    }
    changeUIState(true);
  };

  var onSocketClose = function (e) {
    writeToConsole('[-- CONNECTION CLOSED --]');
    writeToConsole('[-- REASON: ' + e.reason + ' --]');
    changeUIState(false);
  }

  var onSocketError = function () {
    writeToConsole('[-- ERROR OCCURRED --]');
    changeUIState(false);
  }

  var onSocketMessage = function (message) {
    if (_ws.protocol == 'aspnetcore-ws.json') {
      var parsedData = JSON.parse(message.data);
      writeToConsole('[-- RECEIVED --]: ' + parsedData.message + ' {SERVER TIMESTAMP: ' + parsedData.timestamp + '}');
    } else {
      writeToConsole('[-- RECEIVED --]: ' + message.data);
    }
  };

  var clearConsole = function () {
    while (consoleOutput.childNodes.length > 0) {
      consoleOutput.removeChild(consoleOutput.lastChild);
    }
  };

  var writeToConsole = function (text) {
    var paragraph = document.createElement('p');
    paragraph.style.wordWrap = 'break-word';
    paragraph.appendChild(document.createTextNode(text));

    consoleOutput.appendChild(paragraph);
  };

  var changeUIState = function (isConnected) {
    locationInput.disabled = isConnected;
    messageInput.disabled = !isConnected;
    connectButton.disabled = isConnected;
    disconnectButton.disabled = !isConnected;
    sendButton.disabled = !isConnected;
  };

  return {
    initialize: function () {
      locationInput = document.getElementById('location');
      messageInput = document.getElementById('message');
      plainTextSubprotocolCheckbox = document.getElementById('plainTextSubprotocol');
      jsonSubprotocolCheckbox = document.getElementById('jsonSubprotocol');
      connectButton = document.getElementById('connect');
      disconnectButton = document.getElementById('disconnect');
      sendButton = document.getElementById('send');
      consoleOutput = document.getElementById('console');

      connectButton.addEventListener('click', openWebSocket);
      disconnectButton.addEventListener('click', closeWebSocket);
      sendButton.addEventListener('click', sendToWebSocket);
      document.getElementById('clear').addEventListener('click', clearConsole);
    }
  };
})();
