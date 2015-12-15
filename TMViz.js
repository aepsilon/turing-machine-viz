var TM = require('./TuringMachine.js'),
    TapeViz = require('./tape/TapeViz.js'),
    StateViz = require('./StateViz.js'),
    NodesLinks = require('./NodesLinks.js'),
    d3 = require('d3');

// Animate each transition's edge
// TODO: factor out
// FIXME: missing null checks, like for .withSymbol

// TODO: decompose into lookup edge
function makeTransitionViz(stateMap, callback) {
  return function(s, sym) {
    var stateObj = stateMap[s];
    if (stateObj === undefined) {
      throw new Error('not a valid state: ' + String(s));
    }
    var symbolMap = stateObj.withSymbol;
    if (symbolMap === null) {
      throw new Error('the machine has already reached a halting state: ' + String(s));
    }
    var edgeObj = symbolMap[sym];
    // try wildcard if not matched
    edgeObj = (edgeObj === undefined) ? symbolMap['_'] : edgeObj;
    if (edgeObj == null) {
      throw new Error('no transition is defined from state ' + String(s) + ' for symbol '+ String(sym));
    }

    callback(edgeObj.edge);
    return TM.interpretAction(s, sym, edgeObj.action);
  };
}

// sample animation for edges.
// returns the last chained transition.
function pulseEdgeSample(edge) {
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
      .each('start', function() { d3.select(this).classed('active-edge', false) })
      .style('stroke', null)
      .style('stroke-width', null);
}

// TODO: machine spec checker:
// * typeof table should be object, not function.
// * each non-halting state should cover all symbol cases

// construct a new state and tape visualization inside the 'div' selection.
function constructMachine(div, spec) {
  var dataset = NodesLinks.deriveNodesLinks(spec.table);
  var stateMap = dataset.stateMap;
  if (spec.positions != undefined) {
    Position.arrangeNodes(spec.positions, stateMap);
  }
  StateViz.visualizeState(div.append('svg'), dataset.nodes, dataset.edges);

  function addTape() {
    return new TapeViz(div.insert('svg', 'button').attr('class', 'tm-tape'), 7, spec.blank, spec.input.split(''));
  }
  // FIXME: factor out this experimental code.
  var machine;
  var delayBetweenSteps = 100;
  function edgeCallback(edge) {
    var transition = pulseEdgeSample(edge);
    // check beforehand in case .isRunning changes to true during the transition
    if (machine.isRunning) {
      transition.transition().duration(delayBetweenSteps).each('end', function() {
        // check afterwards in case machine was paused during the transition
        if (machine.isRunning) {
          machine.step();
        }
      });
    }
  }

  machine = new TM.TuringMachine(makeTransitionViz(stateMap, edgeCallback), spec.startState, addTape());
  // FIXME: experimental. override TuringMachine.state
  machine.__state = machine.state;
  Object.defineProperty(machine, 'state', {
    get: function() { return this.__state; },
    set: function(s) {
      d3.select(stateMap[this.__state].domNode).classed('current-state', false);
      this.__state = s;
      d3.select(stateMap[s].domNode).classed('current-state', true);
    }
  });
  machine.state = machine.__state;



  // FIXME: check if starting state is already halted. factor out into TM.js.
  machine.isHalted = false;

  var isRunning = false;
  Object.defineProperty(machine, 'isRunning', {
    configurable: true,
    get: function() { return isRunning; },
    set: function(value) {
      if (isRunning !== value) {
        isRunning = value;
        if (isRunning) { this.step(); }
      }
    }
  })

  // .step() immediately advances the machine and interrupts any transitions
  // TODO: factor out into TMViz class prototype
  var singleStep = Object.getPrototypeOf(machine).step.bind(machine);
  machine.step = function() {
    if (machine.isHalted) {
      console.error('Logic error: tried to step a halted machine');
      machine.isRunning = false;
      return;
    }
    try {
      singleStep();
      // FIXME: specialize to rethrow if not HaltError
    } catch (e) {
      machine.isRunning = false;
      machine.isHalted = true;
    }
  }

  machine.reset = function() {
    machine.isRunning = false;
    machine.isHalted = false;
    machine.state = spec.startState;
    machine.tape.domNode.remove();
    machine.tape = addTape();
  }

  return {
    machine: machine,
    stateMap: stateMap
  };
}

exports.constructMachine = constructMachine;
