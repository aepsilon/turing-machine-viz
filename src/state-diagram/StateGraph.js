'use strict';

var _ = require('lodash');


/* Interface
  type TransitionTable = {
    [state: string]: ?{
      [symbol: string]: Instruction
    }
  };
  type Instruction = { state?: string, symbol?: string };

  type DiagramGraph = {
    [state: string]: {
      label: string,
      transitions: ?{
        [symbol: string]: {
          instruction: Instruction,
          edge: LayoutEdge
        }
      }
    }
  };
  type LayoutEdge = { source: Object, target: Object, labels: [string] }
 */

/**
 * Use a transition table to derive the graph (vertices & edges) for a D3 diagram.
 * Edges with the same source and target are combined.
 * NB. In addition to single symbols, comma-separated symbols are supported.
 * e.g. symbol string '0,1,,,I' -> symbols [0,1,',','I'].
 */
// TransitionTable -> DiagramGraph
function deriveGraph(table) {
  // We need two passes, since edges may point at vertices yet to be created.
  // 1. Create all the vertices.
  var graph = _.mapValues(table, function (transitions, state) {
    return {
      label: state,
      transitions: transitions
    };
  });
  // 2. Create the edges, which can now point at any vertex object.
  var allEdges = [];
  _.forEach(graph, function (vertex, state) {

    vertex.transitions = vertex.transitions && (function () {
      var stateTransitions = {};

      // Combine edges with the same source and target
      var cache = {};
      function edgeTo(target, label) {
        var edge = cache[target] ||
          _.tap(cache[target] = {
            source: vertex,
            target: graph[target],
            labels: []
          }, allEdges.push.bind(allEdges));
        edge.labels.push(label);
        return edge;
      }
      // Create symbol -> instruction object map
      _.forEach(vertex.transitions, function (instruct, symbolKey) {
        // Handle comma-separated symbols.
        // Recreate array by splitting on ','. Treat 2 consecutive ',' as , ','.
        var symbols = symbolKey.split(',').reduce(function (acc, x) {
          if (x === '' && acc[acc.length-1] === '') {
            acc[acc.length-1] = ',';
          } else {
            acc.push(x);
          }
          return acc;
        }, []);
        var target = instruct.state != null ? instruct.state : state;
        var edge = edgeTo(target, labelFor(symbols, instruct));

        symbols.forEach(function (symbol) {
          stateTransitions[symbol] = {
            // Normalize for execution, but display the less-cluttered original.
            instruction: normalize(state, symbol, instruct),
            edge: edge
          };
        });
      });

      return stateTransitions;
    }());

  });

  return {graph: graph, edges: allEdges};
}

// Normalize an instruction to include an explicit state and symbol.
// e.g. {symbol: '1'} normalizes to {state: 'q0', symbol: '1'} when in state q0.
function normalize(state, symbol, instruction) {
  return _.defaults({}, instruction, {state: state, symbol: symbol});
}

function labelFor(symbols, action) {
  var rightSide = ((action.symbol == null) ? '' : (visibleSpace(String(action.symbol)) + ','))
    + String(action.move);
  return symbols.map(visibleSpace).join(',') + '→' + rightSide;
}

// replace ' ' with '␣'.
function visibleSpace(c) {
  return (c === ' ') ? '␣' : c;
}


/**
 * Aids rendering and animating a transition table in D3.
 *
 * • Generates the vertices and edges ("nodes" and "links") for a D3 diagram.
 * • Provides mapping of each state to its vertex and each transition to its edge.
 * @param {TransitionTable} table
 */
function StateGraph(table) {
  var derived = deriveGraph(table);
  Object.defineProperties(this, {
    __graph: { value: derived.graph },
    __edges: { value: derived.edges }
  });
}

/**
 * D3 layout "nodes".
 */
// StateGraph.prototype.getVertices = function () {
//   return _.values(this.__graph);
// };

/**
 * Returns the mapping from states to vertices (D3 layout "nodes").
 * @return { {[state: string]: Object} }
 */
StateGraph.prototype.getVertexMap = function () {
  return this.__graph;
};

/**
 * D3 layout "links".
 */
StateGraph.prototype.getEdges = function () {
  return this.__edges;
};

/**
 * Look up a state's corresponding D3 "node".
 */
StateGraph.prototype.getVertex = function (state) {
  return this.__graph[state];
};

StateGraph.prototype.getInstructionAndEdge = function (state, symbol) {
  var vertex = this.__graph[state];
  if (vertex === undefined) {
    throw new Error('not a valid state: ' + String(state));
  }

  return vertex.transitions && vertex.transitions[symbol];
};


module.exports = StateGraph;
