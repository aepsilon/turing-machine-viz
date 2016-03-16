'use strict';

var sharing = require('./sharing');
var _ = require('lodash/fp');

// Init the import panel and attach event handlers
// {$dialog: jQuery, gistIDForm: HTMLFormElement, sharingArgs: Object} -> void
function init(args) {
  var $dialog = args.$dialog,
      gistIDForm = args.gistIDForm,
      sharingArgs = args.sharingArgs;

  gistIDForm.addEventListener('submit', function (e) {
    e.preventDefault();
    $dialog.modal('hide');

    var gistID = gistIDForm.querySelector('input[type="text"]').value;
    sharing.importGist(_.assign({gistID: gistID}, sharingArgs));
  });

}

exports.init = init;
