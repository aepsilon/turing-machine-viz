'use strict';

var Storage = require('./Storage'),
    Examples = require('./Examples'),
    Position = require('./Position'),
    util = require('./util');

/**
 * Document model (storage).
 * @param {string} docID Each document ID in a key-value store should be unique.
 */
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

module.exports = TMDocument;
