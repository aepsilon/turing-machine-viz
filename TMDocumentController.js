'use strict';
var TMDocument = require('./TMDocument'),
    watchInit = require('./watch').watchInit,
    Storage = require('./Storage'),
    ace = require('ace-builds/src-min-noconflict'),
    d3 = require('d3'),
    values = require('lodash/fp').values;
var TMSpecError = TMDocument.TMSpecError;
var YAMLException = TMDocument.YAMLException;
var UndoManager = ace.require('ace/undomanager').UndoManager;

/**
 * Manages and responds to buttons for a TMDocument, and provides a source code editor.
 *
 * All container and button params are required.
 * @param {Object} containers
 *   Empty containers to use (contents will likely be replaced).
 * @param {HTMLDivElement} containers.diagram
 * @param {HTMLDivElement} containers.editorAlerts
 * @param {HTMLDivElement} containers.editor
 * @param {Object} buttons Buttons to use.
 * @param {HTMLButtonElement} buttons.run
 * @param {HTMLButtonElement} buttons.step
 * @param {HTMLButtonElement} buttons.reset
 * @param {HTMLButtonElement} buttons.load For loading the editor source
 * @param {HTMLButtonElement} buttons.revert For reverting the editor source
 * @param {?string} docID The document ID to open.
 */
function TMDocumentController(containers, buttons, docID) {
  // FIXME: check for every container and button and throw if any are missing
  Object.defineProperties(this, {
    containers: { value: containers },
    buttons: { value: buttons }
  });

  // Set up button event listeners //
  var self = this;
  var simButtons = buttons.simulator;
  simButtons.step
      .addEventListener('click', function () {
        self.__document.machine.isRunning = false;
        self.__document.machine.step(); // each step click corresponds to 1 machine step
      });
  simButtons.run
      .addEventListener('click', function () {
        self.__document.machine.isRunning = !self.__document.machine.isRunning;
      });
  simButtons.reset
      .addEventListener('click', function () {
        self.__document.machine.reset();
      });
  simButtons.all = values(simButtons);

  var editorButtons = buttons.editor;
  editorButtons.load
      .addEventListener('click', function () {
        self.loadEditorSource();
        self.editor.focus();
      });
  editorButtons.revert
      .addEventListener('click', function () {
        self.revertEditorSource();
        self.editor.focus();
      });

  // Set up ace editor //
  var editor = ace.edit(containers.editor);
  editor.setOptions({
    minLines: 15,
    maxLines: 50
  });
  editor.session.setOptions({
    mode: 'ace/mode/yaml',
    tabSize: 2,
    useSoftTabs: true
  });
  // suppress warning about
  // "Automatically scrolling cursor into view after selection change"
  editor.$blockScrolling = Infinity;
  Object.defineProperty(this, 'editor', {
    value: editor,
    enumerable: true
  });

  if (docID != null) { this.openDocumentById(docID); }
}

//////////////////
// Open & Close //
//////////////////

var diagramClass = 'machine-diagram';

// FIXME: load editor even if diagram source was corrupted. display error.
TMDocumentController.prototype.openDocumentById = function (docID) {
  if (this._document && this.__document.id === docID) { return; } // same document
  this.closeCurrentDocument();

  var diagram = d3.select(this.containers.diagram)
    .append('div').attr('class', diagramClass);

  // FIXME: handle/report errors
  try {
    // restore diagram
    this.__document = TMDocument.openDocument(diagram, docID);
    this.rebindButtons();
    // restore editor
    // FIXME: use tiers. don't use internals.
    var editorSchema = {editor: {sourceCode: null}};
    var store = new Storage.SchemaStorage(this.__document.storage.prefix, editorSchema)
      .withPath(['editor', 'sourceCode']);
    this.__editorStore = store;
    var editorSrc = store.read();
    var isSynced = (editorSrc == null);
    if (isSynced) { editorSrc = this.__document.sourceCode; }
    // TODO: preserve cursor position between sessions?
    this.editor.setValue(editorSrc, -1 /* put cursor at beginning */);
    this.isSynced = isSynced; // important: editor.setValue first so change doesn't trigger desync
    // prevent undo-ing to the previous document. note: .reset() doesn't work
    this.editor.session.setUndoManager(new UndoManager());
    this.__loadedEditorSelection = null;
  } catch (e) {
    // XXX: handle document/diagram source corruption
    throw e;
  }
};

// TODO: confirm exit if save fails
// XXX: this allows an inconsistent state of having no active document.
// internal method.
TMDocumentController.prototype.closeCurrentDocument = function () {
  // stash data
  if (this.__document) {
    if (!this.isSynced) {
      this.__editorStore.write(this.editor.getValue());
    }
    this.__document.close();
  }
  // clean up after stashing
  this.rebindButtons();
  this.setAlertErrors([]);
  this.__document = null;
  this.containers.diagram.innerHTML = '';
};

/////////////
// Buttons //
/////////////

// these default values can be overridden.
TMDocumentController.prototype.htmlForRunButton =
  '<span class="glyphicon glyphicon-play" aria-hidden="true"></span><br>Run';
TMDocumentController.prototype.htmlForPauseButton =
  '<span class="glyphicon glyphicon-pause" aria-hidden="true"></span><br>Pause';

