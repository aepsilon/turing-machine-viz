// requires Underscore.js
// requires ./util.js

// replace ' ' with '␣'.
function visibleSpace(c) {
  return (c === ' ') ? '␣' : c;
}

// TODO: allow custom function for showing spaces?
// FIXME: expand wildcard '_'
// FIXME: specify function to convert action.move into String
// TODO: enable specifying the wildcard character
function labelFor(symbol, action) {
  var rightSide = ((action.symbol == null) ? '' : (visibleSpace(String(action.symbol)) + ','))
    + String(action.move);
  return visibleSpace(String(symbol)) + '→' + rightSide;
}

// use a transition map to derive the nodes and edges for a D3 diagram
function deriveNodesLinks(obj) {
  // set each state to an object: {label:.., symboltabel:..}
  var stateMap = _.mapObject(obj,
    function(symbolMap, state) {
      return {
        label: state,
        withSymbol: symbolMap
      };
    }
  );

  var edges = [];

  function addEdges(stateObj, state) {
    stateObj.withSymbol = _(stateObj.withSymbol).mapObject(function(action, symbol) {
      var edge = {
        source: stateObj,
        target: stateMap[coalesce(action.state, state)],
        label: labelFor(symbol, action)
      }
      edges.push(edge);
      return {
        action: action,
        edge: edge
      };
    });
  }

  _(stateMap).mapObject(addEdges);

  return {
    nodes: _(stateMap).values(),
    edges: edges,
    stateMap: stateMap
  };
}

