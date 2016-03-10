'use strict';

// XXX: temporary while WIP
/* eslint no-unused-vars: 1 */
/* eslint-env browser */
/* global Promise */
var download = require('./download');
var $ = require('jquery');
var _ = require('lodash/fp');
var d3 = require('d3');
var YAMLException = require('./Parser').YAMLException;

var CheckboxTable = require('./CheckboxTable');

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

function resetURL() {
  try {
    history.replaceState(null, null, '/');
  } catch (e) {
    // ignore
  }
}

function showImportDialog() {
  return $('#importDialog').modal({backdrop: 'static', keyboard: false});
}

function delayCancellable(ms) {
  var cancel;
  var result = new Promise(function (resolve, reject) {
    var id = setTimeout(resolve, ms);
    cancel = function () {
      clearTimeout(id);
      reject();
    };
  });
  result.cancel = cancel;
  return result;
}

// throws if "source code" attribute is missing or not a string
// string -> TMData
function parseDocument(str) {
  var obj = download.parseDocument(str);
  if (obj == null || obj.sourceCode == null) {
    throw new TypeError('missing <code>source code:</code> value');
  } else if (!_.isString(obj.sourceCode)) {
    throw new TypeError('<code>source code:</code> value needs to be of type string');
  }
  return obj;
}

// type TMData = {source code: string}
// type GistFile = {filename: string, size: number, content: string}
// type GistDoc = {filename: string, size: number, document: TMData}
// [GistFile] -> {documents: [GistDoc], other: GistFile}
function parseFiles(files, sizelimit) {
  // return file.language === 'YAML' && !file.truncated;
  var documents = [];
  var invalid = {wrongType: [], tooLarge: [], badYAML: [], badDoc: [], otherError: []};
  files.forEach(function (file) {
    var name = file.filename; // eslint-disable-line no-shadow
    if (file.language !== 'YAML') {
      invalid.wrongType.push(name);
    } else if (file.truncated || file.size > sizelimit) {
      invalid.tooLarge.push(name);
    } else {
      try {
        documents.push({
          filename: name,
          size: file.size,
          document: parseDocument(file.content)
        });
      } catch (e) {
        var tuple = {filename: name, error: e};
        if (e instanceof YAMLException) {
          invalid.badYAML.push(tuple);
        } else if (e instanceof TypeError) {
          invalid.badDoc.push(tuple);
        } else {
          invalid.otherError.push(tuple);
        }
      }
    }
  });
  // TODO: d3 nest by error key. {reason: 'Not YAML'}, {reason: 'Too large'}..
  return {documentFiles: documents, invalid: invalid};
}

// 12.0 KB
function showSizeKB(n) {
  return (Math.ceil(10*n/1024)/10).toFixed(1) + ' KB';
}

function appendPanel(div, titleHTML) {
  var panel = div.append('div')
      .attr('class', 'panel panel-default');
  panel.append('div')
      .attr('class', 'panel-heading')
    .append('h5')
      .attr('class', 'panel-title')
      .html(titleHTML);
  return panel;
}

