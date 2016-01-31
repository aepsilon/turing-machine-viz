// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS
'use strict';

/* eslint-env browser */
var TMControllerShared = require('./TMController');
var TMController = TMControllerShared.TMController,
    TMDocument = TMControllerShared.TMDocument,
    Examples = require('./Examples');

// [DocEntry] -> HTMLSelectElement
function menuFromDocumentListing(entries) {
  var select = document.createElement('select');
  entries.forEach(function (entry) {
    var option = document.createElement('option');
    option.appendChild(document.createTextNode(entry.name));
    option.setAttribute('value', entry.id);
    select.appendChild(option);
  });
  return select;
}

function getButton(container, type) {
  return container.querySelector('button.tm-' + type);
}

var controller = function () {
  var editor = document.getElementById('editor-container');
  // button containers
  var sim = document.getElementById('controls-container');
  var ed = editor.parentNode;

  return new TMController({
    simulator: document.getElementById('machine-container'),
    editorAlerts: document.getElementById('editor-alerts-container'),
    editor: editor
  }, {
    simulator: {
      run: getButton(sim, 'run'),
      step: getButton(sim, 'step'),
      reset: getButton(sim, 'reset')
    },
    editor: {
      load: getButton(ed, 'editor-load'),
      revert: getButton(ed, 'editor-revert')
    }
  }, new TMDocument('powersOfTwo'));
}();

controller.editor.setTheme('ace/theme/chrome');

// dropdown menu
var picker = document.querySelector('nav .navbar-form').appendChild(
  menuFromDocumentListing(Examples.list));
// picker.classList.add('navbar-text');
picker.classList.add('form-control');
picker.addEventListener('change', function (e) {
  controller.openDocument(new TMDocument(e.target.value));
});

// XXX: confirm if save fails
window.addEventListener('beforeunload', function () {
  controller.save();
});

// XXX:
exports.controller = controller;
// exports.customDocumentList = TMDocument.customDocumentList;
