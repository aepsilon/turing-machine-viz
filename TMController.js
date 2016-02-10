'use strict';

var Parser = require('./Parser'),
    TMViz = require('./TMViz'),
    values = require('lodash-fp').values;
var d3 = require('d3');
var watchInit = require('./watch').watchInit;

function TMSim(container, buttons) {
  this.container = container;
  this.buttons = buttons;

  var self = this;
  buttons.step
      .addEventListener('click', function () {
        self.machine.isRunning = false;
        self.machine.step(); // each step click corresponds to 1 machine step
      });
  buttons.run
      .addEventListener('click', function () {
        self.machine.isRunning = !self.machine.isRunning;
      });
  buttons.reset
      .addEventListener('click', function () {
        self.machine.reset();
      });
  buttons.all = values(buttons);

  this.clear();
}

TMSim.prototype.clear = function () {
  this.sourceCode = null;
};

Object.defineProperties(TMSim.prototype, {
  sourceCode: {
    get: function () {
      return this.__sourceCode;
    },
    // throws if sourceCode has errors
    set: function (sourceCode) {
      if (this.machine) {
        this.machine.isRunning = false; // important
      }
      if (sourceCode == null) {
        // clear display
        this.machine = null;
        this.container.innerHTML = '';
      } else {
        // parse & check, then set
        var spec = Parser.parseSpec(sourceCode);
        if (this.machine) {
          // case: update
          // copy & restore positions, clear & load contents
          var posTable = this.machine.positionTable;
          this.clear();
          // TODO: remove d3 dependency
          this.machine = new TMViz.TMViz(d3.select(this.container), spec);
          this.machine.positionTable = posTable;
        } else {
          // case: load
          this.machine = new TMViz.TMViz(d3.select(this.container), spec);
        }
      }
      this.__sourceCode = sourceCode;
    },
    enumerable: true
  },
  positionTable: {
    get: function () {
      return this.machine && this.machine.positionTable;
    },
    set: function (posTable) {
      if (this.machine && posTable) {
        this.machine.positionTable = posTable;
      }
    },
    enumerable: true
  },
  machine: {
    get: function () {
      return this.__machine;
    },
    set: function (machine) {
      this.__machine = machine;
      this.rebindButtons();
    }
  }
});

/////////////
// Buttons //
/////////////

/**
 * The innerHTML for the "Run" button.
 * The default value can be overridden.
 * @type {string}
 */
TMSim.prototype.htmlForRunButton =
  '<span class="glyphicon glyphicon-play" aria-hidden="true"></span><br>Run';
TMSim.prototype.htmlForPauseButton =
  '<span class="glyphicon glyphicon-pause" aria-hidden="true"></span><br>Pause';

// bind: .disabled for Step and Run, and .innerHTML (Run/Pause) for Run
function rebindStepRun(stepButton, runButton, runHTML, pauseHTML, machine) {
  function onHaltedChange(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
  }
  function onRunningChange(isRunning) {
    runButton.innerHTML = isRunning ? pauseHTML : runHTML;
  }
  watchInit(machine, 'isHalted', function (prop, oldval, isHalted) {
    onHaltedChange(isHalted);
    return isHalted;
  });
  watchInit(machine, 'isRunning', function (prop, oldval, isRunning) {
    onRunningChange(isRunning);
    return isRunning;
  });
}

// internal method.
TMSim.prototype.rebindButtons = function () {
  var buttons = this.buttons;
  var enable = (this.machine != null);
  if (enable) {
    rebindStepRun(buttons.step, buttons.run,
      this.htmlForRunButton, this.htmlForPauseButton, this.machine);
  }
  buttons.all.forEach(function (b) { b.disabled = !enable; });
};

//////////////////
// TMController //
//////////////////
var ace = require('ace-builds/src-min-noconflict');
var TMSpecError = Parser.TMSpecError;
var YAMLException = Parser.YAMLException;
var UndoManager = ace.require('ace/undomanager').UndoManager;

