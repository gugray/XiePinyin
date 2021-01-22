"use strict";
var $ = require("jquery");
var wsa = require("./websocket-api");

const htmlPage = `
<article class="socket">
  <div>
    <div id="echo-configuration">
      <label for="location">Location:</label><br>
      <input type="text" id="location" value="ws://localhost:1313/sock"><br>
      <button id="connect">Connect</button>
      <button disabled="disabled" id="disconnect">Disconnect</button>
      <br><br>
      <label for="message">Message:</label><br>
      <input disabled="disabled" id="message"><br>
      <button disabled="disabled" id="send">Send</button>
    </div>
    <div id="echo-output">
      <label>Log:</label>
      <div id="console"></div>
      <button id="clear" style="position: relative; top: 3px;">Clear</button>
    </div>
  </div>
</article>
`;


module.exports = (function (elmHost, path, navigateTo) {
  var _elmHost = elmHost;
  var _navigateTo = navigateTo;

  init();

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);
    wsa.initialize();
  }

  return {
  };
});

