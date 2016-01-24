'use strict';
var Examples = require('./Examples'),
    Parser = require('./Parser'),
    Position = require('./Position'),
    Storage = require('./Storage'),
    SchemaStorage = Storage.SchemaStorage,
    TMViz = require('./TMViz'),
    util = require('./util');

//////////////////////
// Document Storage //
//////////////////////

// Storage Tiers

var Tier = Object.freeze({
  visible: ['visible'],
  saved: ['saved'],
  first: [['visible'], ['saved']]
});

// (?Tier, SchemaStorage) -> SchemaStorage
function useTier(tier, store) {
  tier = tier != null ? tier : Tier.first;
  switch (tier) {
    case Tier.visible: return store.withPath(Tier.visible);
    case Tier.saved  : return store.withPath(Tier.saved);
    case Tier.first  :
      // write to 'visible', but read from first available tier
      return Object.create(store.withPath(Tier.visible), {
        read: {
          value: function readFirstTier() {
            return util.getFirst(
              function (t) { return store.withPath(t).read(); },
              Tier.first);
          },
          enumerable: true
        }
      });
    default: throw new TypeError('invalid storage tier: ' + tier);
  }
}

// Document Schema

var tierSchema = {visible: null, saved: null};

var docSchema = {
  'name': tierSchema,
  'diagram.positions': tierSchema,
  'diagram.sourceCode': tierSchema
};

// enum for prop key paths
var Prop = Object.freeze({
  Name: ['name'],
  SourceCode: ['diagram.sourceCode'],
  Positions: ['diagram.positions']
});

// Handling Example Documents

function initDocumentStorage(docID) {
  var prefix = 'doc.' + docID;
  var kvStore = (function () {
    if (Examples.hasID(docID)) {
      // override read so that saved values, when missing, fall back to defaults
      var defaults = {};
      (function () {
        var s = new SchemaStorage(prefix, docSchema);
        function savedPath(prop) {
          return useTier(Tier.saved, s.withPath(prop)).prefix;
        }
        var example = Examples.get(docID);
        defaults[savedPath(Prop.Name)] = example.name;
        defaults[savedPath(Prop.SourceCode)] = example.sourceCode;
        // TODO: defaults[savedPath(Prop.Positions)]
      })();

      return Object.create(Storage.KeyValueStorage, {
        read: {
          value: function read(key) {
            return util.coalesce(Storage.KeyValueStorage.read(key), defaults[key]);
          },
          enumerable: true
        }
      });
    } else {
      return Storage.KeyValueStorage;
    }
  })();
  return new SchemaStorage(prefix, docSchema, kvStore);
}

///////////////////
// Document List //
///////////////////

var customDocumentList = new DocumentList(Storage.KeyValueStorage, 'tm.docIDs');

// TODO: preserve document list order

// ?[DocID] -> void
// @throws {SyntaxError} if listing exists but is corrupt
function DocumentList(storage, storageKey) {
  Object.defineProperties(this, {
    storage: { value: storage },
    storageKey: { value: storageKey },
    idSet: { value: {} }
  });
  var list = util.applyMaybe(JSON.parse, storage.read(storageKey));
  list && list.forEach(function (id) { this.idSet[id] = true; }, this);
}

// [DocID]
Object.defineProperty(DocumentList.prototype, 'list', {
  get: function () { return Object.keys(this.idSet); },
  enumerable: true
});

// document duplication.
// set a new docID and copy all data over, but keep the displays.
// mutates the document.
DocumentList.prototype.duplicateDocument = function (doc) {
  var newID = newDocID();
  // copy data
  var newStorage = initDocumentStorage(newID);
  this.add(newID);
  try {
    newStorage.write(doc.storage.read());
  } catch (e) {
    // TODO: impl. transaction rollback
    // newStorage.remove();
    this.remove(newID);
    throw e;
  }
  // update props to new ID
  doc.id = newID;
  doc.storage = newStorage;
};

// add a new blank document to the list.
// remember to close the previous document if it shares the div.
DocumentList.prototype.newBlankDocument = function (div) {
  var newID = newDocID();
  this.add(newID);
  div.node().innerHTML = '';
  return new TMDocument(div, newID);
};

// internal helper methods

Object.defineProperties(DocumentList.prototype, {
  // TODO: impl. transactions
  add: { value: function (docID) {
    this.idSet[docID] = true;
    this.updateStorage();
  }},
  remove: { value: function (docID) {
    delete this.idSet[docID];
    this.updateStorage();
  }},
  updateStorage: { value: function () {
    this.storage.write(this.storageKey, JSON.stringify(this.list));
  }}
});

// () -> DocID
function newDocID() { return String(Date.now()); }

////////////////
// TMDocument //
////////////////

// TODO: check pre-condition: document exists
/**
 * Open an existing document by ID, and load it into the <div>.
 *
 * @param  {D3Selection}  div   the D3 selection of the div to assign to this document
 * @param  {string}       docID the document ID
 * @throws {YAMLException}      if document's source code exists and is not valid YAML
 * @throws {TMSpecError}        if document's source code exists and has some other error
 */
function openDocument(div, docID) {
  var doc = new TMDocument(div, docID);
  // try loading data
  doc.loadProp(Prop.SourceCode, Tier.first);
  try {
    doc.loadPositions();
  } catch (e) { // ignore; not critical
  }
  return doc;
}

// internal use; don't export this constructor.
function TMDocument(div, docID) {
  this.__divSel = div;
  this.id = docID;
  this.storage = initDocumentStorage(docID);
}

// TODO: handle load/saveProp for when this.machine is missing

// (Prop, ?Tier) -> void
TMDocument.prototype.loadProp = function (prop, tier) {
  var read = function () {
    return useTier(tier, this.storage.withPath(prop)).read();
  }.bind(this);
  switch (prop) {
    case Prop.SourceCode:
      var value = read();
      if (value != null) { this.sourceCode = value; }
      break;
    case Prop.Positions:
      value = read();
      if (value) {
        this.machine.positionTable = Position.parsePositionTable(value);
      }
      break;
    default:
      throw new Error('TMDocument.loadProp: invalid prop: ' + prop);
  }
};

// throws if write fails (e.g. out of space)
// (Prop, ?Tier) -> void
TMDocument.prototype.saveProp = function (prop, tier) {
  var write = function (str) {
    useTier(tier, this.storage.withPath(prop)).write(str);
  }.bind(this);
  switch (prop) {
    case Prop.SourceCode:
      return write(this.sourceCode);
    case Prop.Positions:
      return write(Position.stringifyPositionTable(this.machine.positionTable));
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

Object.defineProperty(TMDocument.prototype, 'name', {
  get: function () { return this.__name; },
  enumerable: true
});

// eval a string and set the returned spec as the machine.
// throws if the source code (string) is not a valid spec.
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
  if (this.machine) {
    this.saveProp(Prop.Positions, Tier.visible);
    this.saveProp(Prop.SourceCode, Tier.visible);
  }
};

TMDocument.prototype.close = function () {
  if (this.machine) {
    this.machine.isRunning = false;
  }
  this.stash();
};

exports.openDocument = openDocument;
exports.examplesList = Examples.list;
exports.Prop = Prop;
exports.Tier = Tier;

exports.customDocumentList = customDocumentList;

// re-exports
exports.TMSpecError = Parser.TMSpecError;
exports.YAMLException = Parser.YAMLException;
