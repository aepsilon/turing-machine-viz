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
  var edges = [];

  var stateMap = _(obj).mapObject(function(symbolMap, state) {
    // create the nodes.
    return {
      label: state,
      // create the edges.
      // defer evaluation until after nodes are created,
      // since edge.target is potentially another node's object.
      withSymbol: function(thisObj) {
        return (symbolMap == null) ? null : _(symbolMap).mapObject(function(action, symbol) {
          return {
            action: action,
            edge: _({
              source: thisObj,
              target: stateMap[coalesce(action.state, state)],
              label: labelFor(symbol, action)
            }).tap(edges.push.bind(edges))
          };
        });
      }
    };
  });
  // evaluate the deferred values
  _(stateMap).mapObject(function(o) { o.withSymbol = o.withSymbol(o); });
  
  return {
    nodes: _(stateMap).values(),
    edges: edges,
    stateMap: stateMap
  };
}

