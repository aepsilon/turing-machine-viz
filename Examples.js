/* eslint-env es6 */ // for template literals
var TM = require('./TuringMachine.js'),
    Position = require('./Position.js');

// FIXME: fix type signatures. modify examples to include name.
// use makeExample: string -> {name: string, spec: Spec, sourceCode: string}
//
// var MoveHead = TM.MoveHead, MoveTape = TM.MoveTape,
//     write = TM.write, move = TM.move, skip = TM.skip;
// // convenient synonyms
// var L = MoveHead.left;
// var R = MoveHead.right;

// {string: string}
var examples = {};

// From "Introduction to the Theory of Computation" (3rd ed.) by Michael Sipser, pg. 172
examples.powersOfTwo = `return {
  name: 'powers of two',
  input: '0000',
  blank: ' ',
  startState: 'q1',
  table: (function() {
    var accept = move(R, 'accept');
    var reject = move(R, 'reject');
    return {
      q1: {
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
      },
      'accept': null,
      'reject': null
    };
  })()
};`;

// Busy beavers, repeat01, and copy1s are from
// https://en.wikipedia.org/wiki/Busy_beaver and
// https://en.wikipedia.org/wiki/Turing_machine_examples
examples.busyBeaver3 = `return {
  name: '3-state busy beaver',
  input: '',
  blank: 0,
  startState: 'A',
  table: (function() {
    var L = MoveTape.left;
    var R = MoveTape.right;
    var halt = move(R, 'halt');
    return {
      A: {
        0: write(1, R, 'B'),
        1: move(L, 'C')
      },
      B: {
        0: write(1, L, 'A'),
        1: skip(R)
      },
      C: {
        0: write(1, L, 'B'),
        1: halt
      },
      halt: null
    };
  })()
};`;

examples.busyBeaver3alt = `return {
  name: '3-state busy beaver (alternate)',
  input: '',
  blank: 0,
  startState: 'A',
  table: (function() {
    var halt = move(R, 'halt');
    return {
      A: {
        0: write(1, R, 'B'),
        1: halt
      },
      B: {
        0: move(R, 'C'),
        1: skip(R)
      },
      C: {
        0: write(1, L, 'C'),
        1: move(L, 'A')
      },
      halt: null
    };
  })()
};`;

examples.busyBeaver4 = `return {
  name: '4-state busy beaver',
  input: '',
  blank: 0,
  startState: 'A',
  table: {
    A: {0: write(1, R, 'B'), 1: move(L, 'B')},
    B: {0: write(1, L, 'A'), 1: write(0, L, 'C')},
    C: {0: write(1, R, 'H'), 1: move(L, 'D')},
    D: {0: write(1, R, 'D'), 1: write(0, R, 'A')},
    H: null
  }
};`;

examples.repeat01 = `return {
  name: 'repeat 0 1',
  input: '',
  blank: ' ',
  startState: 'b',
  table: {
    b: {' ': write(0, R, 'c')},
    c: {' ': move(R, 'e')},
    e: {' ': write(1, R, 'f')},
    f: {' ': move(R, 'b')}
  }
};`;

examples.copy1s = `return {
  name: 'copy 1s',
  input: '111',
  blank: '0',
  startState: 's1',
  table: (function() {
    var halt = move(R, 'H');
    return {
      s1: {
        0: halt,
        1: write(0, R, 's2')
      },
      s2: {
        0: move(R, 's3'),
        1: skip(R)
      },
      s3: {
        0: write(1, L, 's4'),
        1: skip(R)
      },
      s4: {
        0: move(L, 's5'),
        1: skip(L)
      },
      s5: {
        0: write(1, R, 's1'),
        1: skip(L)
      },
      H: null
    };
  })()
};`;

examples.binaryIncrement = `return {
  name: 'binary increment',
  input: '1011',
  blank: ' ',
  startState: 'right',
  table: {
    'right': {
      0: skip(R),
      1: skip(R),
      ' ': move(L, 'inc')
    },
    'inc': {
      1: write(0, L, 'inc'),
      0: write(1, R, 'done'),
      ' ': write(1, R, 'done')
    },
    'done': null
  }
};`;

module.exports = exports = examples;
