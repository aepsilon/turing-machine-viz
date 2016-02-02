// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS
'use strict';

/* eslint-env browser */
var TMControllerShared = require('./TMController');
var TMController = TMControllerShared.TMController,
    TMDocument = TMControllerShared.TMDocument,
    Examples = require('./Examples'),
    util = require('./util');
var ace = require('ace-builds/src-min-noconflict');
var $ = require('jquery'); // for Bootstrap modal dialog events

// load up front so going offline doesn't break anything
// (for snippet placeholders, used by "New blank document")
ace.config.loadModule('ace/ext/language_tools');

///////////////////////////////
// General-purpose Utilities //
///////////////////////////////

// [Node] -> DocumentFragment
function toDocFragment(array) {
  var result = document.createDocumentFragment();
  array.forEach(result.appendChild.bind(result));
  return result;
}

// TODO: general-purpose SelectMenu using a callback?

///////////////////
// Document Menu //
///////////////////

// container - the <select> or <optgroup> for the document list
// FIXME: docID not synced with selectedIndex
function DocumentMenu(selectElement, container, doclist, currentDocID) {
  Object.defineProperties(this, {
    selectElement: { value: selectElement },
    container: { value: container },
    doclist: { value: doclist },
    currentDocID: {
      value: currentDocID,
      writable: true,
      enumerable: true
    }
  });
  this.render();
}

Object.defineProperties(DocumentMenu.prototype, {
  selectedOption: {
    get: function () {
      return this.selectElement.selectedOptions[0];
    },
    enumerable: true
  }
});

DocumentMenu.prototype.render = function () {
  this.container.innerHTML = '';
  this.container.appendChild(toDocFragment(this.doclist.list.map(
    this.optionFromDocEntry.bind(this)
  )));
};

DocumentMenu.prototype.optionFromDocEntry = optionFromDocEntry;

function optionFromDocEntry(entry) {
  var option = document.createElement('option');
  option.value = entry.id;
  option.text = entry.name || nameForDocID(entry.id);
  return option;
}

function nameForDocID(docID) {
  return util.coalesce(new TMDocument(docID).name, 'untitled');
}

//////////
// Main //
//////////

// Document Menu //
var doclist = new TMControllerShared.DocumentList('tm.docs');
var docmenu;

var picker = function () {
  var menu = document.createElement('select');
  // Documents Menu
  var docGroup = document.createElement('optgroup');
  docGroup.label = 'Documents';
  // Examples Menu
  var exampleGroup = document.createElement('optgroup');
  exampleGroup.label = 'Examples';
  exampleGroup.appendChild(toDocFragment(Examples.list.map(optionFromDocEntry)));
  // Overall Menu
  // XXX: remove hard-coding
  docmenu = new DocumentMenu(menu, docGroup, doclist, 'powersOfTwo');
  menu.appendChild(docGroup);
  menu.appendChild(exampleGroup);
  return menu;
}();

// FIXME: remove hard-coding
picker.classList.add('form-control');
picker.addEventListener('change', function () {
  var docID = picker.value;
  controller.openDocument(new TMDocument(docID));
  docmenu.currentDocID = docID;
});

// XXX: get by ID tm-document-menu
var pickerContainer = document.querySelector('nav .navbar-form');
pickerContainer.insertBefore(picker, pickerContainer.firstChild);

// "Edit" Menu //
function duplicateDocument() {
  // FIXME: refactor away brittleness / internal .document use. forgot to save.
  // only swap out the storage backing; don't affect views or undo history
  controller.save();
  controller.document = doclist.duplicate(controller.document);
  docmenu.render();
  // XXX: remove magic constants
  picker.selectedIndex = 0;
}

function newblankDocument() {
  controller.openDocument(doclist.newDocument());
  docmenu.render();
  picker.selectedIndex = 0;
  // load up starter template
  if (controller.editor.insertSnippet) { // async loaded
    controller.editor.insertSnippet(Examples.blankTemplate);
    controller.loadEditorSource();
  }
  controller.editor.focus();
}

[{id: 'tm-doc-duplicate', callback: duplicateDocument},
 {id: 'tm-doc-newblank', callback: newblankDocument}
].forEach(function (item) {
  document.getElementById(item.id).addEventListener('click', function (e) {
    e.preventDefault();
    item.callback(e);
  });
});

// Rename
var renameDialog = document.getElementById('renameDialog');
var renameBox = renameDialog.querySelector('input[type="text"]');
$(renameDialog).on('show.bs.modal', function () {
  renameBox.value = docmenu.selectedOption.text;
});
$(renameDialog).on('shown.bs.modal', function () {
  renameBox.select();
});
$(renameDialog).on('hide.bs.modal', function () {
  var option = docmenu.selectedOption;
  var newName = renameBox.value;
  if (option && option.text !== newName) {
    controller.document.name = newName;
    option.text = newName;
  }
});
$(renameDialog).on('hidden.bs.modal', function () {
  renameBox.value = '';
});

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
  }, new TMDocument(docmenu.currentDocID));
}();

controller.editor.setTheme('ace/theme/chrome');

// XXX: confirm if save fails
window.addEventListener('beforeunload', function () {
  controller.save();
});

// XXX:
exports.controller = controller;
// exports.customDocumentList = TMDocument.customDocumentList;
