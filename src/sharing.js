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

// TODO: test with dev server
function resetURL() {
  try {
    // FIXME:
    history.replaceState(null, null, '/');
    // location.search = '';
  } catch (e) {
    // ignore
  }
}

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

///////////////////
// Import Dialog //
///////////////////

// requires an existing dialog in the DOM
function ImportDialog(dialogNode) {
  this.node = dialogNode;
  this.titleNode = dialogNode.querySelector('.modal-header .modal-title');
  this.bodyNode = dialogNode.querySelector('.modal-body');
  this.footerNode = dialogNode.querySelector('.modal-footer');
  this.$dialog = $(dialogNode)
    .one('hide.bs.modal', this.__onClose.bind(this));
}

// internal event handler.
ImportDialog.prototype.__onClose = function () {
  this.onClose();
  // use .empty to clean up $.on used in CheckboxTable
  $(this.bodyNode).empty();
  $(this.footerNode).empty();
};

// configurable
ImportDialog.prototype.onClose = function () {
};

ImportDialog.prototype.show = function () {
  this.$dialog.modal({backdrop: 'static', keyboard: false});
};

ImportDialog.prototype.close = function () {
  this.$dialog.modal('hide');
};

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

var emptySelection = Object.freeze(d3.selectAll([]));

// (D3Selection, {title: string, data: [string]}) -> void
function appendListPanel(container, data) {
  var panel = emptySelection;
  if (data.data && data.data.length) {
    panel = appendPanel(container, data.title);
    panel.append('div')
        .attr('class', 'panel-body')
      .append('ul')
        .attr('class', 'list-inline')
      .selectAll('li')
        .data(data.data)
      .enter().append('li')
        .text(_.identity);
  }
  return panel;
}

// ( D3Selection, {title: string, headers: [string],
//  data: [[string | (D3Selection -> void)]]} ) -> void
function appendTablePanel(container, data) {
  var panel = emptySelection;
  if (data.data && data.data.length) {
    panel = appendPanel(container, data.title);
    panel.append('table')
        .attr('class', 'table')
        .call(function (table) {
          // headers
          table.append('thead')
            .append('tr').selectAll('th').data(data.headers)
            .enter().append('th').text(_.identity);
          // contents
          table.append('tbody').selectAll('tr')
              .data(data.data)
            .enter().append('tr').selectAll('td')
              .data(_.identity)
            .enter().append('td').each(/* @this td */ function (d) {
              var td = d3.select(this);
              if (typeof d === 'function') {
                d(td);
              } else {
                td.text(d);
              }
            });
        });
  }
  return panel;
}

// (D3Selection, NonDocumentFiles, ?string) -> void
function listNondocuments(dialogBody, nondocs, disclosureTitle) {
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
      .text(disclosureTitle ? disclosureTitle : 'Show other files');
  var container = dialogBody.append('div')
      .attr({
        id: collapseId,
        class: 'collapse'
      });
  // Errors by type, most important first
  // TODO: auto-report unexpected errors
  appendTablePanel(container, {
    title: 'Unexpected error',
    headers: ['Filename', 'Error'],
    data: nondocs.otherError.map(function functionName(d) {
      return [d.filename, d.error];
    })
  }).classed('panel-danger', true);
  appendTablePanel(container, {
    // FIXME: change title
    title: 'Not suitable for import',
    headers: ['Filename', 'Reason'],
    data: nondocs.badDoc.map(function (d) {
      return [d.filename, d.error.message];
    })
  });
  appendTablePanel(container, {
    title: 'Not valid as YAML',
    headers: ['Filename', 'Syntax error'],
    data: nondocs.badYAML.map(function (d) {
      return [d.filename,
        function (td) { td.append('pre').text(d.error.message); } ];
    })
  });
  // TODO: document largest allowed filesize
  appendListPanel(container, {
    title: 'File is too large',
    data: nondocs.tooLarge
  });
  appendListPanel(container, {
    title: 'Different file extension (not <code>.yaml</code>/<code>.yml</code>)',
    data: nondocs.wrongType
  });
}

//////////////////////
// Document Parsing //
//////////////////////

/* Interface for Document Parsing
  type GistFile = {
    filename: string,
    language: string,
    size: number,
    truncated: boolean,
    content: string
  };
  type TMData = {source code: string};
  type DocFile = {filename: string, size: number, document: TMData};

  type Filename = string;
  type ErrorTuple = {filename: Filename, error: Error | YAMLException};
  type NonDocumentFiles = {
    wrongType:  [Filename],
    tooLarge:   [Filename],
    badYAML:    [ErrorTuple],
    badDoc:     [ErrorTuple],
    otherError: [ErrorTuple]
  };
 */

