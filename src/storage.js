'use strict';

var isBrowserIEorEdge = require('./util').isBrowserIEorEdge;
/* global localStorage:false, window:false */

///////////////////////
// Key-Value Storage //
///////////////////////

var canUseLocalStorage = (function () {
  // from modernizr v3.3.1 (modernizr.com)
  var mod = 'modernizr';
  try {
    localStorage.setItem(mod, mod);
    localStorage.removeItem(mod);
    return true;
  } catch (e) {
    return false;
  }
})();

// RAM-only fallback
var RAMStorage = (function () {
  var obj = {};
  return Object.freeze({
    get length() { return Object.keys(obj).length; },
    key: function (n) { return (n in Object.keys(obj)) ? Object.keys(obj)[n] : null; },
    getItem: function (key) { return {}.hasOwnProperty.call(obj, key) ? obj[key] : null; },
    setItem: function (key, val) { obj[key] = String(val); },
    removeItem: function (key) { delete obj[key]; },
    clear: function () { obj = {}; }
  });
})();

var KeyValueStorage = (function () {
  var s = canUseLocalStorage ? localStorage : RAMStorage;

  // workaround IE/Edge firing events on its own window
  var fromOwnWindow = isBrowserIEorEdge
    ? function () { return window.document.hasFocus(); }
    : function () { return false; };

  return {
    read  : s.getItem.bind(s),
    write : s.setItem.bind(s),
    remove: s.removeItem.bind(s),
    // Registers a listener for StorageEvents from other tabs/windows.
    addStorageListener: canUseLocalStorage
      ? function (listener) {
        window.addEventListener('storage', function (e) {
          if (fromOwnWindow()) {
            return;
          }
          if (e.storageArea === localStorage) {
            listener(e);
          }
        });
      }
      : function () {},
    removeStorageListener: canUseLocalStorage
      ? window.removeEventListener.bind(window, 'storage')
      : function () {}
  };
})();


exports.canUseLocalStorage = canUseLocalStorage;
exports.KeyValueStorage = KeyValueStorage;
