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

function optionFromDocEntry(entry) {
  var option = document.createElement('option');
  option.value = entry.id;
  option.appendChild(document.createTextNode(entry.name));
  return option;
}

function optionsFromDocEntries(item) {
  var result = document.createDocumentFragment();
  item.forEach(function (entry) {
    result.appendChild(optionFromDocEntry(entry));
  });
  return result;
}

function getButton(container, type) {
  return container.querySelector('button.tm-' + type);
}

var currentDocID = 'powersOfTwo';

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
  }, new TMDocument(currentDocID));
}();

controller.editor.setTheme('ace/theme/chrome');

///////////////////
// Document Menu //
///////////////////

var doclist = new TMControllerShared.DocumentList('tm.docs');

// Custom Doc Menu
var customGroup = document.createElement('optgroup');
customGroup.label = 'Custom';

function renderCustomDocs() {
  customGroup.innerHTML = '';
  customGroup.appendChild(optionsFromDocEntries(doclist.list));
}
renderCustomDocs();

// Example Menu
var exampleGroup = document.createElement('optgroup');
exampleGroup.label = 'Examples';
exampleGroup.appendChild(optionsFromDocEntries(Examples.list));

// Overall Menu
var picker = document.createElement('select');

var dupeOption = document.createElement('option');
dupeOption.label = 'Duplicate document';
var createOption = document.createElement('option');
createOption.label = 'New blank document';
// createOption.addEventListener('click', function (e) {
  // e.preventDefault();
// });

picker.appendChild(dupeOption);
picker.appendChild(createOption);
picker.appendChild(customGroup);
picker.appendChild(exampleGroup);

// FIXME: remove hard-coding
picker.selectedIndex = 2 + doclist.list.length;
var previousIndex = picker.selectedIndex;

picker.classList.add('form-control');
picker.addEventListener('change', function () {
  if (picker.selectedIndex > 1) {
    controller.openDocument(new TMDocument(picker.value));
    currentDocID = picker.value;
  } else if (picker.selectedIndex == 0) {
    // dupe & new
    var newDoc = doclist.duplicate(controller.document);
    controller.document = newDoc;
    renderCustomDocs();
    picker.selectedIndex = 1 + doclist.list.length;
  } else {
    alert('Not yet implemented');
    picker.selectedIndex = previousIndex;
  }
  previousIndex = picker.selectedIndex;
});

document.querySelector('nav .navbar-form').appendChild(picker);

// XXX: confirm if save fails
window.addEventListener('beforeunload', function () {
  controller.save();
});

// XXX:
exports.controller = controller;
// exports.customDocumentList = TMDocument.customDocumentList;
