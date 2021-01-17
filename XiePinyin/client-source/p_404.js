"use strict";
var $ = require("jquery");

const htmlPage = `
<div class="shenme">
  <span>甚麼?</span><br/>
  <a href="/" class="ajax">Let's go to the start page.</a>
</div>
`;

module.exports = (function (elmHost, path) {
  var _elmHost = elmHost;

  init();

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);
  }

  return {

  };
});

