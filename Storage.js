var Position = require('./Position.js');

/* Types
type Key = String
savePositions :: Key -> {State: Point2D} -> IO ()
loadPositions :: Key -> IO {State: Point2D}?
*/

// TODO: test for localStorage, including quota = 0
// TODO: report write failures, eg. quota exceeded
// TODO: report data volatility for iOS Safari

function savePositions(key, positions) {
  localStorage.setItem(key, Position.stringifyPositions(positions));
}

function saveNodePositions(key, statemap) {
  return savePositions(key, Position.getNodePositions(statemap));
}

function loadPositions(key) {
  var json = localStorage.getItem(key);
  return json ? Position.parsePositions(json) : json;
}

exports.savePositions = savePositions;
exports.saveNodePositions = saveNodePositions;
exports.loadPositions = loadPositions;

