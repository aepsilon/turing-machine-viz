'use strict';

var parseDocument = require('./sharing/format').parseDocument;
var lodash = require('lodash'); // for 2-arg mapValues and mutable assign

/* eslint-env es6 */
// enable es6 for template literals, since per-file ecmaFeatures aren't available.
// https://github.com/eslint/eslint/issues/2950

// {[key: string]: string}
var examples = {};

examples.powersOfTwo =
`name: powers of two
source code: |
  # Matches strings of 0s whose length is a power of two.
  # Based on an example from
  #   "Introduction to the Theory of Computation" (3rd ed.)
  #   by Michael Sipser
  input: '0000' # try '0', '000', '00000000'
  blank: ' '
  start state: none
  synonyms:
    accept: {R: accept}
    reject: {R: reject}
  # The idea: divide the length by 2 each time until it reaches 1.
  #
  # To do this, cross off every other 0, one pass at a time.
  # If any pass reads an odd number of 0s (a remainder), reject right away.
  # Otherwise if every pass halves the length cleanly,
  # the length must be a power of two (1*2^n for n ≥ 0).
  #
  # Note that since the first 0 is never crossed off, we can simply
  # erase it on the first pass and start the count from 1 from then on.
  table:
    none:
      0: {write: ' ', R: one}
      ' ': reject
    # Base case. Accept length of 1 = 2^0.
    one:
      0  : {write: x, R: even}
      ' ': accept
      x  : R
    # Inductive case.
    # Divide by 2 and check for no remainder.
    even:
      0  : {R: odd}
      ' ': {L: back} # return for another pass
      x  : R
    odd: # odd and > 1
      0  : {write: x, R: even}
      ' ': reject # odd number of 0s on this pass
      x  : R
    back:
      ' ': {R: one}
      [0,x]: L
    accept:
    reject:
`;

// Busy beavers, repeat01, and copy1s are from
// https://en.wikipedia.org/wiki/Busy_beaver and
// https://en.wikipedia.org/wiki/Turing_machine_examples
examples.busyBeaver3 =
`name: 3-state busy beaver
source code: |
  blank: 0
  start state: A
  table:
    A:
      0: {write: 1, R: B}
      1: {L: C}
    B:
      0: {write: 1, L: A}
      1: R
    C:
      0: {write: 1, L: B}
      1: {R: halt}
    halt:
`;

examples.busyBeaver3alt =
`name: 3-state busy beaver (alternate)
source code: |
  blank: 0
  start state: A
  table:
    A:
      0: {write: 1, R: B}
      1: {R: halt}
    B:
      0: {R: C}
      1: R
    C:
      0: {write: 1, L}
      1: {L: A}
    halt:
`;

examples.busyBeaver4 =
`name: 4-state busy beaver
source code: |
  blank: 0
  start state: A
  table:
    A: {0: {write: 1, R: B}, 1:           {L: B}}
    B: {0: {write: 1, L: A}, 1: {write: 0, L: C}}
    C: {0: {write: 1, R: H}, 1:           {L: D}}
    D: {0: {write: 1, R   }, 1: {write: 0, R: A}}
    H:
`;

examples.repeat01 =
`name: repeat 0 1
source code: |
  blank: ' '
  start state: b
  table:
    b:
      ' ': {write: 0, R: c}
    c:
      ' ':           {R: e}
    e:
      ' ': {write: 1, R: f}
    f:
      ' ':           {R: b}
`;

examples.copy1s =
`name: copy 1s
source code: |
  # Copies a string of 1s.
  input: '111'
  blank: 0
  start state: erase
  table:
    # mark the current 1 by erasing it
    erase:
      0: {R: H}
      1: {write: 0, R: midR}
    # skip to the middle separator
    midR:
      0: {R: mark}
      1: R
    # skip to the end and write a 1
    mark:
      0: {write: 1, L: midL}
      1: R
    # return to the middle
    midL:
      0: {L: restore}
      1: L
    # return to the erased 1, restore it, and then advance to the next 1
    restore:
      0: {write: 1, R: erase}
      1: L
    H:
`;

