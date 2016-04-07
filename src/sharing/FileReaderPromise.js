'use strict';

/* global FileReader:false */
var Promise = require('bluebird'); // eslint-disable-line no-shadow

// arguments are forwarded to FileReader.readAsText
// (Blob, ?encoding) -> Promise
function readAsText() {
  var args = arguments;
  return new Promise(function (resolve, reject, onCancel) {
    var reader = new FileReader();
    reader.addEventListener('load', function () {
      resolve(reader.result);
    });
    reader.addEventListener('error', function () {
      reject(reader.error);
    });
    onCancel && onCancel(function () {
      try { reader.abort(); } catch (e) {/* */}
    });

    reader.readAsText.apply(reader, args);
  });
}

exports.readAsText = readAsText;