// document viewer & editor. always associated with a document.
// FIXME: ensure that document is present
function TMController(containers, buttons, document) {
  // FIXME: check for every container and button and throw if any are missing
  Object.defineProperties(this, {
    containers: { value: containers },
    buttons: { value: buttons }
  });

  this.simulator = new TMSim(containers.simulator, buttons.simulator);

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

TMController.prototype.getDocument = function () {
  return this.__document;
};

// set the backing document, without saving/loading or affecting the views.
TMController.prototype.setBackingDocument = function (doc) {
  this.__document = doc;
};

// save the current document, then open another one.
// does nothing if the document ID is the same.
TMController.prototype.openDocument = function (doc) {
  if (this.getDocument().id === doc.id) { return; } // same document
  this.save();
  return this.forceLoadDocument(doc);
};

// (low-level) load the document. current data is discarded without saving.
// this can be used to switch from a deleted document or reload a document.
TMController.prototype.forceLoadDocument = function (doc) {
  this.setBackingDocument(doc);
  var diagramSource = doc.sourceCode;
  // FIXME: catch and report errors in a panel
  this.simulator.sourceCode = diagramSource;
  this.simulator.positionTable = doc.positionTable;

  var editorSource = doc.editorSourceCode;
  var isSynced = (editorSource == null);
  // XXX:
  this.setEditorValue(isSynced ? diagramSource : editorSource);
  this.isSynced = isSynced;
  // prevent undo-ing to the previous document. note: .reset() doesn't work
  this.editor.session.setUndoManager(new UndoManager());
};

TMController.prototype.save = function () {
  var doc = this.getDocument();
  // sidenote: if space runs out, this save order lets syncing free up space for another try
  doc.editorSourceCode = this.isSynced ? undefined : this.editor.getValue();
  doc.sourceCode = this.simulator.sourceCode;
  doc.positionTable = this.simulator.positionTable;
};

// replace null with '', since ace crashes for .setValue(null).
// ?string -> void
TMController.prototype.setEditorValue = function (str) {
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

TMController.prototype.setAlertErrors = function (errors) {
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
TMController.prototype.setLoadButtonSuccess = function (didSucceed) {
  var classes = this.buttons.editor.load.classList;
  classes.toggle('btn-success', didSucceed);
  classes.toggle('btn-primary', !didSucceed);
};

// internal. whether the editor and diagram source code are in sync.
// Updates 'load' button display. Updates storage when sync turns true.
// Doesn't update storage when initializing isSynced.
Object.defineProperty(TMController.prototype, 'isSynced', {
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

TMController.prototype.loadEditorSource = function () {
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

TMController.prototype.revertEditorSource = function () {
  this.setEditorValue(this.simulator.sourceCode);
  // FIXME: what about using revert to recover a corrupted diagram?
  this.setAlertErrors([]);
  this.isSynced = true;
  if (this.__loadedEditorSelection) {
    this.editor.session.selection.fromJSON(this.__loadedEditorSelection);
  }
};

/////////////////////////////
// Document (storage only) //
/////////////////////////////

var Storage = require('./Storage'),
    Examples = require('./Examples'),
    Position = require('./Position'),
    util = require('./util');

function TMDocument(docID) {
  var preset = Examples.get(docID);
  Object.defineProperties(this, {
    id:     { value: docID },
    prefix: { value: 'doc.' + docID },
    isExample: { value: preset ? true : false }
  });
  // fall back to reading presets for example documents
  if (preset) {
    Object.defineProperties(this, {
      sourceCode: useFallbackGet(preset, this, 'sourceCode'),
      // names are read-only
      positionTable: useFallbackGet(preset, this, 'positionTable'),
      name: {
        get: function () { return preset.name; },
        set: function () {}, // don't err when removing (set = null)
        enumerable: true
      }
    });
  }
}

function useFallbackGet(preset, obj, prop) {
  var proto = Object.getPrototypeOf(obj);
  var desc = Object.getOwnPropertyDescriptor(proto, prop);
  var get = desc.get;
  desc.get = function () {
    return util.coalesce(get.call(obj), preset[prop]);
  };
  return desc;
}

// internal method.
TMDocument.prototype.path = function (path) {
  return [].concat(this.prefix, path, 'visible').join('.');
};

// XXX: don't use bare KV-store
(function () {
  var store = Storage.KeyValueStorage;
  var read = store.read.bind(store);
  var write = function (key, val) {
    if (val != null) {
      store.write(key, val);
    } else {
      store.remove(key);
    }
  };
  // var remove = store.remove.bind(store);
  function stringProp(path) {
    return {
      get: function () { return read(this.path(path)); },
      set: function (val) { write(this.path(path), val); },
      enumerable: true
    };
  }

  var propDescriptors = {
    sourceCode: stringProp('diagram.sourceCode'),
    positionTable: {
      get: function () {
        return util.applyMaybe(Position.parsePositionTable,
          read(this.path('diagram.positions')));
      },
      set: function (val) {
        write(this.path('diagram.positions'),
          util.applyMaybe(Position.stringifyPositionTable, val));
      },
      enumerable: true
    },
    editorSourceCode: stringProp('editor.sourceCode'),
    name: stringProp('name')
  };
  Object.defineProperties(TMDocument.prototype, propDescriptors);
  TMDocument.prototype.dataKeys = Object.keys(propDescriptors);
})();

// TODO: bypass unnecessary parse & stringify cycle for positions
TMDocument.prototype.copyFrom = function (other) {
  other.dataKeys.forEach(function (key) {
    this[key] = other[key];
  }, this);
  return this;
};

TMDocument.prototype.delete = function () {
  this.dataKeys.forEach(function (key) {
    this[key] = null;
  }, this);
};

///////////////////
// Document List //
///////////////////

// TODO: impl. transactions

// for custom documents.
function DocumentList(storageKey) {
  this.storageKey = storageKey;
  this.readList();
}

// () -> string
DocumentList.newID = function () {
  return String(Date.now());
};

// internal methods.
DocumentList.prototype.add = function (docID) {
  this.__list.unshift({id: docID});
  this.writeList();
};
DocumentList.prototype.readList = function () {
  this.__list = JSON.parse(Storage.KeyValueStorage.read(this.storageKey)) || [];
};
DocumentList.prototype.writeList = function () {
  Storage.KeyValueStorage.write(this.storageKey, JSON.stringify(this.__list));
};

DocumentList.prototype.newDocument = function () {
  var newID = DocumentList.newID();
  this.add(newID);
  return new TMDocument(newID);
};

DocumentList.prototype.duplicate = function (doc) {
  return this.newDocument().copyFrom(doc);
};

/**
 * Behaves like list.splice(index, 1).
 * @param  {number} index index of the element to delete
 * @return {boolean} true if an element was removed, false otherwise (index out of bounds)
 */
DocumentList.prototype.deleteIndex = function (index) {
  var deleted = this.__list.splice(index, 1);
  this.writeList();
  return (deleted.length > 0);
};

Object.defineProperties(DocumentList.prototype, {
  list: {
    get: function () { return this.__list; },
    enumerable: true
  }
});

exports.TMController = TMController;
exports.TMDocument = TMDocument;
exports.DocumentList = DocumentList;
