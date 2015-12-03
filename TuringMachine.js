var util = require('./util.js');

var nonNull = util.nonNull, coalesce = util.coalesce;

// Allow for both notational conventions of moving the head or moving the tape
// FIXME: display L/R according to convention, or specify custom showing function
// var MoveHead = Object.freeze({'left': {}, 'right': {}});
var MoveHead = Object.freeze({
  left: {toString: function() { return 'L'; } },
  right: {toString: function() { return 'R'; } }
});
var MoveTape = Object.freeze({left: MoveHead.right, right: MoveHead.left});

function TuringMachine(transition, initialState, tape) {
  this.transition = transition;
  this.state = initialState;
  this.tape = tape;
}

TuringMachine.prototype.toString = function() {
  return String(this.state) + '\n' + String(this.tape);
};

TuringMachine.prototype.step = function() {
  var action = this.transition(this.state, this.tape.read());
  this.tape.write(action.symbol);
  switch (action.move) {
    case MoveHead.right: this.tape.headRight(); break;
    case MoveHead.left:  this.tape.headLeft();  break;
    default: throw new Error('not a valid movement direction: ' + String(action.move));
  }
  this.state = action.state;
};

// 3 action primitives.
// 'write' is from the basic TM definition; 'move' and 'dir' are for convenience.
// the returned objects are frozen to prevent accidental corruption of transition functions
function write(sym, dir, state) {
  return Object.freeze({symbol: sym, move: dir, state: state});
}

function move(dir, state) {
  return Object.freeze({move: dir, state: state});
}

function skip(dir) {
  return Object.freeze({move: dir});
}

// (state, symbol) -> (state, symbol, direction)
function interpretAction(state, symbol, action) {
  return {
    state: coalesce(action.state, state),
    symbol: coalesce(action.symbol, symbol),
    move: nonNull(action.move)
  };
}

// TODO: add predicate for halting states
function makeTransition(obj) {
  return function(s, sym) {
    var stateObj = obj[s];
    if (stateObj === null) {
      throw new Error('the machine has already reached a halting state: ' + String(s));
    }
    if (stateObj === undefined) {
      throw new Error('not a valid state: ' + String(s));
    }
    var action = stateObj[sym];
    // try wildcard if not matched
    action = (action === undefined) ? stateObj['_'] : action;
    if (action == null) {
      throw new Error('no transition is defined from state ' + String(s) + ' for symbol '+ String(sym));
    }
    return interpretAction(s, sym, action);
  };
}

exports.MoveHead = MoveHead;
exports.MoveTape = MoveTape;
exports.TuringMachine = TuringMachine;
exports.write = write;
exports.move = move;
exports.skip = skip;
exports.interpretAction = interpretAction;
exports.makeTransition = makeTransition;
