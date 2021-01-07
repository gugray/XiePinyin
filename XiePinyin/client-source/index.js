"use strict";
var $ = require("jquery");
var samplePara = require("./samplepara");

var theThing = (function () {

  var editor;

  $(document).ready(function () {
    editor = require("./editor")($(".doc"));
    editor.setContent(samplePara());
});

})();