// throws if "source code" attribute is missing or not a string
// string -> TMData
function parseDocumentYAML(str) {
  var obj = download.parseDocument(str);
  if (obj == null || obj.sourceCode == null) {
    throw new TypeError('missing "source code:" value');
  } else if (!_.isString(obj.sourceCode)) {
    throw new TypeError('"source code:" value needs to be of type string');
  }
  return obj;
}

// ([GistFile], number) -> {documentFiles: [DocFile], nonDocumentFiles: NonDocumentFiles}
function parseFiles(files, sizelimit) {
  var docfiles = [];
  var nondocs = {wrongType: [], tooLarge: [], badYAML: [], badDoc: [], otherError: []};
  files.forEach(function (file) {
    var name = file.filename; // eslint-disable-line no-shadow
    if (file.language !== 'YAML') {
      nondocs.wrongType.push(name);
    } else if (file.truncated || file.size > sizelimit) {
      nondocs.tooLarge.push(name);
    } else {
      try {
        docfiles.push({
          filename: name,
          size: file.size,
          document: parseDocumentYAML(file.content)
        });
      } catch (e) {
        var tuple = {filename: name, error: e};
        if (e instanceof YAMLException) {
          nondocs.badYAML.push(tuple);
        } else if (e instanceof TypeError) {
          nondocs.badDoc.push(tuple);
        } else {
          nondocs.otherError.push(tuple);
        }
      }
    }
  });
  return {documentFiles: docfiles, nonDocumentFiles: nondocs};
}

/////////////////////
// Document Import //
/////////////////////

function showSizeKB(n) {
  // example: 12.0 KB
  return (Math.ceil(10*n/1024)/10).toFixed(1) + ' KB';
}

// {docFiles: [DocFile], nonDocumentFiles: NonDocumentFiles,
//  dialog: ImportDialog, citeNode?: Node, importDocuments: [TMData] -> void} -> void
function pickMultiple(args) {
  var docfiles = args.documentFiles,
      nondocs = args.nonDocumentFiles,
      citeNode = args.citeNode,
      dialog = args.dialog,
      importDocuments = args.importDocuments;
  // Dialog body
  var dialogBody = d3.select(dialog.bodyNode).text('');
  dialogBody.append('p').call(function (p) {
    p.append('strong').text('Select documents to import');
    if (citeNode) {
      p.node().appendChild(document.createTextNode(' from '));
      p.node().appendChild(citeNode);
    }
  });
  var ctable = new CheckboxTable({
    table: dialogBody.append('table')
      .attr({class: 'table table-hover checkbox-table'}),
    headers: ['Filename', 'Size'],
    data: docfiles.map(function (doc) {
      return [doc.filename, showSizeKB(doc.size)];
    })
  });
  listNondocuments(dialogBody, nondocs);
  // "Import" button
  var button = d3.select(dialog.footerNode)
    .append('button')
      .attr({type: 'button', class: 'btn btn-primary', 'data-dismiss': 'modal'})
      .property('disabled', true)
      .text('Import')
      .on('click', function () {
        var names = d3.set(ctable.getCheckedValues());
        importDocuments(docfiles
          .filter(function (file) { return names.has(file.filename); })
          .map(_.property('document'))
        );
      })
    .node();
  ctable.onChange = function () {
    button.disabled = ctable.isCheckedEmpty();
  };
}

// {nonDocumentFiles: NonDocumentFiles, dialog: ImportDialog, citeLink?: Node} -> void
function pickNone(args) {
  var nondocs = args.nonDocumentFiles,
      dialog = args.dialog,
      citeLink = args.citeLink;

  d3.select(dialog.bodyNode).text('').call(function (body) {
    body.append('p').append('strong')
      .text('None of the files are suitable for import.');
    if (citeLink) {
      body.append('p').text('Requested URL: ').node().appendChild(citeLink);
    }
    listNondocuments(body, nondocs, 'Show details');
  });
  dialog.footerNode.querySelector('button').textContent = 'Close';
}

// Intermingle text and nodes.
// [Node | string] -> DocumentFragment
function joinNodes(nodes) {
  var result = document.createDocumentFragment();
  nodes.forEach(function (node) {
    if (typeof node === 'string') {
      result.appendChild(document.createTextNode(node));
    } else {
      result.appendChild(node);
    }
  });
  return result;
}

