// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

/* eslint-env browser */
var TMVizControl = require('./TMVizControl'),
    TMDocument = require('./TMDocument');
    // d3 = require('d3');

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

// demo main
// var controller = new TMVizControl.TMVizControl(
//   document.getElementById('machine-container'),
//   editorContainer,
//   'powersOfTwo');

// for backwards compatibility with pre-bootstrap index.html
// function newEditorDiv() {
//   var div = document.createElement('div');
//   div.style.position = 'relative';
//   return div;
// }

var controller = function () {
  var machineContainer = document.getElementById('machine-container');
  var controlsContainer = document.getElementById('controls-container');
  var editorContainer = document.getElementById('editor-container');
    // || machineContainer.appendChild(newEditorDiv());

  return new TMVizControl.TMVizControl(
    machineContainer, controlsContainer, editorContainer,
    'powersOfTwo');
}();

controller.editor.setTheme('ace/theme/chrome');

// dropdown menu
// var picker = document.body.insertBefore(
var picker = document.querySelector('nav .navbar-header').appendChild(
  menuFromDocumentListing(TMDocument.examplesList));
  // document.body.firstChild);
picker.addEventListener('change', function (ev) {
  controller.loadDocumentById(ev.target.value);
});

// XXX:
exports.controller = controller;
exports.customDocumentList = TMDocument.customDocumentList;
