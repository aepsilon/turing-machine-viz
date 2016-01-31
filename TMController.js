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
      if (sourceCode == null) {
        // clear display
        if (this.machine) {
          this.machine.isRunning = false; // important
        }
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

  this.document = {editor: {}}; // dummy document that gets replaced
  this.openDocument(document);
}

TMController.prototype.openDocument = function (doc) {
  if (this.document.id == doc.id) { return; } // same document
  // save current document
  this.save();
  // open new document
  this.document = doc;
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
  var doc = this.document;
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
    Position = require('./Position'),
    util = require('./util');

// important: all own enumerable properties are data (via getters and setters).
// therefore to make a copy, simply copy the own enumerable properties.
// FIXME: fall-back to presets for example documents
function TMDocument(docID) {
  Object.defineProperties(this, {
    id:     { value: docID },
    prefix: { value: 'doc.' + docID }
  });
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
  function propDescriptor(path) {
    return {
      get: function () { return read(this.path(path)); },
      set: function (val) { write(this.path(path), val); },
      enumerable: true
    };
  }

  Object.defineProperties(TMDocument.prototype, {
    sourceCode: propDescriptor('diagram.sourceCode'),
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
    editorSourceCode: {
      get: function () {
        return read(this.path('editor.sourceCode'));
      },
      set: function (val) {
        write(this.path('editor.sourceCode'), val);
      },
      enumerable: true
    }
  });
})();

///////////////////
// Document List //
///////////////////

// TODO: impl. transactions

// for custom documents.
function DocumentList(storageKey) {
  this.storageKey = storageKey;
  this.readList();
}

DocumentList.newID = function () {
  return Date.now();
};

// internal methods.
DocumentList.prototype.add = function (docID) {
  this.__list.push({id: docID});
  this.writeList();
};
DocumentList.prototype.readList = function () {
  this.__list = JSON.parse(Storage.KeyValueStorage.read(this.storageKey)) || [];
};
DocumentList.prototype.writeList = function () {
  Storage.KeyValueStorage.write(this.storageKey, JSON.stringify(this.__list));
};

// TODO: bypass unnecessary parse & stringify cycle for positions
DocumentList.prototype.duplicate = function (doc) {
  var newID = DocumentList.newID();
  var newDoc = new TMDocument(newID);
  this.add(newID);
  Object.keys(doc).forEach(function (key) {
    newDoc[key] = doc[key];
  });
  return newDoc;
};

DocumentList.prototype.deleteById = function (docID) {
  this.__list = removeOn(function (item) { return item.id; }, docID);
  this.writeList();
};

Object.defineProperties(DocumentList.prototype, {
  list: {
    get: function () { return this.__list; },
    enumerable: true
  }
});

// using the comparator, return a copy of the list with the first occurrence of x removed.
function removeBy(cmp, list, x) {
  if (!(list && list.length)) { return; }
  var i = 0;
  for (; i < list.length && !cmp(list[i], x); ++i)
    ;
  return list.slice(0, i).concat(list.slice(i+1));
}

// 'removeBy' by comparing with strict equality (===) on values from a key function.
function removeOn(f, list, x) {
  return removeBy(function (a, b) {
    return f(a) === f(b);
  }, list, x);
}

exports.TMController = TMController;
exports.TMDocument = TMDocument;
exports.DocumentList = DocumentList;
