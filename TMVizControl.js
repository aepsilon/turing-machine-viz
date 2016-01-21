/* global ace */ // requires the Ace editor (no-conflict version)
var TMDocument = require('./TMDocument'),
    watch = require('./watch.js'),
    d3 = require('d3');
var YAMLException = require('js-yaml').YAMLException;
var UndoManager = ace.require('ace/undomanager').UndoManager;

// TODO: auto-fix paren spacing
/* eslint space-before-function-paren: 0 */

// TODO: prevent double-binding?
// (HTMLButtonElement, HTMLButtonElement, TMVizData) -> void
function bindStepRunButtons(stepButton, runButton, data) {
  function updateRunning(isRunning) {
    runButton.innerHTML = isRunning
      ? '<span class="glyphicon glyphicon-pause" aria-hidden="true"></span><br>Pause'
      : '<span class="glyphicon glyphicon-play" aria-hidden="true"></span><br>Run';
    return isRunning;
  }
  function updateHalted(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
    return isHalted;
  }
  updateRunning(data.machine.isRunning);
  updateHalted(data.machine.isHalted);
  watch(data.machine, 'isRunning', function(prop, oldval, isRunning) {
    return updateRunning(isRunning);
  });
  watch(data.machine, 'isHalted', function(prop, oldval, isHalted) {
    return updateHalted(isHalted);
  });
}

// Add controls (buttons) for a TMViz.
// div.datum() can be null (missing), in which case the buttons will be disabled.
// remember to rebind after loading/modifying a document.
// div: the selection of the parent div of the .machine-diagram
function addButtons(div) {
  // each step click corresponds to 1 machine step.
  var stepButton = div.select('.tm-step')
  // var stepButton = div.append('button')
      // .text('Step')
      // .attr('class', 'tm-btn-controldiagram btn-step')
      .on('click', function(d) {
        d.machine.isRunning = false;
        d.machine.step();
      });

  var runButton = div.select('.tm-run')
  // var runButton = div.append('button')
      // .text('Run')
      // .attr('class', 'tm-btn-controldiagram btn-run')
      .on('click', function(d) {
        d.machine.isRunning = !d.machine.isRunning;
      });

  div.select('.tm-reset')
  // div.append('button')
      // .text('Reset to start')
      // .attr('class', 'tm-btn-controldiagram btn-reset')
      .property('type', 'reset') // ?
      .on('click', function(d) { d.machine.reset(); });

  // use a plain Array to ease setup, then propagate the actual data
  [{label: 'Save positions', onClick: function(d) { d.savePositions(); }},
   {label: 'Load positions', onClick: function(d) { d.loadSavedPositions(); }}
  ].forEach(function(obj) {
    div.append('button')
        .attr('class', 'tm-btn-diagram btn-positioning')
        .text(obj.label)
        .on('click', function(d) {
          obj.onClick(d);
        });
  });
  return {
    all: div.selectAll('button.tm-btn-diagram'),
    step: stepButton.node(),
    run: runButton.node()
  };
}

// Contains & provides controls for a TMDocument.
function TMVizControl(documentContainer, controlsContainer, editorContainer, docID) {
  documentContainer = d3.select(documentContainer);
  controlsContainer = d3.select(controlsContainer);
  editorContainer = d3.select(editorContainer);
  Object.defineProperty(this, 'documentContainer', {
    value: documentContainer,
    writable: false,
    configurable: false,
    enumerable: true
  });

  this.__buttons = addButtons(controlsContainer);

  var self = this;
  // var editorContainer = documentContainer.append('div')
    // .style('position', 'relative');
  this.__loadButton = editorContainer
    .append('button')
      .text('Load machine')
      .attr('class', 'tm-btn-loadmachine')
      .on('click', function() {
        self.loadEditorSource();
        self.editor.focus();
      });
  this.__revertButton = editorContainer
    .append('button')
      .text('Revert to diagram')
      .attr('class', 'tm-btn-reverteditor')
      .on('click', function() {
        self.revertEditorSource();
        self.editor.focus();
      });

  var editor = ace.edit(
    editorContainer.append('div').attr('class', 'tm-editor').node()
  );
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
    writable: false,
    configurable: false,
    enumerable: true
  });

  if (docID != null) { this.loadDocumentById(docID); }
}

var diagramClass = 'machine-diagram';

TMVizControl.prototype.loadDocumentById = function(docID) {
  var divs = this.documentContainer
    .selectAll('div.'+diagramClass)
      .data([docID], function(d) { return d; });

  // Exit
  divs.exit()
      .each(function(doc) { doc.close && doc.close(); })
      .remove();

  // Enter
  var self = this;
  divs.enter()
    .insert('div', ':first-child')
      .attr('class', diagramClass)
      .datum(function(id) {
        // FIXME: handle/report errors
        try {
          return self.__document = TMDocument.openDocument(d3.select(this), id);
        } catch (e) {
          return null;
        }
      })
      .each(function(doc) {
        self.__rebindButtons(doc);
        // TODO: also preserve cursor position?
        self.editor.setValue(doc.sourceCode, -1 /* put cursor at beginning */);
        // prevent undo-ing to the previous document. note: .reset() doesn't work
        self.editor.session.setUndoManager(new UndoManager());
        self.__loadedEditorSelection = null;
      });
};

// TMDocument -> void
TMVizControl.prototype.__rebindButtons = function (doc) {
  var buttons = this.__buttons;
  buttons.all.datum(doc);
  if (doc && doc.machine) {
    buttons.all.attr('disabled', null);
    bindStepRunButtons(buttons.step, buttons.run, doc);
  } else {
    buttons.all.attr('disabled', '');
  }
};

function aceAnnotationFromYAMLException(e) {
  return {
    row: e.mark.line,
    column: e.mark.column,
    text: 'Not valid YAML (possibly caused by a typo):\n' + e.message,
    type: 'error'
  };
}

TMVizControl.prototype.loadEditorSource = function () {
  var self = this;
  this.documentContainer
    .selectAll('div.'+diagramClass)
    .each(function(doc) {
      // load to diagram, and report any errors
      self.editor.session.clearAnnotations();
      try {
        doc.sourceCode = self.editor.getValue();
        self.__rebindButtons(doc);
        // .toJSON() is the only known way to preserve the cursor/selection(s)
        self.__loadedEditorSelection = self.editor.session.selection.toJSON();
        // TODO: disable/enable load machine / revert as editor changes
      } catch (e) {
        if (e instanceof YAMLException) {
          self.editor.session.setAnnotations([aceAnnotationFromYAMLException(e)]);
        } else {
          // TODO: display error instead of re-throwing
          // also display error next to load button
          // throw e;
          alert(e);
        }
      }
    });
};

TMVizControl.prototype.revertEditorSource = function () {
  if (this.__document.sourceCode) {
    this.editor.setValue(this.__document.sourceCode, -1);
  }
  if (this.__loadedEditorSelection) {
    this.editor.session.selection.fromJSON(this.__loadedEditorSelection);
  }
};

exports.TMVizControl = TMVizControl;
