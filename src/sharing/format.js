'use strict';

var jsyaml = require('js-yaml'),
    _ = require('lodash/fp');

// Document Serialization

var docToYaml = {
  name: 'name',
  sourceCode: 'source code',
  positionTable: 'positions',
  editorSourceCode: 'editor contents'
};
var yamlToDoc = _.invert(docToYaml);

// like _.mapKeys, but only using the keys specified in a mapping object.
// {[key: string] -> string} -> ?Object -> Object
function mapKeys(mapping) {
  return function (input) {
    var output = {};
    if (input != null) {
      Object.keys(mapping).forEach(function (fromKey) {
        var toKey = mapping[fromKey];
        output[toKey] = input[fromKey];
      });
    }
    return output;
  };
}

// we want parseDocument . stringifyDocument = identity, up to null == undefined.

/**
 * Serialize a document.
 * @param  {TMDocument} doc document to serialize
 * @return {string}
 */
var stringifyDocument = _.flow(
  mapKeys(docToYaml),
  _.omitBy(function (x) { return x == null; }),
  // NB. lodash/fp/partialRight takes an array of arguments.
  _.partialRight(jsyaml.safeDump, [{
    flowLevel: 2,       // positions: one state per line
    lineWidth: -1,      // don't wrap lines
    noRefs: true,       // no aliases/references are used
    noCompatMode: true  // use y: instead of 'y':
  }])
);

/**
 * Deserialize a document.
 * @param  {string} str    serialized document
 * @return {Object}        data usable in TMDocument.copyFrom()
 * @throws {YAMLException} on YAML syntax error
 * @throws {TypeError}     when missing "source code" string property
 */
var parseDocument = _.flow(
  jsyaml.safeLoad,
  mapKeys(yamlToDoc),
  checkData
);

// throw if "source code" attribute is missing or not a string
function checkData(obj) {
  if (obj == null || obj.sourceCode == null) {
    throw new InvalidDocumentError('The “source code:” value is missing');
  } else if (!_.isString(obj.sourceCode)) {
    throw new InvalidDocumentError('The “source code:” value needs to be of type string');
  }
  return obj;
}

// for valid YAML that is not valid as a document
function InvalidDocumentError(message) {
  this.name = 'InvalidDocumentError';
  this.message = message || 'Invalid document';
  this.stack = (new Error()).stack;
}
InvalidDocumentError.prototype = Object.create(Error.prototype);
InvalidDocumentError.prototype.constructor = InvalidDocumentError;

exports.stringifyDocument = stringifyDocument;
exports.parseDocument = parseDocument;
exports.InvalidDocumentError = InvalidDocumentError;

// Re-exports
exports.YAMLException = jsyaml.YAMLException;
