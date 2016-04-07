'use strict';

/* global document: false */
var docimport = require('./import');
var format = require('./format');
var _ = require('lodash/fp');
var d3 = require('d3');

// Init the import panel and attach event handlers
// {$dialog: jQuery, gistIDForm: HTMLFormElement, importArgs: Object} -> void
function init(args) {
  var $dialog = args.$dialog,
      gistIDForm = args.gistIDForm,
      importArgs = args.importArgs;

  function hideDialog() {
    $dialog.modal('hide');
    // Workaround needed for opening another modal before a modal is done hiding.
    // Without this, the <body> scrolls instead of the modal:
    // modal2.show locks body scroll => modal1.hidden unlocks body scroll
    // while modal2 is still open.
    var nextDialog = importArgs.dialogNode;
    $dialog.one('hidden.bs.modal', function () {
      if (nextDialog.classList.contains('in')) {
        document.body.classList.add('modal-open');
      }
    });
  }

  // Panel: From GitHub gist
  gistIDForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideDialog();

    var gistID = gistIDForm.querySelector('input[type="text"]').value;
    docimport.importGist(_.assign({gistID: gistID}, importArgs));
  });

  // Panel: From files
  (function () {
    // TODO: factor out element IDs and containers into interface
    var panelBody = document.querySelector('#importFilesPanel > .panel-body');
    // <input type="file">
    var fileInput = panelBody.querySelector('input[type="file"]');
    var importFilesButton = document.getElementById('importFilesButton');
    importFilesButton.addEventListener('click', function () {
      hideDialog();
      docimport.importLocalFiles(_.assign({files: fileInput.files}, importArgs));
    });
    // <textarea>
    var textarea = panelBody.querySelector('textarea');
    var importContentsButton = document.getElementById('importContentsButton');
    importContentsButton.parentNode.style.position = 'relative';
    importContentsButton.addEventListener('click', function (e) {
      if (importDocumentContents(
        { containers: {status: e.target.parentNode, details: panelBody },
          importDocument: importArgs.importDocument },
        textarea.value
      )) {
        textarea.select();
      }
    });
  }());
}

///////////////////////////////
// Import from pasted string //
///////////////////////////////

// () -> HTMLButtonElement
function createCloseIcon() {
  return d3.select(document.createElement('button'))
      .attr({class: 'close', 'aria-label': 'Close'})
      .html('<span aria-hidden="true">&times;</span>')
    .node();
}

// Show import outcome (success/failure) and error (if any)
// ({status: HTMLElement, details: HTMLElement}, ?Error) -> void
function showImportContentOutcome(containers, error) {
  var statusContainer = d3.select(containers.status),
      detailsContainer = d3.select(containers.details);
  statusContainer.selectAll('[role="alert"]').remove();
  detailsContainer.selectAll('.alert').remove();
  var status = statusContainer.append('span')
      .attr({role: 'alert'})
      .style({
        position: 'absolute', left: 0, width: '40%', // center between left and button
        top: '50%', transform: 'translateY(-60%)' // center vertically
      });

  // () -> string
  function showErrorDetails() {
    var details = detailsContainer.append('div')
        .attr({role: 'alert', class: 'alert alert-danger'})
        .style('margin-top', '1em');
    details.append(createCloseIcon)
        .attr('data-dismiss', 'alert')
        .on('click', function () {
          status.remove(); // dismiss details => also dismiss status
        });
    if (error instanceof format.YAMLException) {
      details.append('h4').text('Not valid YAML'); // only ".alert h4" has margin-top: 0
      details.append('pre').text(error.message);
    } else if (error instanceof format.InvalidDocumentError) {
      details.append('span')
          .text(error.message.replace(/\.?$/, '.')); // add period if missing
    } else {
      details.append('h4').text('Unexpected error');
      details.append('pre').text(String(error));
      return 'Import failed';
    }
    return 'Not a valid document';
  }

  if (error) {
    var statusSummary = showErrorDetails();
    status.attr({class: 'text-danger'})
        .html('<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span> '
                + statusSummary);
  } else {
    status.attr({class: 'text-success'})
        .html('<span class="glyphicon glyphicon-ok" aria-hidden="true"></span> '
                + 'Import succeeded')
      .transition()
        .delay(2500)
        .duration(2000)
        .style('opacity', 0)
        .remove();
  }
}

// returns true if import succeeded
function importDocumentContents(opts, content) {
  var containers = opts.containers,
      importDocument = opts.importDocument;

  var error = (function () {
    try {
      importDocument(format.parseDocument(content));
    } catch (e) {
      return e;
    }
  }());
  showImportContentOutcome(containers, error);
  return (error == null);
}

exports.init = init;
