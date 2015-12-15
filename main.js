// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS

var TMVizControl = require('./TMVizControl.js'),
    Examples = require('./Examples.js');

tmvc = new TMVizControl.TMVizControl(d3.select('#machine-container'));
TMVizControl.loadMachine(tmvc, editor, Examples.powersOfTwo);

document.getElementById('load-btn').addEventListener('click', function() {
  TMVizControl.loadMachine(tmvc, editor, editor.getValue(), true);
});

// dev exports
exports.tmvc = tmvc;
exports.TMVizControl = TMVizControl;
exports.examples = Examples;