// bind: .disabled for Step and Run, and .innerHTML (Run/Pause) for Run
function rebindStepRun(stepButton, runButton, runHTML, pauseHTML, machine) {
  function onHaltedChange(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
    return isHalted;
  }
  function onRunningChange(isRunning) {
    runButton.innerHTML = isRunning ? pauseHTML : runHTML;
    return isRunning;
  }
  watchInit(machine, 'isHalted', function (prop, oldval, isHalted) {
    return onHaltedChange(isHalted);
  });
  watchInit(machine, 'isRunning', function (prop, oldval, isRunning) {
    return onRunningChange(isRunning);
  });
}

// TODO: disable/enable load machine / revert as editor changes
TMDocumentController.prototype.rebindButtons = function () {
  var doc = this.__document;
  var enable = Boolean(doc && doc.machine);
  var buttons = this.buttons.simulator;
  if (enable) {
    rebindStepRun(buttons.step, buttons.run,
      this.htmlForRunButton, this.htmlForPauseButton, doc.machine);
  }
  buttons.all.forEach(function (b) { b.disabled = !enable; });
};

/////////////////////////
// Error/Alert Display //
/////////////////////////

function aceAnnotationFromYAMLException(e) {
  return {
    row: e.mark.line,
    column: e.mark.column,
    text: 'Not valid YAML (possibly caused by a typo):\n' + e.message,
    type: 'error'
  };
}

TMDocumentController.prototype.setAlertErrors = function (errors) {
  var self = this;
  var alerts = d3.select(self.containers.editorAlerts).selectAll('.alert')
    .data(errors, function (e) { return String(e); }); // key by error description

  alerts.exit().remove();

  alerts.enter()
    .append('div')
      .attr('class', 'alert alert-danger')
      .each(/** @this div */ function (e) {
        var div = d3.select(this);
        if (e instanceof YAMLException) {
          var annot = aceAnnotationFromYAMLException(e);
          var lineNum = annot.row + 1; // annotation lines start at 0; editor starts at 1
          var column = annot.column;
          div.append('strong')
              .text('Syntax error on ')
            .append('a')
              .text('line ' + lineNum)
              .on('click', function () {
                self.editor.gotoLine(lineNum, column, true);
                self.editor.focus();
                // prevent scrolling, especially href="#" scrolling to the top
                d3.event.preventDefault();
              })
              .attr('href', '#' + self.containers.editor.id);
          div.append('br');
          // aside: text nodes aren't elements so they need to be wrapped (e.g. in span)
          // https://github.com/mbostock/d3/issues/94
          div.append('span').text('Possible reason: ' + e.reason);
        } else if (e instanceof TMSpecError) {
          div.html(e.message);
        } else {
          div.html('<strong>Unexpected error</strong>: ' + e);
        }
      });
  self.editor.session.setAnnotations(
    errors
    .map(function (e) {
      return (e instanceof YAMLException) ? aceAnnotationFromYAMLException(e) : null;
    })
    .filter(function (x) { return x; })
  );
};

/////////////////
// Sync Status //
/////////////////

// This method can be overridden as necessary.
// The default implementation toggles Bootstrap 3 classes.
TMDocumentController.prototype.setLoadButtonSuccess = function (didSucceed) {
  var classes = this.buttons.editor.load.classList;
  classes.toggle('btn-success', didSucceed);
  classes.toggle('btn-primary', !didSucceed);
};

// internal. whether the editor and diagram source code are in sync.
// Updates 'load' button display. Updates storage when sync turns true.
// Doesn't update storage when initializing isSynced.
Object.defineProperty(TMDocumentController.prototype, 'isSynced', {
  set: function (isSynced) {
    isSynced = Boolean(isSynced);
    if (this.__isSynced !== isSynced) {
      var afterInit = this.__isSynced != undefined;
      this.__isSynced = isSynced;
      this.setLoadButtonSuccess(isSynced);
      if (isSynced) {
        // update storage
        if (afterInit) {
          this.__document.stash();
          this.__editorStore.remove();
        }
        // changes cause desync
        var onChange = function () {
          this.isSynced = false;
          this.editor.removeListener('change', onChange);
        }.bind(this);
        this.editor.on('change', onChange);
      }
    }
  },
  get: function () { return this.__isSynced; }
});

///////////////////
// Load & Revert //
///////////////////

TMDocumentController.prototype.loadEditorSource = function () {
  // FIXME: ensure the controller always has a document. otherwise load/revert is broken.
  var doc = this.__document;
  if (doc) {
    // load to diagram, and report any errors
    var errors = function () {
      try {
        doc.sourceCode = this.editor.getValue();
        this.rebindButtons();
        // .toJSON() is the only known way to preserve the cursor/selection(s)
        this.__loadedEditorSelection = this.editor.session.selection.toJSON();
        this.isSynced = true;
        return [];
      } catch (e) {
        return [e];
      }
    }.bind(this)();
    this.isSynced = (errors.length === 0);
    this.setAlertErrors(errors);
  }
};

TMDocumentController.prototype.revertEditorSource = function () {
  if (this.__document.sourceCode) {
    this.editor.setValue(this.__document.sourceCode, -1);
    this.setAlertErrors([]);
    this.isSynced = true;
  }
  if (this.__loadedEditorSelection) {
    this.editor.session.selection.fromJSON(this.__loadedEditorSelection);
  }
};

module.exports = exports = TMDocumentController;
