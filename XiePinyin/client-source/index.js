"use strict";
var $ = require("jquery");
var documentPage = require("./p_document");
var startPage = require("./p_start");
var fofPage = require("./p_404");

window.theApp = (function () {

  var _elmApp = null;
  var _page = null;

  // Get relative path from URL, without trailing slash
  function getPath() {
    var loc = window.history.location || window.location;
    var rePath = /https?:\/\/[^\/]+\/(.*)\/?$/i;
    var match = rePath.exec(loc.href);
    return match[1];
  }

  function isLocalhost() {
    var loc = window.history.location || window.location;
    return loc.hostname.includes("localhost");
  }

  function startsWith(str, prefix) {
    if (str.length < prefix.length)
      return false;
    for (var i = prefix.length - 1; (i >= 0) && (str[i] === prefix[i]); --i)
      continue;
    return i < 0;
  }

  function navigate() {
    var path = getPath();
    if (path == "") _page = startPage(_elmApp, path);
    else if (startsWith(path, "doc/")) _page = documentPage(_elmApp, path);
    else _page = fofPage(_elmApp, path);
  }

  $(document).ready(function () {

    // Livereload if we're developing on localhost
    if (isLocalhost()) {
      var liveReloadScript = document.createElement("script");
      liveReloadScript.src = "/livereload.js?host=localhost&port=35730";
      document.body.appendChild(liveReloadScript);
    }

    // Set up single-page navigation
    $(document).on('click', 'a.ajax', function () {
      history.pushState(null, null, this.href);
      navigate();
      return false;
    });
    $(window).on('popstate', function () {
      navigate();
    });

    // Render first page
    _elmApp = $("#app");
    navigate();
  });

  return {
    // Navigates to provided relative URL (no leading or trailing slash)
    navigate: function (path) {
      history.pushState(null, null, "/" + path);
      navigate();
    },
  };

})();

