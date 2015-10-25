// requires Underscore.js

// var R = true;
// var L = false;
var R = 'R';
var L = 'L';

// 3 action primitives. 'write' is the most general.
function write(sym, dir, state) {
  return ['write', sym, dir, state];
}

function move(dir, state) {
  return ['move', dir, state];
}

function skip(dir) {
  return ['skip', dir];
}

// custom synonyms for actions
var accept = move(R, 'accept');
var reject = move(R, 'reject');

// demo data
var m2table =
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
    },
    'accept': null,
    'reject': null
  };

// replace ' ' with '␣'.
function visibleSpace(c) {
  return (c === ' ') ? '␣' : c;
}

// edge helpers

function targetStateFor(srcState, action) {
  switch (action[0]) {
    case 'write': return action[3];
    case 'move': return action[2];
    case 'skip': return srcState;
    default: throw new Error('unrecognized action: ' + action.toString());
  }
}

// TODO: allow custom function for showing spaces?
// FIXME: expand wildcard '_'
// TODO: enable specifying the wildcard character
function labelFor(symbol, action) {
  var rightSide;
  switch (action[0]) {
    case 'write': rightSide = visibleSpace(action[1]) + ',' + action[2]; break;
    // move only. symbol stays the same.
    case 'move': rightSide = action[1]; break;
    case 'skip': rightSide = action[1]; break;
    default: throw new Error('unrecognized action: ' + action.toString());
  }
  return visibleSpace(symbol) + '→' + rightSide;
}

// generate the nodes and edges for a D3 diagram
function deriveNodesLinks(obj) {
  var nodeMap = _.mapObject(obj, function(symboltable, state) {
    return { label: state,
             symboltable: symboltable
           };
  });
  var nodeArray = _.values(nodeMap);
  return {
    nodes: nodeArray,
    links:
      _.flatten(nodeArray.map(function(stateobj) {
        var state1 = stateobj.label;
        return _.pairs(stateobj.symboltable).map(function(pair) {
          var symbol = pair[0];
          var action = pair[1];
          return { source: nodeMap[state1],
                   target: nodeMap[targetStateFor(state1, action)],
                   label: labelFor(symbol, action)
                 };
        });
      }))
  };
}


