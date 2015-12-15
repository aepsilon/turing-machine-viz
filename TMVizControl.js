// note: loadMachine interacts with an Ace editor

var TM = require('./TuringMachine.js'),
    TMViz = require('./TMViz.js'),
    Position = require('./Position.js'),
    watch = require('./watch.js'),
    Storage = require('./Storage.js'),
    d3 = require('d3');

// Contains & provides controls for a TMViz.
function TMVizControl(parentSelection, machineSpec) {
  Object.defineProperty(this, 'parentSelection', {
    value: parentSelection,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  if (machineSpec) {
    this.setMachine(machineSpec);
  }
}

TMVizControl.prototype.setMachine = function(machineSpec) {
  var divs = this.parentSelection
    .selectAll('div.machine')
    // TODO: key by an ID guaranteed to be unique
      .data([machineSpec], function(d) { return d.name; });

  divs.exit().remove();

  divs.enter()
    .append('div')
      .attr('class', 'machine')
      .each(function(d) {
        var div = d3.select(this);
        div.append('h3')
            .text(function(d) { return d.name; });
        
        var machine = (function() {
          var diagrams = div.append('div').attr('class', 'machine-diagrams');
          return new TMViz.TMViz(diagrams, d);
        })();

        // each step click corresponds to 1 machine step.
        var stepButton = div.append('button')
            .text('Step')
            .attr('class', 'run-step');
        stepButton.node()
            .addEventListener('click', function() {
              machine.isRunning = false;
              machine.step();
            });

        div.append('button')
            .text('Run')
            .attr('class', 'run-step')
          .call(function(sel) {
            sel.node().addEventListener('click', function() {
              machine.isRunning = !machine.isRunning;
            });
            watch(machine, 'isRunning', function(prop, oldval, isRunning) {
              sel.text(isRunning ? 'Pause' : 'Run');
              return isRunning;
            });
            watch(machine, 'isHalted', function(prop, oldval, isHalted) {
              sel.node().disabled = isHalted;
              stepButton.node().disabled = isHalted;
              return isHalted;
            });
          });

        div.append('button')
            .text('Reset')
            .attr('class', 'run-step')
            .style('float', 'right')
          .node()
            .addEventListener('click', function() { machine.reset(); });

        div.selectAll('button.btn-positioning')
            .data([
              {label: 'Save positions', onClick: function() {
                Storage.saveNodePositions(machineSpec.name, machine.stateMap);
              }},
              {label: 'Load positions', onClick: function() {
                var positions = Storage.loadPositions(machineSpec.name);
                if (positions) {
                  Position.arrangeNodes(positions, machine.stateMap);
                }
            }}])
          .enter().append('button')
            .attr('class', 'run-step btn-positioning')
            .style('float', 'right')
            .text(function(d) { return d.label; })
            .each(function(d) {
              this.addEventListener('click', d.onClick);
            })
      });
}

function loadMachine(tmviz, editor, machineSpecString, isFromEditor) {
  var dirConvention = 'var L = MoveHead.left;\nvar R = MoveHead.right;\n';
  // TODO: limit permissions? place inside iframe sandbox and run w/ web worker
  var spec = (new Function('write', 'move', 'skip', 'MoveHead', 'MoveTape',
    // dirConvention + 'return ' + machineSpecString + ';'))
    dirConvention + machineSpecString))
    (TM.write, TM.move, TM.skip, TM.MoveHead, TM.MoveTape);
  tmviz.setMachine(spec);
  if (!isFromEditor) {
    editor.setValue(machineSpecString, -1 /* put cursor at beginning */);
  }
}

function editMachine() { console.error('editMachine: unimplemented'); }

exports.TMVizControl = TMVizControl;
exports.loadMachine = loadMachine;
