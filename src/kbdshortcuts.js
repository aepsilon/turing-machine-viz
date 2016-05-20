'use strict';
/**
 * Displays a table of keyboard shortcuts.
 */

var d3 = require('d3');

function identity(x) { return x; }

/**
 * Renders a table, using three layers of list nesting: tbody, tr, td.
 * @param  {[ [[HTML]] ]}     data
 * @param  {HTMLTableElement} table
 * @return {D3Selection}            D3 selection of the <tbody> elements
 */
function renderTable(data, table) {
  var tbody = d3.select(table).selectAll('tbody')
      .data(data)
    .enter().append('tbody');

  var tr = tbody.selectAll('tr')
      .data(identity)
    .enter().append('tr');

  tr.selectAll('td')
      .data(identity)
    .enter().append('td')
      .html(identity);

  return tbody;
}


// type Key = string;
// type KeyList = [Key];

// Key -> Key
function abbreviateKey(key) {
  switch (key) {
    case 'Command': return 'Cmd';
    case 'Option':  return 'Opt';
    case 'Up':      return '↑';
    case 'Down':    return '↓';
    case 'Left':    return '←';
    case 'Right':   return '→';
    default:        return key;
  }
}

// KeyList -> HTML
function keylistToHTML(keys) {
  return keys.map(function (key) {
    return '<kbd>' + key + '</kbd>';
  }).join('-');
}

// Commands -> String -> KeyList
function createGetKeylist(commands) {
  var platform = commands.platform;
  // workaround: some ace keybindings for Mac use Alt instead of Option
  var altToOption = platform !== 'mac' ? identity : function (key) {
    return (key === 'Alt') ? 'Option' : key;
  };

  return function getKeylist(name) {
    return commands.commands[name].bindKey[platform].split('-').map(altToOption);
  };
}


// Fills a <table> with some default keyboard shortcuts.
function main(commands, table) {
  var getKeylist = createGetKeylist(commands);

  return renderTable(entries.map(function (group) {
    return group.map(function (d) {
      return [
        keylistToHTML(getKeylist(d.name).map(abbreviateKey)),
        d.desc
      ];
    });
  }), table);
}

var entries = [
  [
    { name: 'save', desc: 'Load machine<br> <small>Save changes and load the machine.</small>' }
  ], [
    { name: 'togglecomment', desc: 'Toggle comment' },
    { name: 'indent', desc: 'Indent selection' },
    { name: 'outdent', desc: 'Unindent selection' }
  ], [
    { name: 'movelinesup', desc: 'Move line up' },
    { name: 'movelinesdown', desc: 'Move line down' },
    { name: 'duplicateSelection', desc: 'Duplicate line/selection' }
  ], [
    { name: 'selectMoreAfter', desc: 'Add next occurrence to selection<br> <small>Like a quick “find”. Useful for renaming things.</small>' },
    { name: 'find', desc: 'Find' },
    { name: 'replace', desc: 'Find and Replace' }
  ]
];


exports.main = main;
