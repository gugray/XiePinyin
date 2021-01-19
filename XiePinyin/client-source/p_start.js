"use strict";
var $ = require("jquery");

module.exports = (function (elmHost, path) {
  var _elmHost = elmHost;
  var _svelte = null;

  init();

  function init() {
    _elmHost.empty();
    _svelte = new Comps.StartPage({
      target: _elmHost[0]
    });
  }

  function beforeLeave() {
    _svelte.$destroy();
    _svelte = null;
  }

  return {
    beforeLeave: beforeLeave,
  };
});

