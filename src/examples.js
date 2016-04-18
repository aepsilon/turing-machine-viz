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
