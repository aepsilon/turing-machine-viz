/* eslint-env browser */

var TMViz = require('./TMViz'),
    Parser = require('./Parser'),
    Position = require('./Position'),
    Examples = require('./Examples');

// Returns the first function result that is not null or undefined.
// Otherwise, returns undefined.
// ((a -> ?b), [a]) -> ?b
function getFirst(f, xs) {
  for (var i = 0; i < xs.length; ++i) {
    var val = f(xs[i]);
    if (val != null) {
      return val;
    }
  }
}

/////////////
// Storage //
/////////////

var LocalStorage = {
  // type Serializer<a> = ?{parse: a -> string, stringify: string -> a}
  // (string, ?Serializer) -> ?(a | string)
  read: function(key, convert) {
    var val = localStorage.getItem(key);
    return (val && convert && convert.parse) ? convert.parse(val) : val;
  },
  write: function(key, val, convert) {
    localStorage.setItem(
      key,
      (convert && convert.stringify) ? convert.stringify(val) : val);
  },
  remove: function(key) {
    localStorage.removeItem(key);
  }
};

var Tier = Object.freeze({
  visible: 'visible',
  saved: 'saved',
  first: ['visible', 'saved']
});

var DocStorage = Object.freeze({
  // (string, string, ?Serializer<a>) ->
  //  {readByTier: string -> ?(a | string),
  //  writeByTier: (string, a | string) -> void}
  withDocKey: function(docID, key, convert) {
    var prefix = ['doc', docID, key].join('.');
    function keyFor(tier) {
      var postfix = (tier instanceof Array) ? tier[0] : tier;
      return [prefix, postfix].join('.');
    }
    var methods = {
      readByTier: function(tier) {
        return (tier instanceof Array)
          ? getFirst(methods.readByTier, tier)
          : LocalStorage.read(keyFor(tier), convert);
      },
      writeByTier: function(tier, val) {
        return LocalStorage.write(keyFor(tier), val, convert);
      },
      removeByTier: function(tier) {
        return LocalStorage.remove(keyFor(tier));
      }
    };
    return methods;
  }
});

////////////////
// TMDocument //
////////////////

// internal use. don't export this constructor.
// (D3Selection, DocID, string) -> TMDocument
function TMDocument(div, docID, sourceCode) {
  this.__divSel = div;
  this.id = docID;
  this.sourceCode = sourceCode;
  this.__sourceCodeStorage = DocStorage
    .withDocKey(this.id, Prop.SourceCode);
  this.__positionStorage = DocStorage
    .withDocKey(this.id, Prop.Positions, positionFormat);
  try {
    this.loadPositions();
  } catch (e) { // ignore; not critical
  }
}

var positionFormat = Object.freeze({
  parse: Position.parsePositionTable,
  stringify: Position.stringifyPositionTable
});

/**
 * Open an existing document by its ID.
 * @param  {D3Selection}  div   the D3 selection of a div to assign to this document
 * @param  {string}       docID the document ID
 * @throws {YAMLException}      on YAML syntax parse error
 * @throws {TMSpecError}        on other error with the machine spec source code
 * @return {?TMDocument}        the document if found, otherwise null
 */
function openDocument(div, docID) {
  // document exists iff its source code exists
  var sourceCode = DocStorage.withDocKey(docID, 'diagram.sourceCode').readByTier(Tier.first)
    || (Examples.hasOwnProperty(docID) && Examples[docID]);
  return (sourceCode != null) ? new TMDocument(div, docID, sourceCode) : null;
}

var Prop = Object.freeze({
  SourceCode: 'diagram.sourceCode',
  Positions: 'diagram.positions'
});

// FIXME: handle case: missing/invalid source code
// (Prop, ?Tier) -> void
TMDocument.prototype.loadProp = function (prop, tier) {
  tier = tier != null ? tier : Tier.first;
  switch (prop) {
    case Prop.SourceCode:
      var code = this.__sourceCodeStorage.readByTier(tier);
      if (code != null) { this.sourceCode = code; }
      break;
    case Prop.Positions:
      var posTable = this.__positionStorage.readByTier(tier);
      if (posTable) { this.machine.positionTable = posTable; }
      break;
    default:
      throw new Error('TMDocument.loadProp: invalid prop: ' + prop);
  }
};

// (Prop, ?Tier) -> void
TMDocument.prototype.saveProp = function (prop, tier) {
  tier = tier != null ? tier : Tier.first;
  switch (prop) {
    case Prop.SourceCode:
      return this.__sourceCodeStorage.writeByTier(tier, this.sourceCode);
    case Prop.Positions:
      return this.__positionStorage.writeByTier(tier, this.machine.positionTable);
    default:
      throw new Error('TMDocument.saveProp: invalid prop: ' + prop);
  }
};

TMDocument.prototype.savePositions = function () {
  this.saveProp(Prop.Positions, Tier.saved);
};

TMDocument.prototype.loadPositions = function () {
  this.loadProp(Prop.Positions, Tier.first);
};

TMDocument.prototype.loadSavedPositions = function () {
  this.loadProp(Prop.Positions, Tier.saved);
};

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
    // case: load
    this.machine = new TMViz.TMViz(this.__divSel, spec);
  }
};

// eval a string and set the returned spec as the machine
Object.defineProperty(TMDocument.prototype, 'sourceCode', {
  get: function () { return this.__sourceCode; },
  set: function (sourceCode) {
    // parse & check before setting source
    var spec = Parser.parseSpec(sourceCode);
    this.__sourceCode = sourceCode;
    this.__setSpec(spec);
  },
  enumerable: true,
  configurable: true
});

// TODO: reduce space usage: only stash if modified since save.
// throws if stash fails
TMDocument.prototype.stash = function () {
  this.saveProp(Prop.Positions, Tier.visible);
  this.saveProp(Prop.SourceCode, Tier.visible);
};

TMDocument.prototype.close = function () {
  this.machine && (this.machine.isRunning = false);
  this.stash();
  console.log('TMDocument.close()');
};

// type DocEntry = {id: DocID, name: string}
// () -> [DocEntry]
function listExampleDocuments() {
  function getName(sourceCode) {
    // sufficient for the hard-coded examples
    var result = /^[^\S#]*name:\s*(.+)/m.exec(sourceCode);
    return result ? result[1] : 'untitled';
  }
  return Object.keys(Examples).map(function(key) {
    return {id: key, name: getName(Examples[key])};
  });
}

exports.openDocument = openDocument;
exports.listExampleDocuments = listExampleDocuments;
exports.Prop = Prop;
exports.Tier = Tier;
