/* @flow */

function last(array: Array<any>) {
  return array[array.length - 1];
}

function isEmpty(array: Array<any>) {
  return array.length === 0;
}

// TODO: replace read/write with get/set head?
function Tape<C>(blank: C, input: ?Array<C>) {
  this.__defineGetter__("blank", function() { return blank; });
  // cells before the head (in order) and cells after (in reverse order).
  // this allows fast push/pop from each end when moving the tape head.
  // invariants: tape.before can be empty, tape.after must be nonempty.
  var tape : { before: Array<C>, after: Array<C>, toString(): string } =
    { before: [],
      after: (input == undefined) ? [blank] : input.slice().reverse(),
      toString: function() {
        return tape.before.join('')+'🔎'+tape.after.slice().reverse().join('');
      }
    };
  this.tape = tape;
  this.read = function(): C {
    return last(tape.after);
  };
  this.write = function(x: C): void {
    tape.after[tape.after.length-1] = x;
  };
  // pre+post conditions: see invariants above for tape.
  this.headRight = function(): void {
    tape.before.push(tape.after.pop());
    if (isEmpty(tape.after)) { tape.after.push(blank); }
  };
  this.headLeft = function(): void {
    if (isEmpty(tape.before)) { tape.before.push(blank); }
    tape.after.push(tape.before.pop());
  };
  this.toString = this.tape.toString;
}

var testTape : Tape<string> = new Tape(' ', 'hello world'.split(''));
// testTape.write('h')
// testTape.headRight()
// testTape.write('e')


type MoveDir = bool;
type Transition<S,C> = (state: S, symbol: C) => [S, C, MoveDir];

function write(sym, dir: MoveDir, state): Transition {
  return function () {
    return [state, sym, dir];
  };
}

function move(dir: MoveDir, state): Transition {
  return function(_, sym) {
    return [state, sym, dir];
  };
}

function skip(dir: MoveDir): Transition {
  return function(state, sym) {
    return [state, sym, dir];
  }
}

var R = true;
var L = false;

var accept = move(R, 'accept');
var reject = move(R, 'reject');

// TODO: check if assigning x and _ cause problems
var m2lookup =
  { q1: {
      '0': write(' ', R, 'q2'),
      '_': reject
    },
    q2: {
      '0': write('x', R, 'q3'),
      ' ': accept,
      'x': skip(R)
    },
    q3: {
      '0': move(R, 'q4'),
      ' ': move(L, 'q5'),
      'x': skip(R)
    },
    q4: {
      '0': write('x', R, 'q3'),
      ' ': reject,
      'x': skip(R)
    },
    q5: {
      ' ': move(R, 'q2'),
      '_': skip(L)
    }
  };

// problem: JS is call by value.
function fromMaybe<A>(def: A, val: ?A): A {
  return (val == undefined) ? def : val;
}

// error as bottom value that inhabits all types.
function throwExpr<A>(e): A {
  throw e;
}

// var testFromMaybe: number = fromMaybe(throwExpr(new Error("expected non-null value")), null);

// function makeTransition(obj): Transition {
//   return function(s, sym) {
//     var statetable = obj[s];
//     if (symlookup == undefined) {
//       throw new Error("missing case for transition from state " + s.toString());
//     }
//     var action = symlookup[sym];
//     action = (action == undefined) ? symlookup['_'] : action;

//     action = obj[s][sym](s, sym);

//   }
//   function lookupSymbol(obj, sym) {
//     var res = obj[sym];
//     if (res == undefined) {
//       throw new Error("")
//     }
//   }

//   return function(s, sym) { return obj[s][sym]; };
// }

// function makeTransition(obj): Transition {
//   function nonnull(x)
//   function lookupSymbol(table, sym) {
//     return (table[sym] == undefined) ?
//       throw new Error('for state' + s + ', symbol not found: '+ sym.toString())
//       : table[sym];
//   }
//   return function(s, sym) {
//     // return fromMaybe(throwExpr(new Error("state not found" + s), obj[s][sym]; };
//     lookupSymbol(nonnull(obj[s]), sym);
// }

// FIXME: handle terminal states, as a list? sum type that also accepts a function?
// TODO: monadic bind to simplify
// TODO: fix type for obj? did not prevent return res; bug.
function makeTransition(obj): Transition {
  return function(s, sym) {
    var sym2res = obj[s];
    if (sym2res == undefined) {
      throw new Error('no transitions are defined from state: ' + s.toString());
    }
    var res = sym2res[sym];
    res = (res == undefined) ? sym2res['_'] : res;
    if (res == undefined) {
      throw new Error('no transition is defined from state ' + s.toString() + ' for symbol '+ sym.toString());
    }
    return res(s, sym);
  }
}

// state, sym -> state, sym, move
// wrapTransition(delta)

// var next = transition(state, sym)
// next.state, next.symbol, next.move

// eventually: animate symbol match, then writing symbol, then moving, then new state
// first: rudimentary TM, with manual stepping and only state highlighting. no tape display yet?

// TODO: include state in TM.toString()
function TuringMachine<S,C>(transition: Transition, initialState: S, blank: C, input: ?Array<C>) {
  this.transition = transition;
  this.state = initialState;
  this.tape = new Tape(blank, input);
}

TuringMachine.prototype.step = function() {
  var result = this.transition(this.state, this.tape.read());
  this.state = result[0];
  this.tape.write(result[1]);
  if (result[2]) { this.tape.headRight(); } else { this.tape.headLeft(); }
  // debug:
  console.log(this.state);
  console.log(this.tape.toString());
}

var m2delta : Transition = function (s, sym) {
  switch (s) {
    case 'q1':
      switch (sym) {
        case '0': return ['q2', ' ', true];
        default: return ['reject', sym, true];
      }
    case 'q2':
      switch (sym) {
        case '0': return ['q3', 'x', true];
        case ' ': return ['accept', sym, true];
        case 'x': return ['q2', sym, true];
      }
      break;
  }
  throw new Error("unhandled transition case: " + s + ' ' + sym);
};

// var m2 = new TuringMachine(m2delta, 'q1', ' ', '00'.split(''));
var m2input = '0000';
var m2 = new TuringMachine(makeTransition(m2lookup), 'q1', ' ', m2input.split(''));



