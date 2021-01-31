"use strict";
var $ = require("jquery");

function getCookieValue(a) {
  var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
  return b ? b.pop() : null;
}

function isLoggedIn() {
  let authCookie = getCookieValue("xieauth");
  if (!authCookie) return false;
  try {
    let data = JSON.parse(decodeURIComponent(authCookie));
    let expiry = new Date(data.expiry);
    if (expiry < new Date()) return false;
    return true;
  }
  catch { return false; }
}


module.exports = (function () {
  return {
    isLoggedIn,
  };
})();
