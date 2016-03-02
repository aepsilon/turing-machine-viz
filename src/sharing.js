'use strict';

/* eslint-env browser */
/* global Promise */
var download = require('./download');
var $ = require('jquery'),
    _ = require('lodash/fp');
    // d3 = require('d3');

function decodeFormURLComponent(str) {
  return decodeURIComponent(str.replace('+', ' '));
}

/**
 * https://url.spec.whatwg.org/#urlencoded-parsing
 */
function queryParams(queryString) {
  function decode(str) {
    return str ? decodeFormURLComponent(str) : '';
  }
  var result = {};
  queryString.split('&').forEach(function (str) {
    var pair = str.split('=');
    result[decode(pair[0])] = decode(pair[1]);
  });
  return result;
}

// The reject handler is passed an object with properties xhr, status, error.
// The promise has .xhr (for the jqXHR). .xhr.abort() will also reject the promise.
// jqXHR -> Promise
function promisifyAjax(xhr) {
  var promise = new Promise(function (resolve, reject) {
    xhr.then(resolve, function (jqXHR, textStatus, errorThrown) {
      reject({xhr: jqXHR, status: textStatus, error: errorThrown});
    });
  });
  promise.xhr = xhr;
  return promise;
}

// GistID -> Promise
// @see promisifyAjax
function getGist(gistID) {
  return promisifyAjax($.ajax({
    url: 'https://api.github.com/gists/' + gistID,
    type: 'GET',
    dataType: 'json'
  }));
}

function ImportError(message) {
  this.name = 'ImportError';
  this.message = message || 'Could not import document';
  this.stack = (new Error()).stack;
}
ImportError.prototype = Object.create(Error.prototype);
ImportError.prototype.constructor = ImportError;

/////////////////
// Prototype 1 //
/////////////////

/**
 * This iteration:
 * import 1 file, setTimeout simulate delay,
 * cancellable dialog, show errors (404)
 */
function resetURL() {
  try {
    history.replaceState(null, null, '/');
  } catch (e) {
    // ignore
  }
}

function showImportDialog() {
  return $('#importDialog').modal({keyboard: false});
}

// TODO: limit file size
var getFiles = _.flow(
  _.property('files'),
  _.filter(function (file) {
    return file.language === 'YAML' && !file.truncated;
  })
);

// from http://exploringjs.com/es6/ch_promises.html
function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// TODO: bring up dialog for multiple files
// FIXME: handle and report 404, no YAML files, etc.
// right now 404 says:
// Could not import gist. An error occurred:
// [object Object]
function init(imports) {
  var importDocument = _.flow(download.parseDocument, imports.importDocument);

  $(function () {
    // Read Gist ID
    var params = queryParams(location.search.substring(1));
    var gistID = params['import-gist'];
    if (!gistID) {
      return;
    }
    // Fetch Gist
    // FIXME:
    var req = delay(5000).then(_.constant(getGist(gistID)));
    // var req = getGist(gistID);
    function cancel() {
      // req.xhr.abort();
      try {
        req.xhr.abort();
      } catch (e) {
        // do nothing
      }
      cleanup();
    }
    // Set up dialog
    var dialog = showImportDialog();
    function setDialogHTML(str) {
      dialog.find('.modal-body')
        .html(str);
      dialog.find('a').attr('target', '_blank');
    }
    dialog.one('hide.bs.modal', cancel);
    function cleanup() {
      dialog.off('hide.bs.modal', cancel);
      resetURL();
      setDialogHTML('');
    }
    var url = 'https://gist.github.com/' + gistID;
    var linkHTML = url.link(url);
    setDialogHTML('Retrieving ' + linkHTML + '&hellip;');
    // Process request
    req.then(function pickFiles(data) {
      var files = getFiles(data);
      switch (files.length) {
        case 0:
          throw new ImportError('no suitable files');
        case 1:
          importDocument(files[0].content);
          dialog.modal('hide');
          return;
        default:
          throw new ImportError('importing multiple files simulatneously is not yet supported.');
      }
    })
    .then(cleanup)
    .catch(function (reason) {
      // console.warn(reason);
      var xhr = reason.xhr;
      if (xhr) {
        // case: couldn't fetch
        switch (reason.status) {
          case 'abort': return;
          case 'timeout':
            setDialogHTML(
              '<strong>The request timed out.</strong>'
              + '<br>You can check your connection and try again.'
              + 'Requested URL: ' + linkHTML
            );
            break;
          default:
          // case: HTTP error
            if (xhr.status === 404) {
              setDialogHTML(
                [ '<p><strong>No GitHub gist exists with that ID.</strong>'
                , 'It’s possible the ID is incorrect, or the gist was deleted.</p>'
                + 'Requested URL: ' + linkHTML
                ].join('<br>')
              );
            } else {
              setDialogHTML(
                '<p>The import failed because of a <strong>connection error</strong>.' +
                'HTTP status code: ' + xhr.status + ' ' + xhr.statusText + '</p><br>' +
                'Requested URL: ' + linkHTML
              );
            }
        }
      } else {
        // case: other error
        if (reason instanceof ImportError) {
          setDialogHTML('Could not import. An error occurred: ' + reason);
        } else {
          setDialogHTML('Could not import. An error occurred: ' + reason);
        }
      }
    });
  });
}

exports.init = init;
