"use strict";
var $ = require("jquery");

const htmlPage = `
<article>
  <h1>写拼音  Biscriptal Editor</h1>
  <br/><br/>
  <a href="/doc/sample" class="ajax">Go to sample document</a>
</article>
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

