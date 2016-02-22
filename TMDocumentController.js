'use strict';
var TMSimulator = require('./TMSimulator'),
    Parser = require('./Parser'),
    util = require('./util'),
    ace = require('ace-builds/src-min-noconflict'),
    d3 = require('d3');
var TMSpecError = Parser.TMSpecError;
var YAMLException = Parser.YAMLException;
var UndoManager = ace.require('ace/undomanager').UndoManager;

/**
 * For editing and displaying a TMDocument.
 * The controller coordinates the interactions between
 *   1. simulator
 *   2. code editor
 *   3. storage
 *
 * All container and button params are required.
 * @param {Object} containers
 *   Empty containers to use (contents will likely be replaced).
 * @param {HTMLDivElement} containers.simulator
 * @param {HTMLDivElement} containers.editorAlerts
 * @param {HTMLDivElement} containers.editor
 * @param {Object} buttons Buttons to use.
 * @param {HTMLButtonElement} buttons.simulator.run
 * @param {HTMLButtonElement} buttons.simulator.step
 * @param {HTMLButtonElement} buttons.simulator.reset
 * @param {HTMLButtonElement} buttons.editor.load For loading the editor source
 * @param {HTMLButtonElement} buttons.editor.revert For reverting the editor source
 * @param {TMDocument} document The document to load from and save to.
 */
function TMDocumentController(containers, buttons, document) {
  // FIXME: check for every container and button and throw if any are missing
  // TODO: check that document param is present
  Object.defineProperties(this, {
    containers: { value: containers },
    buttons: { value: buttons }
  });

  this.simulator = new TMSimulator(containers.simulator, buttons.simulator);

  // Set up ace editor //
  var editor = ace.edit(containers.editor);
  Object.defineProperty(this, 'editor', {
    value: editor,
    enumerable: true
  });
  editor.session.setOptions({
    mode: 'ace/mode/yaml',
    tabSize: 2,
    useSoftTabs: true
  });
  editor.setOptions({
    minLines: 15,
    maxLines: 50
  });
  // suppress warning about
  // "Automatically scrolling cursor into view after selection change"
  editor.$blockScrolling = Infinity;

  var editorButtons = buttons.editor;
  var self = this;
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

  Object.defineProperties(this, {
    __document: {
      value: {editor: {}}, // dummy document that gets replaced
      writable: true
    }
  });
  this.openDocument(document);
}

TMDocumentController.prototype.getDocument = function () {
  return this.__document;
};

// set the backing document, without saving/loading or affecting the views.
TMDocumentController.prototype.setBackingDocument = function (doc) {
  this.__document = doc;
};

// save the current document, then open another one.
// does nothing if the document ID is the same.
TMDocumentController.prototype.openDocument = function (doc) {
  if (this.getDocument().id === doc.id) { return; } // same document
  this.save();
  return this.forceLoadDocument(doc);
};

// (low-level) load the document. current data is discarded without saving.
// this can be used to switch from a deleted document or reload a document.
TMDocumentController.prototype.forceLoadDocument = function (doc) {
  this.setBackingDocument(doc);
  var diagramSource = doc.sourceCode;
  // FIXME: catch and report errors in a panel
  this.simulator.clear();
  this.simulator.sourceCode = diagramSource;
  this.simulator.positionTable = doc.positionTable;

  var editorSource = doc.editorSourceCode;
  var isSynced = (editorSource == null);
  this.setEditorValue(isSynced ? diagramSource : editorSource);
  this.isSynced = isSynced;
  // prevent undo-ing to the previous document. note: .reset() doesn't work
  this.editor.session.setUndoManager(new UndoManager());
};

TMDocumentController.prototype.save = function () {
  var doc = this.getDocument();
  // sidenote: if space runs out, this save order lets syncing free up space for another try
  doc.editorSourceCode = this.isSynced ? undefined : this.editor.getValue();
  doc.sourceCode = this.simulator.sourceCode;
  doc.positionTable = this.simulator.positionTable;
};

// replace null with '', since ace crashes for .setValue(null).
// ?string -> void
TMDocumentController.prototype.setEditorValue = function (str) {
  this.editor.setValue(util.coalesce(str, ''), -1 /* put cursor at start */);
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
        // changes cause desync
        var onChange = function () {
          this.isSynced = false;
          this.editor.removeListener('change', onChange);
        }.bind(this);
        this.editor.on('change', onChange);
      }
      if (afterInit) {
        this.save();
      }
    }
  },
  get: function () { return this.__isSynced; }
});

///////////////////
// Load & Revert //
///////////////////

TMDocumentController.prototype.loadEditorSource = function () {
  // load to diagram, and report any errors
  var errors = function () {
    try {
      this.simulator.sourceCode = this.editor.getValue();
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
};

TMDocumentController.prototype.revertEditorSource = function () {
  this.setEditorValue(this.simulator.sourceCode);
  this.setAlertErrors([]);
  this.isSynced = true;
  if (this.__loadedEditorSelection) {
    this.editor.session.selection.fromJSON(this.__loadedEditorSelection);
  }
};

module.exports = TMDocumentController;
