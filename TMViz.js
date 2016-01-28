'use strict';
/**
 * Turing Machine Visualization component.
 *
 * Concerns:
 * 	* Keeping state & tape diagram in sync with TM
 * 	* TM running/reset
 * (controls not included)
 * @module ./TMViz
 */

var TuringMachine = require('./TuringMachine').TuringMachine,
    TapeViz = require('./tape/TapeViz'),
    StateViz = require('./StateViz'),
    NodesLinks = require('./NodesLinks'),
    Position = require('./Position'),
    util = require('./util'),
    d3 = require('d3');

// StateMap -> State -> SymbolMap?
// throws error if state was not in the map.
// returns null for explicit halting state (assuming that .withSymbol was set correctly)
function lookupState(stateMap, s) {
  var stateObj = stateMap[s];
  if (stateObj === undefined) {
    throw new Error('not a valid state: ' + String(s));
  }
  return stateObj.withSymbol;
}

function interpretAction(state, symbol, instruct) {
  return {
    state: util.coalesce(instruct.state, state),
    symbol: util.coalesce(instruct.symbol, symbol),
    move: util.nonNull(instruct.move)
  };
}

// Animate each transition's edge
// TODO: factor out
// FIXME: missing null checks, like for .withSymbol
// TODO: decompose into lookup edge
function makeTransitionViz(stateMap, callback) {
  return function (s, sym) {
    var symbolMap = lookupState(stateMap, s);
    if (symbolMap == null) { return null; }
    var edgeObj = symbolMap[sym];
    // try wildcard if not matched
    // TODO: remove wildcards (deprecated)
    edgeObj = (edgeObj === undefined) ? symbolMap['_'] : edgeObj;
    if (edgeObj == null) { return null; }

    callback(edgeObj.edge);
    return interpretAction(s, sym, edgeObj.action);
  };
}

// default animation for edges.
// returns the last chained transition.
function pulseEdge(edge) {
  var edgepath = d3.select(edge.domNode);
  // workaround for https://github.com/d3/d3-transition/issues/11
  var normalColor = edgepath.style('stroke');
  var pulseColor = d3.select('#active-arrowhead').style('stroke');
  // TODO: animate arrowhead as well
  return edgepath
      .classed('active-edge', true)
    .transition()
      .style('stroke', pulseColor)
      .style('stroke-width', '3')
    .transition()
      .style('stroke', normalColor)
      .style('stroke-width', '1')
    .transition()
      .duration(0)
      .each('start', /* @this edge */ function () {
        d3.select(this).classed('active-edge', false);
      })
      .style('stroke', null)
      .style('stroke-width', null);
}

function addTape(div, spec) {
  return new TapeViz(div.append('svg').attr('class', 'tm-tape'), 7,
    spec.blank, spec.input ? spec.input.split('') : []);
}

/**
 * Construct a new state and tape visualization inside the `div` selection.
 * @param div       D3 selection of an HTML `div`
 * @param spec      machine specification
 * @param posTable  position table for the state nodes
 * @alias module:./TMViz.TMViz
 */
function TMViz(div, spec, posTable) {
  var dataset = NodesLinks.deriveNodesLinks(spec.table);
  var stateMap = dataset.stateMap;
  this.__stateMap = stateMap;
  if (posTable != undefined) { this.positionTable = posTable; }
  StateViz.visualizeState(div.append('svg'), dataset.nodes, dataset.edges);

  this.edgeAnimation = pulseEdge;
  this.stepInterval = 100;

  var self = this; // for nested callbacks
  function edgeCallback(edge) {
    var transition = self.edgeAnimation(edge);
    // if .isRunning, chain .step after .step until this.isRunning = false
    if (self.isRunning) {
      transition.transition().duration(self.stepInterval).each('end', function () {
        // check in case machine was paused (.isRunning = false) during the animation
        if (self.isRunning) {
          self.step();
        }
      });
    }
  }

  // TODO: rewrite the transition. make it point to this.stateMap, this.etc so it stays in sync with the spec.
  var machine = new TuringMachine(makeTransitionViz(stateMap, edgeCallback), spec.startState, addTape(div, spec));
  this.machine = machine;
  // intercept and animate when the state is set
  var state = machine.state;
  Object.defineProperty(machine, 'state', {
    get: function () { return state; },
    set: function (s) {
      d3.select(stateMap[state].domNode).classed('current-state', false);
      state = s;
      d3.select(stateMap[s].domNode).classed('current-state', true);
    }
  });
  machine.state = state;

  // Sidenote: each "Step" click evaluates the transition function once.
  // Therefore, detecting halting always requires its own step (for consistency).
  this.isHalted = false;

  var isRunning = false;
  Object.defineProperty(this, 'isRunning', {
    configurable: true,
    get: function () { return isRunning; },
    set: function (value) {
      if (isRunning !== value) {
        isRunning = value;
        if (isRunning) { this.step(); }
      }
    }
  });

  this.__parentDiv = div;
  this.__spec = spec;
}

// .step() immediately advances the machine and interrupts any transitions
TMViz.prototype.step = function () {
  if (!this.machine.step()) {
    this.isRunning = false;
    this.isHalted = true;
  }
};

TMViz.prototype.reset = function () {
  this.isRunning = false;
  this.isHalted = false;
  this.machine.state = this.__spec.startState;
  this.machine.tape.domNode.remove();
  this.machine.tape = addTape(this.__parentDiv, this.__spec);
};

// FIXME: also call force.tick / force.start
Object.defineProperty(TMViz.prototype, 'positionTable', {
  get: function () { return Position.getPositionTable(this.__stateMap); },
  set: function (posTable) {
    Position.setPositionTable(posTable, this.__stateMap);
    // FIXME: refactor StateViz as object, then call this.__stateviz.force.tick();
  }
});

exports.TMViz = TMViz;
