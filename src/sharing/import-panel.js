'use strict';

var docimport = require('./import');
var _ = require('lodash/fp');

// Init the import panel and attach event handlers
// {$dialog: jQuery, gistIDForm: HTMLFormElement, importArgs: Object} -> void
function init(args) {
  var $dialog = args.$dialog,
      gistIDForm = args.gistIDForm,
      importArgs = args.importArgs;

  gistIDForm.addEventListener('submit', function (e) {
    e.preventDefault();
    $dialog.modal('hide');

    var gistID = gistIDForm.querySelector('input[type="text"]').value;
    docimport.importGist(_.assign({gistID: gistID}, importArgs));
  });

}

exports.init = init;
