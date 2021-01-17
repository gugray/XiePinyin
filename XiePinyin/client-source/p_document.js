"use strict";
var $ = require("jquery");
var samplePara = require("./samplepara");

const htmlPage = `
<div class="document">
  <div class="header">
    <div class="title">
      <div class="docTitle"><span>Sample document</span></div>
    </div>
    <div class="commands">
      <div class="group grpInputType">
        <div class="item button simp sel">简体</div>
        <div class="item button trad">繁體</div>
        <div class="item button alfa">Alpha</div>
      </div>
    </div>
  </div>
  <div class="page"></div>
</div>
`;

module.exports = (function (elmHost, path) {
  var _elmHost = elmHost;
  var _editor = null;

  init();

  function init() {
    _elmHost.empty();
    _elmHost.html(htmlPage);

    // Commands
    _elmHost.find(".grpInputType .button").click(onInputTypeClick);

    _editor = require("./editor")(_elmHost.find(".page"));
    _editor.setContent(samplePara());
    _editor.setInputType("simp");

  }

  function onInputTypeClick() {
    _elmHost.find(".grpInputType .button").removeClass("sel");
    $(this).addClass("sel");
    if ($(this).hasClass("simp")) _editor.setInputType("simp");
    else if ($(this).hasClass("trad")) _editor.setInputType("trad");
    else if ($(this).hasClass("alfa")) _editor.setInputType("alfa");
  }

  return {

  };
});