function wrapTag(tagName, node) {
  var tag = document.createElement(tagName);
  tag.appendChild(node);
  return tag;
}

// Create a link with text <q>`gist description`</q> if given, otherwise gist `gistID`.
// {gistID: string, description?: string} -> HTMLAnchorElement | HTMLQuoteElement
function gistDescriptionLink(args) {
  var link = externalLink({
    href: 'https://gist.github.com/' + args.gistID,
    textContent: args.description || ('gist ' + args.gistID)
  });
  return args.description ? wrapTag('q', link) : link;
}

// {href: string, textContent?: string} -> HTMLAnchorElement
function externalLink(args) {
  var link = document.createElement('a');
  link.href = args.href;
  link.target = '_blank';
  link.textContent = args.textContent || args.href;
  return link;
}

// {gistID: string, dialogNode: Node, importDocument: TMData -> void} -> void
function importGist(args) {
  var gistID = args.gistID,
      dialogNode = args.dialogNode,
      importDocument = args.importDocument;
  // prevent accidentally exceeding quota
  var MAX_FILESIZE = 400 * 1024;

  var req = getGist(gistID);
  // Show dialog
  var dialog = new ImportDialog(dialogNode);
  dialog.titleNode.textContent = 'Import from GitHub gist';
  dialog.onClose = function () {
    try {
      resetURL();
      req.xhr.abort();
    } catch (e) {
      // ignore
    }
  };
  function setDialogBody(nodes) {
    dialog.bodyNode.textContent = '';
    dialog.bodyNode.appendChild(joinNodes(nodes));
  }
  var link = externalLink({href: 'https://gist.github.com/' + gistID});
  setDialogBody(['Retrieving ', link, '…']);
  dialog.show();
  // Parse and pick files
  req.then(function pickFiles(data) {
    setDialogBody(['Processing ', link, '…']);
    var parsed = parseFiles(_.values(data.files), MAX_FILESIZE);
    var docfiles = parsed.documentFiles;
    switch (docfiles.length) {
      case 0:
        pickNone({
          nonDocumentFiles: parsed.nonDocumentFiles,
          dialog: dialog,
          citeLink: link
        });
        return;
      case 1:
        importDocument(docfiles[0].document);
        dialog.close();
        return;
      default:
        pickMultiple({
          documentFiles: docfiles,
          nonDocumentFiles: parsed.nonDocumentFiles,
          dialog: dialog,
          citeNode: gistDescriptionLink({
            gistID: gistID,
            description: data.description
          }),
          importDocuments: function importDocuments(docs) {
            docs.concat().reverse().map(importDocument);
          }
        });
    }
  })
  .catch(function (reason) {
    setDialogBody([messageForError(reason), 'Requested URL: ', link]);
  });
}

function createElementHTML(tagName, innerHTML) {
  var element = document.createElement(tagName);
  element.innerHTML = innerHTML;
  return element;
}

// ({xhr: jqXHR} | Error) -> Node
function messageForError(reason) {
  var xhr = reason.xhr;
  if (xhr) {
    // case: couldn't fetch
    return createElementHTML('p', (function () {
      switch (reason.status) {
        case 'abort':
          return [''];
        case 'timeout':
          return [
            '<strong>The request timed out.</strong>',
            'You can check your connection and try again.'
          ];
        default:
        // case: HTTP error
          if (xhr.status === 404) {
            return [
              '<strong>No GitHub gist exists with that ID.</strong>',
              'It’s possible the ID is incorrect, or the gist was deleted.'
            ];
          } else {
            return [
              'The import failed because of a <strong>connection error</strong>.',
              'HTTP status code: ' + xhr.status + ' ' + xhr.statusText
            ];
          }
      }
    }()).join('<br>'));
  } else {
    // case: other error
    var pre = document.createElement('pre');
    pre.textContent = String(reason);
    return joinNodes([
      createElementHTML('p', 'An unexpected error occurred:'), pre]);
  }
}

// Import a gist given by ?import-gist=gistID and reset the URL.
// Call this once the DOM is ready (document.readyState === 'interactive').
// {dialogNode: Node, importDocument: TMData -> void} -> void
function runImport(args) {
  var params = queryParams(location.search.substring(1));
  var gistID = params['import-gist'];
  if (gistID) {
    importGist(_.assign({gistID: gistID}, args));
  }
}

exports.runImport = runImport;
