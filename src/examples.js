'use strict';

var parseDocument = require('./sharing/format').parseDocument;
var _ = require('lodash/fp');

/* eslint-env es6 */
// enable es6 for template literals, since per-file ecmaFeatures aren't available.
// https://github.com/eslint/eslint/issues/2950


var examplePairs = [

['repeat01',
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
`],

['binaryIncrement',
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
      [0,' ']: {write: 1, L: done}
    done:
positions:
  right: {x: 230, y: 250}
  carry: {x: 400, y: 250}
  done:  {x: 570, y: 250}
`],

['divBy3',
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
  q0: {x: 262.98, y: 243.17}
  q1: {x: 430.41, y: 247.2}
  q2: {x: 599.95, y: 246.41}
  accept: {x: 263.31, y: 387.7}
`],

// Busy beavers, repeat01, and copy1s are from
// https://en.wikipedia.org/wiki/Busy_beaver and
// https://en.wikipedia.org/wiki/Turing_machine_examples

['copy1s',
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
`],

['divBy3Base10',
`name: divisible by 3 (base 10)
source code: |
  # Checks if a base 10 number is divisible by 3.
  input: 4728 # try 42, 57, 1337, 5328, 7521, 314159265
  blank: ' '
  # This uses the same idea as the base 2 version.
  #
  # To make things more interesting, we derive the step relation:
  # Let x be the number left of the tape head,
  #     d the digit under the head, and
  #     x' the number up to and including the head.
  # Then
  #   x' = 10x + d .
  # Notice 10 ≡ 1 (mod 3). Therefore
  #   x' ≡ x + d (mod 3) .
  # Each step simply adds the new digit's remainder mod 3.
  start state: q0
  table:
    q0:
      [0,3,6,9]: R
      [1,4,7]: {R: q1}
      [2,5,8]: {R: q2}
      ' ': {R: accept}
    q1:
      [0,3,6,9]: R
      [1,4,7]: {R: q2}
      [2,5,8]: {R: q0}
    q2:
      [0,3,6,9]: R
      [1,4,7]: {R: q0}
      [2,5,8]: {R: q1}
    accept:
`],

['matchThreeLengths',
`name: three equal lengths
source code: |
  # Decides the language { aⁿbⁿcⁿ | n ≥ 0 }, that is,
  # accepts a's followed by b's then c's of the same length.
  input: aabbcc # try bac, aabc, aabcc, aabcbc
  blank: ' '
  # On each pass, cross off the first a, b, and c.
  # All a's must precede all b's, which must precede all c's.
  # When there are no more a's,
  # all input symbols should have been crossed off.
  start state: A
  table:
    A:
      a: {write: ., R: B}
      .: R
      ' ': {R: accept}
    B:
      [a,.]: R
      b: {write: ., R: C}
    C:
      [b,.]: R
      c: {write: ., R: Cs}
    Cs:
      c: R
      ' ': {L: back}
    back:
      [b,c,.]: L
      ' ': {R: A}
      a: {L: A}
    accept:
`],

['matchBinaryEqual',
`name: equal strings
source code: |
  # Decides the language { w#w | w ∈ {0,1}* }
  # (two equal binary strings separated by '#')
  input: '01001#01001' # try '#', '1#10', '10#1', '10#10'
  blank: ' '
  # Two strings are equal if they are both the empty string,
  # or they start with the same symbol and are equal thereafter.
  start state: start
  table:
    start:
      # inductive case: start with the same symbol
      0: {write: ' ', R: have0}
      1: {write: ' ', R: have1}
      # base case: empty string
      '#': {R: check}
    have0:
      [0,1]: R
      '#': {R: match0}
    have1:
      [0,1]: R
      '#': {R: match1}
    match0:
      x: R
      0: {write: x, L: back}
    match1:
      x: R
      1: {write: x, L: back}
    back:
      [0,1,'#',x]: L
      ' ': {R: start}
    check:
      x: R
      ' ': {R: accept}
    accept:
positions:
  start: {x: 308.89, y: 220.03}
  have0: {x: 359.42, y: 350.96}
  have1: {x: 357.51, y: 96.03}
  match0: {x: 494.75, y: 352.18}
  match1: {x: 498.7, y: 97.9}
  back: {x: 554.93, y: 222.53}
  check: {x: 192.08, y: 219.39}
  accept: {x: 85.47, y: 220.29}
`],

['palindrome',
`name: palindrome
source code: |
  # Accepts palindromes made of the symbols 'a' and 'b'
  input: 'abba' # try a, ab, bb, babab
  blank: ' '
  start state: start
  synonyms:
    accept: {R: accept}
    reject: {R: reject}
  # A palindrome is either the empty string, a single symbol,
  # or a (shorter) palindrome with the same symbol added to both ends.
  table:
    start:
      ' ': accept # empty string
      a: {write: ' ', R: haveA}
      b: {write: ' ', R: haveB}
    haveA:
      [a,b]: R
      ' ': {L: matchA}
    haveB:
      [a,b]: R
      ' ': {L: matchB}
    matchA:
      a: {write: ' ', L: back} # same symbol at both ends
      b: reject
      ' ': accept # single symbol
    matchB:
      a: reject
      b: {write: ' ', L: back} # same symbol at both ends
      ' ': accept # single symbol
    back:
      [a,b]: L
      ' ': {R: start}
    accept:
    reject:
positions:
  start: {x: 430.54, y: 190.9}
  haveA: {x: 280.7, y: 187.23}
  haveB: {x: 595.17, y: 190.24}
  matchA: {x: 280.71, y: 320.65}
  matchB: {x: 595.22, y: 325.48}
  back: {x: 428.18, y: 320.07}
  accept: {x: 432.35, y: 62.52}
  reject: {x: 427.41, y: 450.69}
`],

['busyBeaver3',
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
`],

['busyBeaver3alt',
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
`],

['busyBeaver4',
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
`],

['powersOfTwo',
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
`],

['binaryAddition',
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
  start: {x: 64.59, y: 210.59}
  last: {x: 240.81, y: 209.16}
  take: {x: 442.52, y: 209.19}
  have0: {x: 442.43, y: 83.53}
  have1: {x: 444.21, y: 341.95}
  add0: {x: 241.27, y: 83.34}
  add1: {x: 239.92, y: 343.38}
  carry: {x: 61.16, y: 343.53}
  rewrite: {x: 541.23, y: 208.39}
  done: {x: 681.48, y: 208.79}
`],

['lengthMult',
`name: multiplied lengths
source code: |
  # Decides the language { a^(i)b^(j)c^(k) | i*j = k and i,j,k ≥ 0 }.
  # (a's followed by b's then c's, where
  # the number of a's multiplied by the number of b's
  # equals the number of c's.)
  input: aabbbcccccc # try ab, abc, bbb, aabbbbcccccccc
  blank: ' '
  start state: eachA
  synonyms:
    accept: {R: accept}
  # The approach is two nested loops:
  # For each 'a':
  #   For each 'b':
  #     Cross off a 'c'
  # At the end, check that all c's are crossed off.
  table:
    eachA:
      # For each 'a' erased, cross off j of the 'c' symbols.
      a: {write: ' ', R: eachB}
      b: {R: scan}
      ' ': accept
    eachB:
      a: R
      b: {write: B, R: markC}
      ' ': accept
      x: {L: nextA}
    markC:
      [b,x]: R
      c: {write: x, L: nextB}
    nextB:
      [b,x]: L
      B: {R: eachB}
    nextA:
      ' ': {R: eachA}
      [a,x]: L
      B: {write: b, L}
    # Once all the 'a's are erased,
    # all 'c' symbols should be crossed off.
    scan:
      [b,x]: R
      ' ': accept
    accept:
positions:
  eachA: {x: 378.63, y: 125.55}
  eachB: {x: 379.99, y: 278.79}
  markC: {x: 381.14, y: 417.07}
  nextB: {x: 546.07, y: 417.78}
  nextA: {x: 549.2, y: 279.15}
  scan: {x: 234.16, y: 123.89}
  accept: {x: 235.66, y: 211.49}
`],

['unaryMult',
`name: unary multiplication
source code: |
  # Multiplies together two unary numbers separated by a '*'.
  # (Unary is like tallying. Here '||*|||' means 2 times 3.)
  input: '||*|||' # try '*', '|*|||', '||||*||'
  blank: ' '

  # The idea:
  #   multiply(0, b) = 0
  #   multiply(a, b) = b + multiply(a-1, b)   when a > 0
  start state: eachA
  table:
    # Erase one symbol from the first number.
    eachA:
      '|': {write: ' ', R: sep}  # Inductive case: a > 0.
      '*': {write: ' ', R: tidy} # Base case:      a = 0.
    sep:
      '|': R
      '*': {R: eachB}
    # For each symbol erased from the first number,
    # add the second number to the result
    # by marking and copying each symbol.
    eachB:
      '|': {write: x, R: skip}
      ' ': {L: sepL}
    skip:
      '|': R
      ' ': {R: inc}
    inc:
      '|': R
      ' ': {write: '|', L: skipL}
    skipL:
      '|': L
      ' ': {L: nextB}
    nextB:
      '|': L
      x: {R: eachB}
    # Restore the marked symbols.
    sepL:
      x: {write: '|', L}
      '*': {L: nextA}
    nextA:
      '|': L
      ' ': {R: eachA}
    # Clean up: erase the input.
    tidy:
      '|': {write: ' ', R}
      ' ': {R: done}
    done:
positions:
  eachA: {x: 380.7, y: 42.6}
  sep: {x: 381.6, y: 153.73}
  eachB: {x: 382.07, y: 258.05}
  skip: {x: 383.26, y: 369.35}
  inc: {x: 384.79, y: 473.78}
  skipL: {x: 521.41, y: 443.54}
  nextB: {x: 520.59, y: 309.48}
  sepL: {x: 519.84, y: 201.11}
  nextA: {x: 521.2, y: 91.47}
  tidy: {x: 247.21, y: 91.68}
  done: {x: 248.23, y: 202.94}
`]

].map(function (pair) {
  // parse each string into a document
  var id = pair[0];
  var doc = parseDocument(pair[1]);

  doc.id = id;
  return [id, doc];
});

var blankTemplate =
`input: '\${2}'
blank: '\${3: }'
start state: \${4:start}
table:
  \${4}:
    \${5}
`;


var examples = Object.freeze(_.fromPairs(examplePairs));

function isExampleID(docID) {
  return {}.hasOwnProperty.call(examples, docID);
}

function get(docID) {
  return isExampleID(docID) ? examples[docID] : null;
}

var list = examplePairs.map(function (pair) { return pair[1]; });


exports.hasID = isExampleID;
exports.get = get;
exports.list = list;
exports.blankTemplate = blankTemplate;
