var TM = require('./TuringMachine.js'),
    TapeViz = require('./tape/TapeViz.js'),
    StateViz = require('./StateViz.js'),
    NodesLinks = require('./NodesLinks.js'),
    Position = require('./Position.js'),
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

function isHaltingState(stateMap, state) {
  return lookupState(stateMap, state) == null;
}

function HaltedError(state) {
  this.name = 'HaltedError';
  this.message = 'the machine has already reached a halting state: ' + String(state);
  this.stack = (new Error()).stack;
}
HaltedError.prototype = Object.create(Error.prototype);
HaltedError.prototype.constructor = HaltedError;

// Animate each transition's edge
// TODO: factor out
// FIXME: missing null checks, like for .withSymbol
// TODO: decompose into lookup edge
function makeTransitionViz(stateMap, callback) {
  return function(s, sym) {
    var symbolMap = lookupState(stateMap, s);
    if (symbolMap == null) { throw new HaltedError(s); }
    var edgeObj = symbolMap[sym];
    // try wildcard if not matched
    // TODO: remove wildcards (deprecated)
    edgeObj = (edgeObj === undefined) ? symbolMap['_'] : edgeObj;
    if (edgeObj == null) {
      throw new Error('no transition is defined from state ' + String(s) + ' for symbol '+ String(sym));
    }

    callback(edgeObj.edge);
    return TM.interpretAction(s, sym, edgeObj.action);
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
      .each('start', function() { d3.select(this).classed('active-edge', false); })
      .style('stroke', null)
      .style('stroke-width', null);
}

function addTape(div, spec) {
  return new TapeViz(div.append('svg').attr('class', 'tm-tape'), 7, spec.blank, spec.input.split(''));
}

// TODO: machine spec checker:
// * typeof table should be object, not function.
// * each non-halting state should cover all symbol cases

// construct a new state and tape visualization inside the 'div' selection.
function TMViz(div, spec, positions) {
  var dataset = NodesLinks.deriveNodesLinks(spec.table);
  var stateMap = dataset.stateMap;
  this.stateMap = stateMap;
  if (positions != undefined) {
    Position.arrangeNodes(positions, stateMap);
  }
  StateViz.visualizeState(div.append('svg'), dataset.nodes, dataset.edges);

  var viz = this; // bind 'this' to use inside callbacks
  // FIXME: find a solution that doesn't require the edge animation to return the chained animation
  this.edgeAnimation = pulseEdge;
  this.stepInterval = 100;
  function edgeCallback(edge) {
    var transition = viz.edgeAnimation(edge);
    // check beforehand in case .isRunning changes to true during the transition
    if (viz.isRunning) {
      transition.transition().duration(viz.stepInterval).each('end', function() {
        // check afterwards in case machine was paused during the transition
        if (viz.isRunning) {
          viz.step();
        }
      });
    }
  }

  // TODO: rewrite the transition. make it point to this.stateMap, this.etc so it stays in sync with the spec.
  var machine = new TM.TuringMachine(makeTransitionViz(stateMap, edgeCallback), spec.startState, addTape(div, spec));
  this.machine = machine;
  // intercept and animate when the state is set
  // FIXME: experimental. override TuringMachine.state
  var state = machine.state;
  Object.defineProperty(machine, 'state', {
    get: function() { return state; },
    set: function(s) {
      d3.select(stateMap[state].domNode).classed('current-state', false);
      state = s;
      d3.select(stateMap[s].domNode).classed('current-state', true);
    }
  });
  machine.state = state;

  this.isHalted = isHaltingState(stateMap, state);

  var isRunning = false;
  Object.defineProperty(this, 'isRunning', {
    configurable: true,
    get: function() { return isRunning; },
    set: function(value) {
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
TMViz.prototype.step = function() {
  if (this.isHalted) {
    console.error('Logic error: tried to step a halted machine');
    this.isRunning = false;
    return;
  }
  try {
    this.machine.step();
  } catch (e) {
    this.isRunning = false;
    this.isHalted = true;
    if (!(e instanceof HaltedError)) {
      throw e;
    }
  }
};

TMViz.prototype.reset = function() {
  this.isRunning = false;
  this.isHalted = false;
  this.machine.state = this.__spec.startState;
  this.machine.tape.domNode.remove();
  this.machine.tape = addTape(this.__parentDiv, this.__spec);
};

exports.TMViz = TMViz;
