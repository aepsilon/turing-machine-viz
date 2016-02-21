'use strict';
var _ = require('lodash/fp'),
    assign = require('lodash').assign; // need mutable assign()

// ** Misc Utilities **

/**
 * Round x to n decimal places.
 * @param  {number} n number of decimal places
 * @param  {number} x number to round
 * @return {number}
 */
function truncate(n, x) {
  var factor = Math.pow(10, n);
  return Math.round(x * factor)/factor;
}

// type HasXY = {x: number, y: number, px: number, py: number};
// number -> HasXY -> HasXY
function truncateXY(decimalPlaces) {
  return function (val) {
    var result =  _(val).pick(['x','y','px','py'])
      .mapValues(truncate.bind(undefined, decimalPlaces))
      .value();
    result.fixed = val.fixed;
    return result;
  };
}

// ** Node, {State: Node} Functions **

// type PositionInfo = {x: number, y: number, px: number, py: number, fixed: boolean}
// Node -> PositionInfo
function getNodePositionInfo(node) {
  return _.pick(['x', 'y', 'px', 'py', 'fixed'], node);
}

// type State = string
// type PositionTable = { [key: State]: PositionInfo }

// {State: Node} -> PositionTable
var getPositionTable = _.mapValues(getNodePositionInfo);

// tag w/ positions. mutates the node map.
// remember to call force.start() afterwards.
// {[key: State]: PositionInfo} -> {[key: State]: Node} -> void
function setPositionTable(posTable, stateMap) {
  _.forEach(function (node, state) {
    var position = posTable[state];
    if (position !== undefined) {
      assign(node, position);
    }
  }, stateMap);
}

// ** Serialization **

// PositionTable -> JSON
var stringifyPositionTable = _.flow(
  _.mapValues(truncateXY(2)), // truncate to save space
  JSON.stringify
);

// throws SyntaxError on exception
// JSON -> Object
var parsePositionTable = JSON.parse;

exports.getPositionTable = getPositionTable;
exports.setPositionTable = setPositionTable;

exports.stringifyPositionTable = stringifyPositionTable;
exports.parsePositionTable = parsePositionTable;
