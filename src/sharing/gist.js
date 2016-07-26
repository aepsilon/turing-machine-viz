'use strict';

var $ = require('jquery');
var Promise = require('bluebird'); // eslint-disable-line no-shadow

Promise.config({
  cancellation: true
});

// On success, 'resolve' is called with the response data.
// On failure, 'reject' is called with {xhr: jqXHR, status: string, error: string}.
// To abort the request, use .cancel (from bluebird). Neither is called in that case.
// jqXHR -> Promise
function promisifyAjax(xhr) {
  return new Promise(function (resolve, reject, onCancel) {
    xhr.then(resolve, function (jqXHR, textStatus, errorThrown) {
      reject({xhr: jqXHR, status: textStatus, error: errorThrown});
    });
    onCancel && onCancel(function () {
      try { xhr.abort(); } catch (e) {/* */}
    });
  });
}

// GistID -> Promise
// @see promisifyAjax
function getGist(gistID) {
  return promisifyAjax($.ajax({
    url: 'https://api.github.com/gists/' + gistID,
    type: 'GET',
    dataType: 'json',
    accepts: 'application/vnd.github.v3+json' // specify API version for stability
  }));
}

// https://developer.github.com/v3/gists/#create-a-gist
// @see promisifyAjax
// {files: {[filename: string]: {content: string}},
//  description?: string, public?: boolean} -> Promise
function createGist(payload) {
  // return Promise.delay(1000, {id: 'offlinetesting'});
  return promisifyAjax($.ajax({
    url: 'https://api.github.com/gists',
    type: 'POST',
    data: JSON.stringify(payload),
    // headers: {Authorization: 'token DEVTOKEN'},
    dataType: 'json', // response datatype
    accepts: 'application/vnd.github.v3+json' // specify API version for stability
  }));
}

exports.getGist = getGist;
exports.createGist = createGist;
