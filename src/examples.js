'use strict';

var parseDocument = require('./sharing/format').parseDocument;
var lodash = require('lodash'); // for 2-arg mapValues and mutable assign

/* eslint-env es6 */
// enable es6 for template literals, since per-file ecmaFeatures aren't available.
// https://github.com/eslint/eslint/issues/2950

// {[key: string]: string}
var examples = {};

// From "Introduction to the Theory of Computation" (3rd ed.) by Michael Sipser, pg. 172
examples.powersOfTwo =
`name: powers of two
source code: |
  # Matches strings of 0s whose length is a power of two
  input: '0000'
  blank: ' '
  start state: q1
  synonyms:
    accept: {R: accept}
    reject: {R: reject}
  table:
    q1:
      0: {write: ' ', R: q2}
      _: reject
    q2:
      0  : {write: x, R: q3}
      ' ': accept
      x  : R
    q3:
      0  : {R: q4}
      ' ': {L: q5}
      x  : R
    q4:
      0  : {write: x, R: q3}
      ' ': reject
      x  : R
    q5:
      ' ': {R: q2}
      _  : L
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
  input: '111'
  blank: 0
  start state: s1
  table:
    s1:
      0: {R: H}
      1: {write: 0, R: s2}
    s2:
      0: {R: s3}
      1: R
    s3:
      0: {write: 1, L: s4}
      1: R
    s4:
      0: {L: s5}
      1: L
    s5:
      0: {write: 1, R: s1}
      1: L
    H:
`;

examples.binaryIncrement =
`name: binary increment
source code: |
  input: '1011'
  blank: ' '
  start state: right
  table:
    right:
      1  : R
      0  : R
      ' ': {L: inc}
    inc:
      1  : {write: 0, L}
      0  : {write: 1, R: done}
      ' ': {write: 1, R: done}
    done:
`;

// TODO: add comments to explain states and inductive derivation
examples.divBy3 =
`name: divisible by 3
source code: |
  input: '110' # 6
  blank: ' '
  start state: q0
  table:
    q0:
      0: R
      1: {R: q1}
      ' ': {R: accept}
    q1:
      0: {R: q2}
      1: {R: q0}
    q2:
      0: {R: q1}
      1: {R: q2}
    accept:
positions:
  q0: {x: 262.98, y: 243.17, fixed: 1}
  q1: {x: 430.41, y: 247.2, fixed: 1}
  q2: {x: 599.95, y: 246.41, fixed: 1}
  accept: {x: 263.31, y: 387.7, fixed: 1}
`;

// FIXME: replace wildcard with multi-symbol matching
examples.binaryAddition =
`name: binary addition
source code: |2
   # input: '1 111' # 1 + 7 = 8 = 1000_2
  input: '101 11101' # 5 + 29 = 34 = 100010
  # input: '1 1000'
  blank: ' '
  start state: start
  table:
    start:
      ' ': {R: last}
      _: R
    last:
      ' ': {L: take}
      _: R
    take:
      0: {write: ' ', L: have0}
      1: {write: ' ', L: have1}
      ' ': {L: rewrite}
    have0:
      ' ': {L: add0}
      _: L
    have1:
      ' ': {L: add1}
      _: L
    add0:
      0: {write: O, R: start}
      1: {write: I, R: start}
      ' ': {write: O, R: start}
      _: L
    add1:
      0: {write: I, R: start}
      ' ': {write: I, R: start}
      1: {write: O, L: carry}
      _: L
    carry:
      1: {write: 0, L}
      _: {write: 1, R: start}
    rewrite:
      O: {write: 0, L}
      I: {write: 1, L}
      ' ': {R: done}
      _: L
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
