"use strict";
var $ = require("jquery");

const htmlPage = `
<article>
  <h1>写拼音  Biscriptal Editor</h1>
  <br/><br/>
  <a href="/doc/sample" class="ajax">Go to sample document</a>
  <barf-component prop1="1" prop2="boo" prop3="true"></barf-component>
</article>
`;

module.exports = (function (elmHost, path) {
  var _elmHost = elmHost;

  init();

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);
    _elmHost.find("barf-component").attr("prop2", "Yeehaa");
  }

  return {

  };
});

