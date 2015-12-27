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
// (string, AceEditor) -> void
function loadMachineFromSavedDocument(specString) {
  controller.setMachineString(specString);
  editor.setValue(specString, -1 /* put cursor at beginning */);
}

document.getElementById('btn-loadmachine').addEventListener('click', function() {
  loadMachineFromEditor();
});

// demo main
loadMachineFromSavedDocument(Examples.powersOfTwo);

// dev exports
exports.loadMachineFromEditor = loadMachineFromEditor;
exports.loadMachineFromSavedDocument = loadMachineFromSavedDocument;
exports.examples = Examples;
