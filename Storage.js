'use strict';
var _ = require('underscore'); // lodash-fp's mapValues doesn't pass the key
/* global localStorage */

///////////////////////
// Key-Value Storage //
///////////////////////

var canUseLocalStorage = (function () {
  // from modernizr v3.3.1 (modernizr.com)
  var mod = 'modernizr';
  try {
    localStorage.setItem(mod, mod);
    localStorage.removeItem(mod);
    return true;
  } catch (e) {
    return false;
  }
})();

var RAMStorage = (function () {
  var obj = {};
  return Object.freeze({
    get length() { return Object.keys(obj).length; },
    key: function (n) { return (n in Object.keys(obj)) ? Object.keys(obj)[n] : null; },
    getItem: function (key) { return {}.hasOwnProperty.call(obj, key) ? obj[key] : null; },
    setItem: function (key, val) { obj[key] = String(val); },
    removeItem: function (key) { delete obj[key]; },
    clear: function () { obj = {}; }
  });
})();

var KeyValueStorage = (function () {
  var s = canUseLocalStorage ? localStorage : RAMStorage;
  return {
    read  : s.getItem.bind(s),
    write : s.setItem.bind(s),
    remove: s.removeItem.bind(s)
  };
})();

////////////////////
// Schema Storage //
////////////////////

/**
 * Initialize schema storage for an object.
 *
 * Schema storage reads and writes trees of strings
 * by keying each leaf node (string value) by its path.
 *
 * Since the structure is fixed by a schema, branch nodes need not be stored,
 * and each subtree can be read from and written to as its own entity.
 *
 * @param {string} prefix initial prefix for all keys, similar to a namespace
 * @param {Object} schema object that has the same structure as the data object,
 *   but with values (leaf nodes) replaced by null.
 * @param {?Object} storage key-value storage to use (default: KeyValueStorage)
 */
function SchemaStorage(prefix, schema, storage) {
  this.prefix = prefix;
  this.schema = schema;
  this.storage = storage != null ? storage : KeyValueStorage;
  Object.freeze(this);
}

/**
 * Focus on part of a schema.
 *
 * NB. Paths are not split on dots.
 * To prevent surprising behavior (like for 'prop.name'),
 * only array notation is allowed (['prop.name']).
 * @param  {[string]} keyPath the path of the subtree
 * @return {SchemaStorage}    new SchemaStorage rooted at the key path
 * @throws {TypeError}        if keyPath is not an array
 * @throws {SchemaPathError}  if keyPath is not in the schema
 */
SchemaStorage.prototype.withPath = function (keyPath) {
  if (!(keyPath instanceof Array)) {
    throw new TypeError('the key path for a schema must be an Array');
  }
  var root = subtree(this.schema, keyPath);
  if (root === undefined) { throw new SchemaPathError(keyPath); }
  var prefix = [].concat(this.prefix, keyPath).join('.');
  return new SchemaStorage(prefix, root, this.storage);
};

SchemaStorage.prototype.read = function () {
  return mapLeaves(this.storage.read.bind(this.storage), this.prefix, this.schema);
};

SchemaStorage.prototype.write = function (value) {
  recwrite(this.storage, this.prefix, this.schema, value);
};

SchemaStorage.prototype.remove = function () {
  mapLeaves(this.storage.remove.bind(this.storage), this.prefix, this.schema);
};

// (Object, [string]) -> any
function subtree(schema, keyPath) {
  var current = schema;
  if (keyPath.every(function (prop) {
    if ({}.hasOwnProperty.call(current, prop)) {
      current = current[prop];
      return true;
    } else {
      return false;
    }
  })) {
    return current;
  } else {
    return undefined;
  }
}

// structural map (similar to functor map)
// ((string -> a), string, {[key: string]: Object}) -> {[key: string]: a}
function mapLeaves(f, prefix, schema) {
  if (schema != null && typeof schema === 'object') {
    // inductive case
    return _.mapObject(schema, function (subschema, propName) {
      return mapLeaves(f, prefix + '.' + propName, subschema);
    });
  } else {
    // base case
    return f(prefix);
  }
}

function recwrite(storage, prefix, schema, value) {
  if (schema != null && typeof schema === 'object') {
    // inductive case
    return _.forEach(schema, function (subschema, propName) {
      if ({}.hasOwnProperty.call(value, propName)) {
        recwrite(storage, prefix + '.' + propName, subschema, value[propName]);
      }
    });
  } else if (schema == null && isString(value)) {
    // base case
    storage.write(prefix, value);
  }
}

function isString(x) {
  return typeof x === 'string' || x instanceof String;
}

function SchemaPathError(keyPath) {
  this.name = 'SchemaPathError';
  this.message = 'schema does not contain key path: ' + keyPath;
  this.stack = (new Error()).stack;
  this.keyPath = keyPath;
}

SchemaPathError.prototype = Object.create(Error.prototype);
SchemaPathError.prototype.constructor = SchemaPathError;

exports.canUseLocalStorage = canUseLocalStorage;
exports.KeyValueStorage = KeyValueStorage;
exports.SchemaStorage = SchemaStorage;
exports.SchemaPathError = SchemaPathError;
