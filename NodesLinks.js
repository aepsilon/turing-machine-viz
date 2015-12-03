var util = require('./util.js'),
    _ = require('underscore');

var coalesce = util.coalesce;

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

// use a transition table to derive the nodes and edges for a D3 diagram.
// edges that have the same source and target are combined.
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
        var edgeTo = {};
        return (symbolMap == null) ? null : _(symbolMap).mapObject(function(action, symbol) {
          return {
            action: action,
            edge: (function() {
              var target = coalesce(action.state, state);
              var label = labelFor(symbol, action);
              // create only one edge per source-target pair
              var edge = edgeTo[target];
              return (edge != null)
                ? _.constant(edge)(edge.labels.push(label))
                : _(edgeTo[target] = {
                    source: thisObj,
                    target: stateMap[target],
                    labels: [label]
                }).tap(Array.prototype.push.bind(edges));
            })()
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

exports.deriveNodesLinks = deriveNodesLinks;
