var _ = require('lodash-fp');

// ** Misc Utilities **

// round to the nth decimal place
// (Int, Double) -> Double
function truncate(decimalPlaces, n) {
  var factor = Math.pow(10, decimalPlaces);
  return Math.round(n * factor)/factor;
}

// ** Point2D Utilities **

// Point2D = {x: Double, y: Double}

// Int -> Point2D -> Point2D
function truncatePoint2D(decimalPlaces) {
  return _.mapValues(_.partial(truncate, decimalPlaces));
}

// type HasXY = {x: number, y: number, ...};
// number -> HasXY -> HasXY
function truncateXY(decimalPlaces) {
  return function(val) {
    var info =  _(val).pick(['x','y','px','py'])
      .mapValues(_.partial(truncate, decimalPlaces))
      .value();
    return _.assign(info, _.clone(val));
  };
}

// Point2D -> [Double, Double]
function point2DToTuple(point) {
  return [point.x, point.y];
}

// [Double, Double] -> Point2D
function tupleToPoint2D(tuple) {
  return {x: tuple[0], y: tuple[1]};
}

// ** Node, {State: Node} Functions **

// Node -> Point2D
// var getNodePosition = _.pick(['x', 'y']);
function getNodePosition(node) {
  return {x: node.x, y: node.y};
}

// type PositionInfo = {x: number, y: number, px: number, py: number, fixed: boolean}
// Node -> PositionInfo
function getNodePositionInfo(node) {
  return _.pick(['x', 'y', 'px', 'py', 'fixed'], node);
}

// type State = string
// type PositionTable = { [key: State]: PositionInfo }
// {State: Node} -> PositionTable
var getPositionTable = _.mapValues(getNodePositionInfo);

// {State: Node} -> {State: Point2D}
var getNodePositions = _.mapValues(getNodePosition);

// tag w/ positions. mutates the node map.
// remember to call force.start() afterwards.
// {State: Point2D} -> {State: Node} -> IO ()
function arrangeNodes(positionFor, nodes) {
  _.forEach(function(node, state) {
    var pos = positionFor[state];
    if (pos !== undefined) {
      // note: D3 seems to ignore .x/.y; it re-renders only if .px/.py is set
      node.fixed = true;
      _.assign({px: pos.x, py: pos.y}, node);
      _.assign(pos, node);
    }
  })(nodes);
}

// tag w/ positions. mutates the node map.
// remember to call force.start() afterwards.
// {State: PositionInfo} -> {State: Node} -> IO ()
// TODO: rename to setPositionTable to match the getter
function setPositionInfo(posTable, stateMap) {
  _.forEach(function(node, state) {
    var posinfo = posTable[state];
    if (posinfo !== undefined) {
      _.assign(posinfo, node);
    }
  }, stateMap);
}

// ** Serialization **

// PositionTable -> JSON
var stringifyPositionTable = _.flow(
  _.mapValues(truncateXY(2)),
  JSON.stringify
);

// throws SyntaxError on exception
// JSON -> Object
var parsePositionTable = JSON.parse;

// We want the following properties:
//  * for all valid serializations: stringifyPositions . parsePositions = identity (by value)
//  * for all {State: Point2D}: parsePositions . stringifyPositions = _.mapValues(truncatePoint2D(2))

// {State: Point2D} -> JSON
var stringifyPositions = _.flow(
  // truncate decimal places and use array notation, to save space
  _.mapValues(_.flow(truncatePoint2D(2), point2DToTuple)),
  JSON.stringify
);

// JSON -> {State: Point2D}
var parsePositions = _.flow(
  JSON.parse,
  _.mapValues(tupleToPoint2D)
);

// {State: Node} -> JSON
var stringifyNodePositions = _.flow(getNodePositions, stringifyPositions);


// ** Sample position data **

// saved manual positioning
var posPowersOfTwoAlt = _.mapValues(tupleToPoint2D,
  {"q1":[147.59,199.38],"q2":[331.75,199.36],"q3":[533.52,200.36],"q4":[532.53,352.87],
  "q5":[445.27,123.98],"accept":[332.16,289],"reject":[145.58,352.18]}
);

var posPowersOfTwo = _.mapValues(
  // _.flow(_.map(function(n) { return 100*n; }), tupleToPoint2D), {
  function(p) { return {x: 100*p[0], y: 100*p[1] - 70}; }, {
  q1: [1,2], q2: [3,2], q3: [5,2], q5: [4,1.3],
  reject: [1,3.7], accept: [3,2.9], q4: [5,3.7]
});

exports.getNodePosition = getNodePosition;

exports.getNodePositionInfo = getNodePositionInfo;
exports.getPositionTable = getPositionTable;
exports.setPositionInfo = setPositionInfo;

exports.getNodePositions = getNodePositions;
exports.arrangeNodes = arrangeNodes;
exports.stringifyPositions = stringifyPositions;
exports.parsePositions = parsePositions;
exports.stringifyNodePositions = stringifyNodePositions;

exports.stringifyPositionTable = stringifyPositionTable;
exports.parsePositionTable = parsePositionTable;

exports.posPowersOfTwoAlt = posPowersOfTwoAlt;
exports.posPowersOfTwo = posPowersOfTwo;
