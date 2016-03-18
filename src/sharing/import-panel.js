'use strict';

/* global document: false */
var docimport = require('./import');
var _ = require('lodash/fp');
var Promise = require('bluebird'); // eslint-disable-line no-shadow

Promise.config({
  cancellation: true
});

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

  // Attach event handlers
  gistIDForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideDialog();

    var gistID = gistIDForm.querySelector('input[type="text"]').value;
    docimport.importGist(_.assign({gistID: gistID}, importArgs));
  });

  // XXX: test 0 files selected
  // TODO: associated controls when using submit?
  var fileInput = $dialog[0].querySelector('input[type="file"]');
  var importFilesButton = document.getElementById('importFilesButton');
  importFilesButton.addEventListener('click', function () {
    hideDialog();
    docimport.importLocalFiles(_.assign({files: fileInput.files}, importArgs));
  });
}

exports.init = init;
