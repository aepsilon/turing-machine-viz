'use strict';
var _ = require('lodash/fp');

// Bidirectional infinite tape
function Tape(blank, input) {
  Object.defineProperty(this, 'blank', {
    value: blank,
    writable: false,
    enumerable: true
  });
  // zipper data structure
  // INVARIANTS: tape.before can be empty, tape.after must be nonempty.
  // before: cells before the head (in order; left to right).
  // after:  cells after and including the head (in reverse; right to left).
  this.tape = {
    before: [],
    after: (input == null || input.length == 0) ? [blank] : input.slice().reverse(),
    toString: function () {
      return this.before.join('') + '🔎' + this.after.slice().reverse().join('');
    }
  };
}

// Read the value at the tape head.
Tape.prototype.read = function () {
  return _.last(this.tape.after);
};
Tape.prototype.write = function (symbol) {
  this.tape.after[this.tape.after.length - 1] = symbol;
};

Tape.prototype.headRight = function () {
  var before = this.tape.before,
      after = this.tape.after;
  before.push(after.pop());
  if (_.isEmpty(after)) {
    after.push(this.blank);
  }
};
Tape.prototype.headLeft = function () {
  var before = this.tape.before,
      after = this.tape.after;
  if (_.isEmpty(before)) {
    before.push(this.blank);
  }
  after.push(before.pop());
};

Tape.prototype.toString = function () {
  return this.tape.toString();
};

// for tape visualization. not part of TM definition.
// Read the value at an offset from the tape head.
// 0 is the tape head. + is to the right, - to the left.
Tape.prototype.readOffset = function (i) {
  var tape = this.tape;
  if (i >= 0) {
    // right side: offset [0..length-1] ↦ array index [length-1..0]
    return (i <= tape.after.length - 1) ? tape.after[tape.after.length - 1 - i] : this.blank;
  } else {
    // left side: offset [-1..-length] ↦ array index [length-1..0]
    return (i >= -tape.before.length) ? tape.before[tape.before.length + i] : this.blank;
  }
};

// for tape visualization.
// Read the values from an offset range (inclusive of start and end).
Tape.prototype.readRange = function (start, end) {
  return _.range(start, end+1).map(function (i) {
    return this.readOffset(i);
  }, this);
};

module.exports = Tape;
