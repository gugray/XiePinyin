"use strict";
var $ = require("jquery");
var samplePara = require("./samplepara");

var theThing = (function () {

  var editor;

  $(document).ready(function () {

    var liveReloadScript = document.createElement("script");
    liveReloadScript.src = "/livereload.js?host=localhost&port=35730";
    document.body.appendChild(liveReloadScript);

    editor = require("./editor")($(".doc"));
    editor.setContent(samplePara());
});

})();

