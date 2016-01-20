// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

/* eslint-env browser */
var TMVizControl = require('./TMVizControl'),
    TMDocument = require('./TMDocument');

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
var controller = new TMVizControl.TMVizControl(
  document.getElementById('machine-container'),
  'powersOfTwo');

controller.editor.setTheme('ace/theme/chrome');

// dropdown menu
var picker = document.body.insertBefore(
  menuFromDocumentListing(TMDocument.examplesList),
  document.body.firstChild);
picker.addEventListener('change', function (ev) {
  controller.loadDocumentById(ev.target.value);
});

// XXX:
exports.controller = controller;
