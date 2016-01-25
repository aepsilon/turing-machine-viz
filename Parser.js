var TM = require('./TuringMachine'),
    jsyaml = require('js-yaml'),
    _ = require('underscore'); // lodash-fp's .mapValues doesn't pass the key

/**
 * Thrown when parsing a string that is valid as YAML but invalid
 * as a machine specification.
 *
 * Examples: unrecognized synonym, no start state defined,
 * transitioning to an undeclared state.
 *
 * A readable message is generated based on the details (if any) provided.
 * @param {string} header  The error message, used as a header.
 * @param {?Object} details Optional details. Possible keys:
 *                          state, key, synonym, info, problemString, suggestion
 */
function TMSpecError(header, details) {
  this.name = 'TMSpecError';
  this.stack = (new Error()).stack;

  this.header = header;
  this.details = details || {};
}
TMSpecError.prototype = Object.create(Error.prototype);
TMSpecError.prototype.constructor = TMSpecError;

Object.defineProperty(TMSpecError.prototype, 'message', {
  get: function () {
    var header = this.header;
    var details = this.details;

    function code(str) { return '<code>' + str + '</code>'; }
    function showLoc(state, symbol, synonym) {
      if (state != null) {
        if (symbol != null) {
          return ' in the transition from state ' + code(state) + ' and symbol ' + code(symbol);
        } else {
          return ' for state ' + code(state);
        }
      } else if (synonym != null) {
        return ' in the synonym ' + code(synonym);
      }
      return '';
    }
    function formatProblemString(str) {
      return (str != null && ('Problem string: ' + code(str))) || null;
    }
    return ['<strong>' + header + '</strong>' + showLoc(details.state, details.symbol, details.synonym),
      details.info, formatProblemString(details.problemString), details.suggestion]
      .filter(function (x) { return x != null; })
      .join('. ') + '.';
  },
  enumerable: true
});

// type TransitionTable = {[key: string]: ?{[key: string]: string} }
// type TMSpec = {blank: string, input: ?string,
  // startState: string, table: TransitionTable}

// TODO: check with flow (flowtype.org)
// throws YAMLException on YAML syntax error
// throws TMSpecError for an invalid spec (eg. no start state, transitioning to an undefined state)
// string -> TMSpec
function parseSpec(str) {
  var obj = jsyaml.safeLoad(str);
  // check for required object properties.
  // auto-convert .blank and 'start state' to string, for convenience.
  if (obj == null) { throw new TMSpecError('The document is empty'); }
  if (obj.blank == null) {
    throw new TMSpecError('No blank symbol specified',
      {suggestion: 'Use <code>blank: </code> to specify one'});
  }
  obj.blank = String(obj.blank);
  if (obj.blank.length !== 1) {
    throw new TMSpecError('The blank symbol must be a string of length 1',
    {suggestion: 'Examples: <code>blank: \'0\'</code> or <code>blank: \' \'</code>'});
  }
  obj.startState = obj['start state'];
  delete obj['start state'];
  if (obj.startState == null) {
    throw new TMSpecError('No start state was specified',
    {suggestion: 'Assign one using <code>start state: </code>'});
  }
  obj.startState = String(obj.startState);
  // parse synonyms and transition table
  var synonyms = parseSynonyms(obj.synonyms, obj.table);
  obj.table = parseTable(synonyms, obj.table);
  // check for references to non-existent states
  if (!(obj.startState in obj.table)) {
    throw new TMSpecError('The start state has to be declared in the transition table');
  }

  return obj;
}

// any -> ?SynonymMap
function parseSynonyms(val, table) {
  if (val == null) {
    return null;
  }
  if (typeof val !== 'object') {
    // TODO
    throw new TMSpecError('Malformed synonyms value',
      {info: 'Expected a mapping (object) for synonyms but got: ' + typeof val});
  }
  return _(val).mapObject(function (actionVal, key) {
    try {
      return parseInstruction(null, table, actionVal);
    } catch (e) {
      if (e instanceof TMSpecError) {
        e.details.synonym = key;
      }
      throw e;
    }
  });
}

