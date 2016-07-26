'use strict';

var KeyValueStorage = require('./storage').KeyValueStorage,
    examples = require('./examples'),
    util = require('./util'),
    _ = require('lodash/fp');

/**
 * Document model (storage).
 * @param {string} docID Each document ID in a key-value store should be unique.
 *                       An ID is typically a timestamp. It should not contain '.'.
 */
function TMDocument(docID) {
  var preset = examples.get(docID);
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
  return [this.prefix, path].join('.');
};

(function () {
  var store = KeyValueStorage;
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
        return util.applyMaybe(parsePositionTable,
          read(this.path('diagram.positions')));
      },
      set: function (val) {
        write(this.path('diagram.positions'),
          util.applyMaybe(stringifyPositionTable, val));
      },
      enumerable: true
    },
    editorSourceCode: stringProp('editor.sourceCode'),
    name: stringProp('name')
  };
  Object.defineProperties(TMDocument.prototype, propDescriptors);
  TMDocument.prototype.dataKeys = Object.keys(propDescriptors);
})();

// IDEA: bypass extra parse & stringify cycle for positions
TMDocument.prototype.copyFrom = function (other) {
  this.dataKeys.forEach(function (key) {
    this[key] = other[key];
  }, this);
  return this;
};

TMDocument.prototype.delete = function () {
  this.copyFrom({});
};

// Cross-tab/window storage sync

/**
 * Checks whether a storage key is for a document's name.
 * @return {?string} The document ID if true, otherwise null.
 */
TMDocument.IDFromNameStorageKey = function (string) {
  var result = /^doc\.([^.]+)\.name$/.exec(string);
  return result && result[1];
};

/**
 * Registers a listener for document changes caused by other tabs/windows.
 * The listener receives the document ID and the property name that changed.
 * @param {Function} listener
 */
TMDocument.addOutsideChangeListener = function (listener) {
  var re = /^doc\.([^.]+)\.(.+)$/;

  KeyValueStorage.addStorageListener(function (e) {
    var matches = re.exec(e.key);
    if (matches) {
      listener(matches[1], matches[2]);
    }
  });
};

/////////////////////////
// Position table JSON //
/////////////////////////

// JSON -> Object
var parsePositionTable = JSON.parse;

// PositionTable -> JSON
var stringifyPositionTable = _.flow(
  _.mapValues(truncateCoords(2)),
  JSON.stringify
);

// Truncate .x .y .px .py to 2 decimal places, to save space.
function truncateCoords(decimalPlaces) {
  var multiplier = Math.pow(10, decimalPlaces);
  function truncate(value) {
    return Math.round(value * multiplier)/multiplier;
  }

  return function (val) {
    var result =  _(val).pick(['x','y','px','py']).mapValues(truncate).value();
    result.fixed = val.fixed;
    return result;
  };
}

module.exports = TMDocument;
