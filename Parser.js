var TM = require('./TuringMachine'),
    jsyaml = require('js-yaml'),
    _ = require('underscore'); // lodash-fp's .mapValues doesn't pass the key

/**
 * Thrown for a semantic (non-syntactic) problem with a machine specification.
 *
 * Examples: no start state defined, or transitioning to an undeclared state.
 * @param message  the error message
 */
function TMSpecError(message) {
  this.name = 'TMSpecError';
  this.message = message;
  this.stack = (new Error()).stack;
}
TMSpecError.prototype = Object.create(Error.prototype);
TMSpecError.prototype.constructor = TMSpecError;

// type TransitionTable = {[key: string]: {[key: string]: string} }
// type TMSpec = {blank: string, input: ?string,
  // startState: string, table: TransitionTable}

// throws YAMLException on syntax error
// throws TMSpecError for an invalid spec (eg. no start state, transitioning to an undefined state)
// string -> TMSpec
function parseSpec(str) {
  // FIXME: check all types and pre-conditions
  var obj = jsyaml.safeLoad(str);
  // check for required object properties
  if (!obj) { throw new TMSpecError('empty string'); }
  [ [obj.blank, 'no blank symbol specified'],
    [obj.startState, 'no start state specified'],
    [obj.table, 'missing transition table']
  ].forEach(function (d) {
    if (!d[0]) { throw new TMSpecError(d[1]); }
  });
  // parse each transition
  obj.table = _(obj.table).mapObject(function(stateObj, state) {
    return _(stateObj).mapObject(function(actionStr, symbol) {
      try {
        return parseAction(actionStr);
      } catch (e) {
        if (e instanceof TMSpecError) {
          e.message = 'for state ' + state +
            ' and symbol ' + symbol + ': ' + e.message;
        }
        throw e;
      }
    });
  });
  // check for transitions to non-existent states
  checkTargetStates(obj.table);

  return obj;
}

function parseDirection(s) {
  switch (s) {
    case 'L': return TM.MoveHead.left;
    case 'R': return TM.MoveHead.right;
    default: throw new TMSpecError('invalid movement direction: ' + s);
  }
}

// Note: symbol parsing is simplified by taking one character verbatim.
// That is, "write   R q2" instead of "write ' ' R q2".
// This precludes issues with escaping quotes, but breaks on extra whitespace:
// FIXME: very brittle with whitespace. eg. chokes on "skip   R"
// string -> TMAction
function parseAction(str) {
  var words = str.split(' ');
  var action = words[0];
  // FIXME: check for missing word parts (i.e. out of bounds)
  switch (action) {
    case 'write':
      if (words[1] === '') {
        // special case: symbol is space ' '
        return TM.write(' ', parseDirection(words[3]), words.slice(4).join(' '));
      } else {
        // regular case
        return TM.write(words[1], parseDirection(words[2]), words.slice(3).join(' '));
      }
      break; // placate eslint
    case 'move':
      return TM.move(parseDirection(words[1]), words.slice(2).join(' '));
    case 'skip':
      if (words.length > 2) {
        throw new TMSpecError('skip takes one argument (the direction)');
      }
      return TM.skip(parseDirection(words[1]));
    default:
    // TODO: lookup in synonyms
      throw new TMSpecError('unrecognized verb for transition: ' + str);
  }
}

// throws if any transition goes to a non-existent (undeclared) state
function checkTargetStates(table) {
  _(table).forEach(function(stateObj, state) {
    _(stateObj).forEach(function(action, symbol) {
      if (action.state != null && !(action.state in table)) {
        throw new TMSpecError('the transition for state ' + state +
        ' and symbol ' + symbol +
        ' goes to a state that has not been declared: ' + action.state);
      }
    });
  });
}

exports.parseSpec = parseSpec;
