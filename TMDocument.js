/* eslint-env browser */

var Position = require('./Position'),
    util = require('./util');

var applyMaybe = util.applyMaybe;

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
function getDocumentPositions(docID) {
  // TODO: include defaults lookup for examples
  return getDocumentStashedPositions(docID)
      || getDocumentSavedPositions(docID);
}

// Tier -> DocID -> ?PositionTable
function getPositionsByTier(tier) {
  var prefix = prefixForTier(tier);
  return function(docID) {
    return applyMaybe(Position.parsePositionTable, localStorage.getItem(prefix + docID));
  };
}

// DocID -> ?PositionTable
var getDocumentStashedPositions = getPositionsByTier(Tier.stashed);
var getDocumentSavedPositions = getPositionsByTier(Tier.saved);

// Tier -> (DocID, PositionTable) -> void
function setPositionsByTier(tier) {
  var prefix = prefixForTier(tier);
  return function (docID, positionTable) {
    localStorage.setItem(prefix + docID, Position.stringifyPositionTable(positionTable));
  };
}

// throws exception on failure
// (DocID, PositionTable) -> void
var stashDocumentPositions = setPositionsByTier(Tier.stashed);
var saveDocumentPositions = setPositionsByTier(Tier.saved);

exports.getDocumentPositions = getDocumentPositions;
exports.getDocumentStashedPositions = getDocumentStashedPositions;
exports.getDocumentSavedPositions = getDocumentSavedPositions;
exports.stashDocumentPositions = stashDocumentPositions;
exports.saveDocumentPositions = saveDocumentPositions;
