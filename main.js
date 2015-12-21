// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

/* global editor */
/* eslint-env browser */
var TMVizControl = require('./TMVizControl.js'),
    Examples = require('./Examples.js'),
    d3 = require('d3');

var tmvc = new TMVizControl.TMVizControl(d3.select('#machine-container'));
TMVizControl.loadMachine(tmvc, editor, Examples.powersOfTwo);

document.getElementById('btn-loadmachine').addEventListener('click', function() {
  TMVizControl.loadMachine(tmvc, editor, editor.getValue(), true);
});

// dev exports
exports.tmvc = tmvc;
exports.TMVizControl = TMVizControl;
exports.examples = Examples;