// (?SynonymMap, {[key: string]: string}) -> TransitionTable
function parseTable(synonyms, val) {
  if (val == null) {
    throw new TMSpecError('Missing transition table',
    {suggestion: 'Specify one using <code>table:</code>'});
  }
  if (typeof val !== 'object') {
    throw new TMSpecError('Invalid transition table',
    {info: 'Expected a mapping (object) for table but got: ' +
      typeof val});
  }
  return _(val).mapObject(function (stateObj, state) {
    if (stateObj == null) {
      // case: halting state
      return null;
    }
    if (typeof stateObj !== 'object') {
      // TODO: figure out how to combine header with inline <strong>
      throw new TMSpecError('Malformed state transitions',
      {state: state, info: 'Expected <code>null</code> or a mapping (object), but got '
      + typeof stateObj});
    }
    return _(stateObj).mapObject(function (actionVal, symbol) {
      try {
        return parseInstruction(synonyms, val, actionVal);
      } catch (e) {
        if (e instanceof TMSpecError) {
          e.details.state = state;
          e.details.symbol = symbol;
        }
        throw e;
      }
    });
  });
}

// omits null/undefined properties
// (?string, direction, ?string) -> {symbol?: string, move: direction, state?: string}
function makeInstruction(symbol, move, state) {
  return Object.freeze(_.omit({symbol: symbol, move: move, state: state},
    function (x) { return x == null; }));
}

function checkTarget(table, action) {
  if (action.state != null && !(action.state in table)) {
    throw new TMSpecError('Undeclared state <code>' + action.state + '</code>');
  }
  return action;
}

// throws if the target state is undeclared (not in the table)
// type SynonymMap = {[key: string]: TMAction}
// (SynonymMap?, Object, string | Object) -> TMAction
function parseInstruction(synonyms, table, val) {
  return checkTarget(table, function () {
    switch (typeof val) {
      case 'string': return parseInstructionString(synonyms, val);
      case 'object': return parseInstructionObject(val);
      default: throw new TMSpecError('Malformed instruction',
        {info: 'Expected a string or an object but got type ' + typeof val});
    }
  }());
}

var leftAction = Object.freeze({move: TM.MoveHead.left});
var rightAction = Object.freeze({move: TM.MoveHead.right});

// case: direction or synonym
function parseInstructionString(synonyms, val) {
  if (val === 'L') {
    return leftAction;
  } else if (val === 'R') {
    return rightAction;
  }
  // note: this order prevents overriding L/R in synonyms, as that would
  // allow inconsistent notation, e.g. 'R' and {R: ..} being different.
  if (synonyms && synonyms[val]) { return synonyms[val]; }
  throw new TMSpecError('Unrecognized instruction or synonym',
    {problemString: val});
}

// type ActionObj = {write?: any, L: ?string} | {write?: any, R: ?string}
// case: ActionObj
function parseInstructionObject(val) {
  var symbol, move, state;
  // one L/R key is required, with optional state value
  if ('L' in val && 'R' in val) {
    throw new TMSpecError('Invalid instruction',
    {info: 'Each instruction needs exactly one direction, but two were found'});
  }
  if ('L' in val) {
    move = TM.MoveHead.left;
    state = val.L;
  } else if ('R' in val) {
    move = TM.MoveHead.right;
    state = val.R;
  } else {
    throw new TMSpecError('Missing movement direction');
  }
  // write key is optional, but must contain a char value if present
  if ('write' in val) {
    var writeStr = String(val.write);
    if (writeStr.length === 1) {
      symbol = writeStr;
    } else {
      throw new TMSpecError('The write value has to be a string of length 1');
    }
  }
  return makeInstruction(symbol, move, state);
}

exports.TMSpecError = TMSpecError;
exports.parseSpec = parseSpec;
// re-exports
exports.YAMLException = jsyaml.YAMLException;
