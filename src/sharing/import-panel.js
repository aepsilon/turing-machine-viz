'use strict';

/* global document: false */
var docimport = require('./import');
var _ = require('lodash/fp');

// Init the import panel and attach event handlers
// {$dialog: jQuery, gistIDForm: HTMLFormElement, importArgs: Object} -> void
function init(args) {
  var $dialog = args.$dialog,
      gistIDForm = args.gistIDForm,
      importArgs = args.importArgs;

  // Attach event handlers
  gistIDForm.addEventListener('submit', function (e) {
    e.preventDefault();
    $dialog.modal('hide');
    // Workaround needed for opening another modal before a modal is done hiding.
    // Without this, the <body> scrolls instead of the modal:
    // modal2.show locks body scroll => modal1.hidden unlocks body scroll
    // while modal2 is still open.
    var gistDialogNode = importArgs.dialogNode;
    $dialog.one('hidden.bs.modal', function () {
      if (gistDialogNode.classList.contains('in')) {
        document.body.classList.add('modal-open');
      }
    });

    var gistID = gistIDForm.querySelector('input[type="text"]').value;
    docimport.importGist(_.assign({gistID: gistID}, importArgs));
  });

}

exports.init = init;
