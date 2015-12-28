// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

/* global editor */
/* eslint-env browser */
var TMVizControl = require('./TMVizControl.js'),
    Examples = require('./Examples.js'),
    d3 = require('d3');

var controller = new TMVizControl.TMVizControl(d3.select('#machine-container'));

// abstract user actions.
// note to self: aim for same levels of abstraction.
// these functions assume the existence of the controller and editor.
function loadMachineFromEditor() {
  controller.setMachineString(editor.getValue());
}
// string -> void
function loadMachineFromSavedDocument(specString) {
  controller.setMachineString(specString);
  editor.setValue(specString, -1 /* put cursor at beginning */);
}

// type DocID = string
// type name = string
// type TMDocument = {id: DocID, name: string}
// () -> [TMDocument]
function getExampleDocumentListing() {
  return Object.keys(Examples).map(function(key) {
    return {id: 'example.' + key, name: key};
  });
}

// DocID -> ?TMDocument
function lookupDocument(docID) {
  var parts = docID.split('.');
  if (parts.length < 2) { return; }
  // Example document
  if (parts[0] == 'example') {
    var key = parts.splice(1).join('.');
    return Examples[key];
  }
}

// FIXME: fix type signatures. modify examples to include name.
// use makeExample: string -> {name: string, spec: Spec, sourceCode: string}
// TMDocument contains all info needed to replicate every detail of a document
// type TMDocument = {name: string, sourceCode: string, positions: PositionMap}
// TMDocument -> void
var loadDocument = loadMachineFromSavedDocument;
// function loadDocument(doc) {
// }

// [TMDocument] -> HTMLSelectElement
function menuFromDocumentListing(docs) {
  var select = document.createElement('select');
  docs.forEach(function(doc) {
    var option = document.createElement('option');
    option.appendChild(document.createTextNode(doc.name));
    option.setAttribute('value', doc.id);
    select.appendChild(option);
  });
  return select;
}

document.getElementById('btn-loadmachine').addEventListener('click', function() {
  loadMachineFromEditor();
});

// demo main
loadMachineFromSavedDocument(Examples.powersOfTwo);
var picker = document.body.insertBefore(
  menuFromDocumentListing(getExampleDocumentListing()),
  document.body.firstChild);

// monadic bind for maybe (option) type
// ((a -> b), ?a) -> ?b
function applyMaybe(f, x) {
  return (x != null) ? f(x) : x;
}

picker.addEventListener('change', function(event) {
  applyMaybe(loadDocument, lookupDocument(event.target.value));
});

// dev exports
exports.loadMachineFromEditor = loadMachineFromEditor;
exports.loadMachineFromSavedDocument = loadMachineFromSavedDocument;
exports.examples = Examples;
