'use strict';
/**
 * Construct a Turing machine.
 * @param {(state, symbol) -> ?{state: state, symbol: symbol, move: direction}}
 *   transition
 *   A transition function that, given *only* the current state and symbol,
 *   returns an object with the following properties: symbol, move, and state.
 *   Returning null/undefined halts the machine (no transition defined).
 * @param {state} startState  The state to start in.
 * @param         tape        The tape to use.
 */
function TuringMachine(transition, startState, tape) {
  this.transition = transition;
  this.state = startState;
  this.tape = tape;
}

TuringMachine.prototype.toString = function () {
  return String(this.state) + '\n' + String(this.tape);
};

/**
 * Step to the next configuration according to the transition function.
 * @return {boolean} true if successful (the transition is defined),
 *   false otherwise (machine halted)
 */
TuringMachine.prototype.step = function () {
  var instruct = this.nextInstruction;
  if (instruct == null) { return false; }

  this.tape.write(instruct.symbol);
  move(this.tape, instruct.move);
  this.state = instruct.state;

  return true;
};

Object.defineProperties(TuringMachine.prototype, {
  nextInstruction: {
    get: function () { return this.transition(this.state, this.tape.read()); },
    enumerable: true
  },
  isHalted: {
    get: function () { return this.nextInstruction == null; },
    enumerable: true
  }
});

// Allows for both notational conventions of moving the head or moving the tape
function move(tape, direction) {
  switch (direction) {
    case MoveHead.right: tape.headRight(); break;
    case MoveHead.left:  tape.headLeft();  break;
    default: throw new TypeError('not a valid tape movement: ' + String(direction));
  }
}
var MoveHead = Object.freeze({
  left:  {toString: function () { return 'L'; } },
  right: {toString: function () { return 'R'; } }
});
var MoveTape = Object.freeze({left: MoveHead.right, right: MoveHead.left});

exports.MoveHead = MoveHead;
exports.MoveTape = MoveTape;
exports.TuringMachine = TuringMachine;
