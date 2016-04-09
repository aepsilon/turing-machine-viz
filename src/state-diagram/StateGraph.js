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

      return _.mapValues(vertex.transitions, function (instruct, symbol) {
        // Normalize for execution, but display the less-cluttered original.
        var normalized = normalize(state, symbol, instruct);
        return {
          instruction: normalized,
          edge: edgeTo(normalized.state, labelFor(symbol, instruct))
        };
      });
    }());
  });

  return {graph: graph, edges: allEdges};
}

// Normalize an instruction to include an explicit state and symbol.
// e.g. {symbol: '1'} normalizes to {state: 'q0', symbol: '1'} when in state q0.
function normalize(state, symbol, instruction) {
  return _.defaults({}, instruction, {state: state, symbol: symbol});
}

// TODO: allow custom function for showing spaces?
function labelFor(symbol, action) {
  var rightSide = ((action.symbol == null) ? '' : (visibleSpace(String(action.symbol)) + ','))
    + String(action.move);
  return visibleSpace(String(symbol)) + '→' + rightSide;
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
StateGraph.prototype.getVertices = function () {
  return _.values(this.__graph);
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

// TODO: incorporate multi-symbol left side matching
StateGraph.prototype.getInstructionAndEdge = function (state, symbol) {
  var vertex = this.__graph[state];
  if (vertex === undefined) {
    throw new Error('not a valid state: ' + String(state));
  }

  return vertex.transitions && vertex.transitions[symbol];
};


module.exports = StateGraph;
