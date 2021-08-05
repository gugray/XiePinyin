"use strict";

module.exports = (function () {
  // Create a DOM EventTarget object
  var target = document.createTextNode(null);

  // Pass EventTarget interface calls to DOM EventTarget object
  this.addEventListener = target.addEventListener.bind(target);
  this.removeEventListener = target.removeEventListener.bind(target);
  this.dispatchEvent = target.dispatchEvent.bind(target);

  // Room your your constructor code 
});