function listNondocuments(nondocs, dialogBody) {
  if (_.values(nondocs).every(_.isEmpty)) {
    return;
  }
  // Disclosure triangle
  var collapseId = 'nondocument-files';
  dialogBody.append('a')
      .attr({
        href: '#'+collapseId,
        class: 'disclosure-triangle collapsed',
        role: 'button',
        'data-toggle': 'collapse'
      })
      .text('Show other files');
  var container = dialogBody.append('div')
      .attr({
        id: collapseId,
        class: 'collapse'
      });
  // Errors by type, most important first
  // TODO: auto-report unexpected errors
  if (nondocs.otherError.length) {
    appendPanel(container, 'Unexpected error')
        .classed('panel-danger', true)
      // .append('div')
      //   .attr('class', 'panel-body')
      .append('table')
        .attr('class', 'table')
        .call(function (table) {
          table.append('thead')
            .append('tr').selectAll('th').data(['Filename', 'Error'])
            .enter().append('th').text(_.identity);
          // table contents
          table.append('tbody').selectAll('tr')
              .data(nondocs.otherError)
            .enter().append('tr').selectAll('td')
              .data(function (d) { return [d.filename, d.error]; })
            .enter().append('td')
              .text(_.identity);
        });
  }
  if (nondocs.badDoc.length) {
    appendPanel(container, 'Not suitable for import')
      .append('table')
        .attr('class', 'table')
        .call(function (table) {
          table.append('thead')
            .append('tr').selectAll('th').data(['Filename', 'Reason'])
            .enter().append('th').text(_.identity);
          // table contents
          table.append('tbody').selectAll('tr')
              .data(nondocs.badDoc)
            .enter().append('tr').selectAll('td')
              .data(function (d) { return [d.filename, d.error.message || d.error]; })
            .enter().append('td')
              .text(_.identity);
        });
  }
  if (nondocs.badYAML.length) {
    appendPanel(container, 'Not valid as YAML')
      .append('table')
        .attr('class', 'table')
        .call(function (table) {
          table.append('thead')
            .append('tr').selectAll('th').data(['Filename', 'Syntax error'])
            .enter().append('th').text(_.identity);
          // table contents
          table.append('tbody').selectAll('tr')
              .data(nondocs.badYAML)
            .enter().append('tr')
              .each(/* @this tr */ function (d) {
                var tr = d3.select(this);
                tr.append('td').text(d.filename);
                tr.append('td').append('pre').text(d.error.message || d.error);
              });
        });
  }
  // TODO: document largest allowed filesize
  if (nondocs.tooLarge.length) {
    appendPanel(container, 'File is too large')
      .append('div')
        .attr('class', 'panel-body')
      .append('ul')
        .attr('class', 'list-inline')
      .selectAll('li')
        .data(nondocs.tooLarge)
      .enter().append('li')
        .text(_.identity);
  }
  if (nondocs.wrongType.length) {
    appendPanel(container,
      'Different file extension (not <code>.yaml</code>/<code>.yml</code>)')
      .append('div')
        .attr('class', 'panel-body')
      .append('ul')
        .attr('class', 'list-inline')
      .selectAll('li')
        .data(nondocs.wrongType)
      .enter().append('li')
        .text(_.identity);
  }
  // TODO: other errors
}

/*
 v0. SYNChronous import.
 FIXME: filter & parse before switch case; don't have empty or 1-element tables
 */
function pickMultiple0(args) {
  var docFiles = args.documentFiles, nondocs = args.nondocuments, dialog = args.dialog; //, callback = args.callback;

  var tabledata = docFiles.map(function (doc) {
    return [doc.filename, showSizeKB(doc.size)];
  });
  // Dialog body
  var dialogBody = dialog.select('.modal-body')
      .html('');
  dialogBody.append('p')
    .append('strong').text('Select documents to import');
  var table = dialogBody.append('table')
    .attr({class: 'table table-hover checkbox-table'});
  var ctable = new CheckboxTable({
    table: table,
    headers: ['Filename', 'Size'],
    data: tabledata
  });
  listNondocuments(nondocs, dialogBody);
  // Dialog "Import" button
  dialog.select('.modal-footer')
    .append('button')
      .attr({
        type: 'button',
        class: 'btn btn-success'
      })
      .text('List checked')
      .on('click', function () {
        dialogBody.append('pre')
          .text(ctable.getCheckedValues().join('\n'));
      });
  dialog.select('.modal-footer')
    .append('button')
      .attr({
        type: 'button',
        class: 'btn btn-primary'
      })
      .text('Import')
      .on('click', function () {
        importDocuments(docFiles.map(_.property('document')));
      });
}

var MAX_FILESIZE = 400 * 1000;

function importDocuments(docs) {
  docs.concat().reverse().map(importDocument);
}

// FIXME: remove this hack
var importDocument;

// TODO: bring up dialog for multiple files
// FIXME: handle and report 404, no YAML files, etc.
// right now 404 says:
// Could not import gist. An error occurred:
// [object Object]
function init(imports) {
  importDocument = imports.importDocument;

  $(function () {
    // Read Gist ID
    var params = queryParams(location.search.substring(1));
    var gistID = params['import-gist'];
    if (!gistID) {
      return;
    }
    // Fetch Gist
    // FIXME:
    var delayed = delayCancellable(4000);
    // var req = delayed.then(_.constant(getGist(gistID)));
    var req = getGist(gistID);
    function cancel() {
      try {
        delayed.cancel();
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
      var parsed = parseFiles(_.values(data.files), MAX_FILESIZE);
      var docFiles = parsed.documentFiles;
      switch (docFiles.length) {
        case 0:
          throw new ImportError('no suitable files');
        case 1:
          importDocument(docFiles[0].document);
          dialog.modal('hide');
          return;
        default:
          pickMultiple0({
            documentFiles: docFiles,
            nondocuments: parsed.invalid,
            dialog: d3.select(dialog[0])
          });
          // throw new ImportError('importing multiple files at once is not yet supported.');
      }
    })
    // .then(cleanup)
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