examples.binaryIncrement =
`name: binary increment
source code: |
  # Adds 1 to a binary number.
  input: '1011'
  blank: ' '
  start state: right
  table:
    # scan to the rightmost digit
    right:
      [1,0]: R
      ' '  : {L: carry}
    # then carry the 1
    carry:
      1      : {write: 0, L}
      [0,' ']: {write: 1, R: done}
    done:
`;

examples.divBy3 =
`name: divisible by 3
source code: |
  # Checks if a binary number is divisible by 3.
  input: '1001' # try '1111' (15), '10100' (20), '111001' (57)
  blank: ' '
  # The idea is to keep a running total of the remainder.
  #
  # Each time a digit is read, multiply the current total by 2
  # and then add the new digit.
  # This keeps the total up to date with the number left of the tape head.
  # Eventually the tape head reaches the end and we have the remainder
  # for the whole number.
  start state: q0
  table:
    q0:
      0: R       # 2*0 + 0 = 0
      1: {R: q1} # 2*0 + 1 = 1
      ' ': {R: accept}
    q1:
      0: {R: q2} # 2*1 + 0 = 2
      1: {R: q0} # 2*1 + 1 = 3
    q2:
      0: {R: q1} # 2*2 + 0 = 4
      1: {R: q2} # 2*2 + 1 = 5
    accept:
positions:
  q0: {x: 262.98, y: 243.17, fixed: 1}
  q1: {x: 430.41, y: 247.2, fixed: 1}
  q2: {x: 599.95, y: 246.41, fixed: 1}
  accept: {x: 263.31, y: 387.7, fixed: 1}
`;

examples.binaryAddition =
`name: binary addition
source code: |
  # Adds two binary numbers together.
  input: '1101 11011'
  blank: ' '
  start state: start
  table:
    # scan to the rightmost digit of the second number
    start:
      ' ': {R: last}
      [0,1,O,I]: R
    last:
      ' ': {L: take}
      [0,1,O,I]: R
    # read the rightmost digit and erase it
    take:
      0: {write: ' ', L: have0}
      1: {write: ' ', L: have1}
      ' ': {L: rewrite}
    # return to the first number
    have0:
      ' ': {L: add0}
      [0,1]: L
    have1:
      ' ': {L: add1}
      [0,1]: L
    # add the digit to the next position,
    # marking it (using O or I) as already added
    add0:
      [0,' ']: {write: O, R: start}
      1      : {write: I, R: start}
      [O,I]  : L
    add1:
      [0,' ']: {write: I, R: start}
      1      : {write: O, L: carry}
      [O,I]  : L
    # carry the 1 as needed
    carry:
      [0,' ']: {write: 1, R: start}
      1      : {write: 0, L}
    # rewrite place markers back to 0s and 1s
    rewrite:
      O: {write: 0, L}
      I: {write: 1, L}
      [0,1]: L
      ' ': {R: done}
    done:
positions:
  start: {x: 64.59, y: 210.59, fixed: 1}
  last: {x: 240.81, y: 209.16, fixed: 1}
  take: {x: 442.52, y: 209.19, fixed: 1}
  have0: {x: 442.43, y: 83.53, fixed: 1}
  have1: {x: 444.21, y: 341.95, fixed: 1}
  add0: {x: 241.27, y: 83.34, fixed: 1}
  add1: {x: 239.92, y: 343.38, fixed: 1}
  carry: {x: 61.16, y: 343.53, fixed: 1}
  rewrite: {x: 541.23, y: 208.39, fixed: 1}
  done: {x: 681.48, y: 208.79, fixed: 1}
`;

var blankTemplate =
`input: '\${2}'
blank: '\${3: }'
start state: \${4:start}
table:
  \${4}:
    \${5}
`;


// parse each string into a document
examples = lodash.mapValues(examples, function (string, key) {
  return lodash.assign(parseDocument(string), {id: key});
});
Object.freeze(examples);

function isExampleID(docID) {
  return {}.hasOwnProperty.call(examples, docID);
}

function get(docID) {
  return isExampleID(docID) ? examples[docID] : null;
}

var list = Object.keys(examples).map(function (key) { return examples[key]; });


exports.hasID = isExampleID;
exports.get = get;
exports.list = list;
exports.blankTemplate = blankTemplate;
