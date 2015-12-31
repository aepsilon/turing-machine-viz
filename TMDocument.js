/* eslint-env browser */

var TM = require('./TuringMachine.js'),
    TMViz = require('./TMViz.js'),
    Position = require('./Position'),
    Examples = require('./Examples'),
    util = require('./util');

var applyMaybe = util.applyMaybe;

// *** Storage ***
// ***************
// TODO: move Tier and get/set functions into Storage.js
var Tier = Object.freeze({
  stashed: {},
  saved: {},
  exampleDefault: {}
});

function prefixForTier(tier) {
  switch (tier) {
    case Tier.stashed: return 'position.stashed.';
    case Tier.saved:   return 'position.saved.';
    default: throw new Error('unimplemented save tier');
  }
}

// type DocID = string

// throws SyntaxError on parse error
// DocID -> ?PositionTable
function getPositionsForDocumentId(docID) {
  // TODO: include defaults lookup for examples
  return getStashedPositionsForDocumentId(docID)
      || getSavedPositionsForDocumentId(docID);
}
// DocID -> ?PositionTable
var getStashedPositionsForDocumentId = getPositionsByTier(Tier.stashed);
var getSavedPositionsForDocumentId = getPositionsByTier(Tier.saved);

// throws exception on failure
// (DocID, PositionTable) -> void
var stashPositionsForDocumentId = setPositionsByTier(Tier.stashed);
var savePositionsForDocumentId = setPositionsByTier(Tier.saved);

// Tier -> DocID -> ?PositionTable
function getPositionsByTier(tier) {
  var prefix = prefixForTier(tier);
  return function(docID) {
    return applyMaybe(Position.parsePositionTable, localStorage.getItem(prefix + docID));
  };
}

// Tier -> (DocID, PositionTable) -> void
function setPositionsByTier(tier) {
  var prefix = prefixForTier(tier);
  return function (docID, positionTable) {
    localStorage.setItem(prefix + docID, Position.stringifyPositionTable(positionTable));
  };
}

// TODO: implement tiers for source
// DocID -> ?SpecSource
function getDocumentSourceCode(docID) {
  var parts = docID.split('.');
  if (parts.length < 2) { return; }
  // Example document
  var key = parts.splice(1).join('.');
  switch (parts[0]) {
    case 'example': return Examples[key];
    // TODO:
    case 'custom': return null;
  }
}

// *** TMDocument ***
// ******************

// internal use. don't export this constructor.
// TODO: handle spec == null (eval failed)
// (D3Selection, DocID, string) -> TMDocument
function TMDocument(div, docID, sourceCode) {
  this.__divSel = div;
  this.id = docID;
  this.sourceCode = sourceCode;
}

// function newBlankDocument() {
  // return new TMDocument('custom.'+Date.now().toString());
// }

/* API:
d.savePositions();
d.loadSavedPositions();
d.stash()
d.setSourceCode(string);
d.close()
TMDocument.openDocument(docID);
 */

TMDocument.prototype.savePositions = function () {
  return savePositionsForDocumentId(this.id, this.machine.positionTable);
};

TMDocument.prototype.loadPositions = function () {
  var posTable = getPositionsForDocumentId(this.id);
  if (posTable) { this.machine.positionTable = posTable; }
};

TMDocument.prototype.loadSavedPositions = function () {
  var posTable = getSavedPositionsForDocumentId(this.id);
  if (posTable) { this.machine.positionTable = posTable; }
};

// TODO: check spec validity, throw if invalid
// ?string -> ?spec
function evalSpecString(specString) {
  if (specString) {
    var dirConvention = 'var L = MoveHead.left;\nvar R = MoveHead.right;\n';
    // TODO: limit permissions? place inside iframe sandbox and run w/ web worker
    var spec = (new Function('write', 'move', 'skip', 'MoveHead', 'MoveTape',
      dirConvention + specString))(
      TM.write, TM.move, TM.skip, TM.MoveHead, TM.MoveTape);
    return spec;
  }
}

// load a new spec, or update the current one (preserving node positions)
// TMSpec -> void
TMDocument.prototype.__setSpec = function (spec) {
  if (this.machine) {
    // case: update
    // copy & restore positions, clear & load contents
    var posTable = this.machine.positionTable;
    this.machine.isRunning = false; // important
    this.__divSel.node().innerHTML = '';
    this.machine = new TMViz.TMViz(this.__divSel, spec);
    this.machine.positionTable = posTable;
  } else {
    // case: new
    this.machine = new TMViz.TMViz(this.__divSel, spec);
    this.loadPositions();
  }
};

// eval a string and set the returned spec as the machine
Object.defineProperty(TMDocument.prototype, 'sourceCode', {
  get: function () { return this.__sourceCode; },
  set: function (sourceCode) {
    var spec = evalSpecString(sourceCode);
    if (spec) {
      this.__sourceCode = sourceCode;
      this.__setSpec(spec);
    }
  },
  enumerable: true,
  configurable: true
});

// throws if stash fails
TMDocument.prototype.stash = function () {
  console.warn("TMDocument.stash: not yet implemented");
};

TMDocument.prototype.close = function () {
  this.machine && (this.machine.isRunning = false);
  this.stash();
  console.log('TMDocument.close()');
};

// (D3Selection, DocID) -> ?TMDocument
function openDocument(div, docID) {
  var sourceCode = getDocumentSourceCode(docID);
  if (sourceCode != null) {
    return new TMDocument(div, docID, sourceCode);
  }
}

// type DocEntry = {id: DocID, name: string}
// () -> [DocEntry]
function listExampleDocuments() {
  return Object.keys(Examples).map(function(key) {
    return {id: 'example.' + key, name: key};
  });
}

exports.openDocument = openDocument;
exports.listExampleDocuments = listExampleDocuments;
