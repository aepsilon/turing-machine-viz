// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS
'use strict';

/* eslint-env browser */
var TMControllerShared = require('./TMController');
var TMController = TMControllerShared.TMController,
    TMDocument = TMControllerShared.TMDocument,
    DocumentMenu = require('./DocumentMenu'),
    Examples = require('./Examples'),
    toDocFragment = require('./util').toDocFragment;
var ace = require('ace-builds/src-min-noconflict');
var $ = require('jquery'); // for Bootstrap modal dialog events

// load up front so going offline doesn't break anything
// (for snippet placeholders, used by "New blank document")
ace.config.loadModule('ace/ext/language_tools');

//////////
// Main //
//////////

// Document Menu //

// TODO: persist last-opened index
var docIndex = 0;

// TODO: factor out TMDocument dependency, and makeOption
var menu = (function () {
  var select = document.getElementById('tm-doc-menu');
  var makeOption = DocumentMenu.prototype.optionFromDocument;
  // Group: Documents
  var docGroup = document.createElement('optgroup');
  docGroup.label = 'Documents';
  var docList = new TMControllerShared.DocumentList('tm.docs');
  docGroup.appendChild(toDocFragment(docList.list.map(function (entry) {
    return makeOption(new TMDocument(entry.id));
  })));
  select.appendChild(docGroup);
  // Group: Examples
  var exampleGroup = document.createElement('optgroup');
  exampleGroup.label = 'Examples';
  exampleGroup.appendChild(toDocFragment(Examples.list.map(makeOption)));
  select.appendChild(exampleGroup);

  return new DocumentMenu({menu: select, group: docGroup}, docList, docIndex);
})();

function openDocument(doc) {
  controller.openDocument(doc);
}
menu.onChange = openDocument;

// "Edit" Menu //

// only swap out the storage backing; don't affect views or undo history
function duplicateDocument() {
  controller.duplicateTo(menu.duplicate());
}

function newBlankDocument() {
  controller.openDocument(menu.newDocument());
  // load up starter template
  if (controller.editor.insertSnippet) { // async loaded
    controller.editor.insertSnippet(Examples.blankTemplate);
    controller.loadEditorSource();
  }
  controller.editor.focus();
}

[{id: 'tm-doc-action-duplicate', callback: duplicateDocument},
 {id: 'tm-doc-action-newblank', callback: newBlankDocument}
].forEach(function (item) {
  document.getElementById(item.id).addEventListener('click', function (e) {
    e.preventDefault();
    item.callback(e);
  });
});

// Rename
var renameDialog = document.getElementById('renameDialog');
var renameBox = renameDialog.querySelector('input[type="text"]');
$(renameDialog)
  .on('show.bs.modal', function () {
    renameBox.value = menu.currentOption.text;
  })
  .on('shown.bs.modal', function () {
    renameBox.select();
  })
  // NB. saves when closed, so use data-keyboard="false" to prevent closing with Esc
  .on('hide.bs.modal', function () {
    var newName = renameBox.value;
    if (menu.currentOption.text !== newName) {
      menu.rename(newName);
    }
  })
  .on('hidden.bs.modal', function () {
    renameBox.value = '';
  });
document.getElementById('renameDialogForm').addEventListener('submit', function (e) {
  e.preventDefault();
  $(renameDialog).modal('hide');
});

// Delete

function deleteDocument() {
  menu.delete();
  controller.forceLoadDocument(menu.currentDocument);
}

// var deleteDialog = document.getElementById('deleteDialog');
document.getElementById('tm-doc-action-delete').addEventListener('click', deleteDocument);

// Controller //
var controller = function () {
  function getButton(container, type) {
    return container.querySelector('button.tm-' + type);
  }
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
  }, menu.currentDocument);
}();

controller.editor.setTheme('ace/theme/chrome');

// XXX: confirm if save fails
window.addEventListener('beforeunload', function () {
  controller.save();
});

// XXX:
exports.controller = controller;
// exports.customDocumentList = TMDocument.customDocumentList;
