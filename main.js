// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS
'use strict';

/* eslint-env browser */
var TMControllerShared = require('./TMController');
var TMController = TMControllerShared.TMController,
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

var menu = (function () {
  var select = document.getElementById('tm-doc-menu');
  // Group: Documents
  var docGroup = document.createElement('optgroup');
  docGroup.label = 'Documents';
  select.appendChild(docGroup);
  var docList = new TMControllerShared.DocumentList('tm.docs');
  // Group: Examples
  var exampleGroup = document.createElement('optgroup');
  exampleGroup.label = 'Examples';
  exampleGroup.appendChild(toDocFragment(Examples.list.map(
    DocumentMenu.prototype.optionFromDocument)));
  select.appendChild(exampleGroup);

  return new DocumentMenu({menu: select, group: docGroup}, docList, docIndex);
})();

function openDocument(doc) {
  controller.openDocument(doc);
  refreshEditMenu();
}
menu.onChange = openDocument;

// "Edit" Menu //
var refreshEditMenu = (function () {
  var renameLink = document.querySelector('[data-target="#renameDialog"]');
  var deleteLink = document.querySelector('[data-target="#deleteDialog"]');
  var wasExample;
  function renameExample() {
    // duplicate, then rename the duplicate.
    // how it works: switch to duplicate document ->
    //   refreshEditMenu() enables rename dialog -> event bubbles up -> dialog opens.
    // this might be the simplest way; Event.stopPropagation leaves the dropdown hanging.
    duplicateDocument();
  }

  return function () {
    var isExample = menu.currentDocument.isExample;
    if (wasExample !== isExample) {
      if (!isExample) {
        renameLink.textContent = 'Rename…';
        renameLink.removeEventListener('click', renameExample);
        renameLink.setAttribute('data-toggle', 'modal');
        deleteLink.textContent = 'Delete…';
        deleteLink.setAttribute('data-target', '#deleteDialog');
      } else {
        renameLink.textContent = 'Rename a copy…';
        renameLink.addEventListener('click', renameExample);
        renameLink.removeAttribute('data-toggle');
        deleteLink.textContent = 'Reset this example…';
        deleteLink.setAttribute('data-target', '#resetExampleDialog');
      }
      wasExample = isExample;
    }
  };
})();
refreshEditMenu();

// only swap out the storage backing; don't affect views or undo history
function duplicateDocument() {
  controller.save();
  controller.setBackingDocument(menu.duplicate({select: true}));
  refreshEditMenu();
}

function newBlankDocument() {
  controller.openDocument(menu.newDocument({select: true}));
  refreshEditMenu();
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
  // NB. remember data-keyboard="false" on the triggering element,
  // to prevent closing with Esc and causing a save.
  // remark: an exception thrown on 'hide' prevents the dialog from closing,
  // so save during 'hidden' instead.
  .on('hidden.bs.modal', function () {
    var newName = renameBox.value;
    if (menu.currentOption.text !== newName) {
      // TODO: report errors
      menu.rename(newName);
    }
    renameBox.value = '';
  });
document.getElementById('renameDialogForm').addEventListener('submit', function (e) {
  e.preventDefault();
  $(renameDialog).modal('hide');
});

// Delete
function deleteDocument() {
  menu.delete();
  refreshEditMenu();
  controller.forceLoadDocument(menu.currentDocument);
}
document.getElementById('tm-doc-action-delete').addEventListener('click', deleteDocument);

// Reset Example
var discardReset = deleteDocument;
function saveReset() {
  menu.duplicate({select: false});
  menu.delete();
  controller.forceLoadDocument(menu.currentDocument);
}
document.getElementById('tm-doc-action-resetdiscard').addEventListener('click', discardReset);
document.getElementById('tm-doc-action-resetsave').addEventListener('click', saveReset);

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

// For interaction/debugging
exports.controller = controller;
