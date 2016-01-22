var TM = require('./TuringMachine'),
    jsyaml = require('js-yaml'),
    _ = require('underscore'); // lodash-fp's .mapValues doesn't pass the key

/**
 * Thrown when parsing a string that is valid as YAML but invalid
 * as a machine specification.
 *
 * Examples: unrecognized synonym, no start state defined,
 * transitioning to an undeclared state.
 * @param message  the error message
 */
function TMSpecError(message) {
  this.name = 'TMSpecError';
  this.message = message;
  this.stack = (new Error()).stack;
}
TMSpecError.prototype = Object.create(Error.prototype);
TMSpecError.prototype.constructor = TMSpecError;

// type TransitionTable = {[key: string]: ?{[key: string]: string} }
// type TMSpec = {blank: string, input: ?string,
  // startState: string, table: TransitionTable}

// TODO: check with flow type-checker
// throws YAMLException on YAML syntax error
// throws TMSpecError for an invalid spec (eg. no start state, transitioning to an undefined state)
// string -> TMSpec
function parseSpec(str) {
  var obj = jsyaml.safeLoad(str);
  // check for required object properties.
  // auto-convert .blank and 'start state' to string, for convenience.
  if (obj == null) { throw new TMSpecError('the document is empty'); }
  if (obj.blank == null) {
    throw new TMSpecError('no blank symbol specified');
  }
  obj.blank = String(obj.blank);
  if (obj.blank.length !== 1) {
    throw new TMSpecError('the blank symbol must be a string of length 1');
  }
  obj.startState = obj['start state'];
  delete obj['start state'];
  if (obj.startState == null) {
    throw new TMSpecError('no start state specified');
  }
  obj.startState = String(obj.startState);
  // parse synonyms and transition table
  var synonyms = parseSynonyms(obj.synonyms);
  obj.table = parseTable(synonyms, obj.table);
  // check for references to non-existent states
  if (!(obj.startState in obj.table)) {
    throw new TMSpecError('the start state needs to be declared in the transition table');
  }
  checkTargetStates(obj.table);

  return obj;
}

// any -> ?SynonymMap
function parseSynonyms(val) {
  if (val == null) {
    return null;
  }
  if (typeof val !== 'object') {
    throw new TMSpecError('expected a mapping (object) for synonyms but got: ' +
      typeof val);
  }
  return _(val).mapObject(function (actionVal, key) {
    try {
      return parseAction(null, actionVal);
    } catch (e) {
      if (e instanceof TMSpecError) {
        e.message = 'for synonym \'' + key + '\': ' + e.message;
      }
      throw e;
    }
  });
}

// (?SynonymMap, any) -> TransitionTable
function parseTable(synonyms, val) {
  if (val == null) {
    throw new TMSpecError('missing transition table');
  }
  if (typeof val !== 'object') {
    throw new TMSpecError('expected a mapping (object) for table but got: ' +
      typeof val);
  }
  return _(val).mapObject(function (stateObj, state) {
    if (stateObj == null) {
      // case: halting state
      return null;
    }
    if (typeof stateObj !== 'object') {
      throw new TMSpecError('expected null or a mapping (object) for the transitions from state: ' + state);
    }
    return _(stateObj).mapObject(function (actionVal, symbol) {
      try {
        return parseAction(synonyms, actionVal);
      } catch (e) {
        if (e instanceof TMSpecError) {
          e.message = 'for state ' + state +
            ' and symbol ' + symbol + ': ' + e.message;
        }
        throw e;
      }
    });
  });
}

// omits null/undefined properties
// (?string, direction, ?string) -> {symbol?: string, move: direction, state?: string}
function constructAction(symbol, move, state) {
  return Object.freeze(_.omit({symbol: symbol, move: move, state: state},
    function (x) { return x == null; }));
}

var leftAction = Object.freeze({move: TM.MoveHead.left});
var rightAction = Object.freeze({move: TM.MoveHead.right});

// type SynonymMap = {[key: string]: TMAction}
// (SynonymMap?, string | Object) -> TMAction
function parseAction(synonyms, val) {
  switch (typeof val) {
    case 'string': return parseActionString(synonyms, val);
    case 'object': return parseActionObject(val);
  }
  throw new TMSpecError('expected a string or an object but got: ' + typeof val);
}

// case: direction or synonym
function parseActionString(synonyms, val) {
  if (val === 'L') {
    return leftAction;
  } else if (val === 'R') {
    return rightAction;
  }
  // note: this order prevents overriding L/R in synonyms, as that would
  // allow inconsistent notation, e.g. 'R' and {R: ..} being different.
  if (synonyms && synonyms[val]) { return synonyms[val]; }
  throw new TMSpecError('found a string but could not parse it ' +
    'as a direction or synonym: ' + val);
}

// type ActionObj = {write?: any, L: ?string} | {write?: any, R: ?string}
// case: ActionObj
function parseActionObject(val) {
  var symbol, move, state;
  // one L/R key is required, with optional state value
  if ('L' in val && 'R' in val) {
    throw new TMSpecError('expected one movement direction but found two');
  }
  if ('L' in val) {
    move = TM.MoveHead.left;
    state = val.L;
  } else if ('R' in val) {
    move = TM.MoveHead.right;
    state = val.R;
  } else {
    throw new TMSpecError('did not specify a movement direction');
  }
  // write key is optional, but must contain a char value if present
  if ('write' in val) {
    var writeStr = String(val.write);
    if (writeStr.length === 1) {
      symbol = writeStr;
    } else {
      throw new TMSpecError('the write key requires a string of length 1');
    }
  }
  return constructAction(symbol, move, state);
}

// throws if any transition goes to a non-existent (undeclared) state
function checkTargetStates(table) {
  _(table).forEach(function (stateObj, state) {
    _(stateObj).forEach(function (action, symbol) {
      if (action.state != null && !(action.state in table)) {
        throw new TMSpecError('the transition for state ' + state +
        ' and symbol ' + symbol +
        ' goes to a state that has not been declared: ' + action.state);
      }
    });
  });
}

exports.parseSpec = parseSpec;
