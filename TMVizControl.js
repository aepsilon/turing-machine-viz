var TM = require('./TuringMachine.js'),
    TMViz = require('./TMViz.js'),
    Position = require('./Position.js'),
    watch = require('./watch.js'),
    Storage = require('./Storage.js'),
    d3 = require('d3');

// TODO: prevent double-binding?
// (HTMLButtonElement, HTMLButtonElement, TMVizData) -> void
function bindStepRunButtons(stepButton, runButton, data) {
  function updateRunning(isRunning) {
    runButton.textContent = (isRunning ? 'Pause' : 'Run');
    return isRunning;
  }
  function updateHalted(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
    return isHalted;
  }
  updateRunning(data.machine.isRunning);
  updateHalted(data.machine.isHalted);
  watch(data.machine, 'isRunning', function(prop, oldval, isRunning) {
    return updateRunning(isRunning);
  });
  watch(data.machine, 'isHalted', function(prop, oldval, isHalted) {
    return updateHalted(isHalted);
  });
}

// add controls (buttons) for a TMViz
// div: the selection of the parent div of the .machine-diagram
function addControls(div) {
  // each step click corresponds to 1 machine step.
  var stepButton = div.append('button')
      .text('Step')
      .attr('class', 'btn-tmcontrol btn-step')
      .on('click', function(d) {
        d.machine.isRunning = false;
        d.machine.step();
      });

  var runButton = div.append('button')
      .text('Run')
      .attr('class', 'btn-tmcontrol btn-run')
      .on('click', function(d) {
        d.machine.isRunning = !d.machine.isRunning;
      });
  bindStepRunButtons(stepButton.node(), runButton.node(), div.datum());

  div.append('button')
      .text('Reset')
      .attr('class', 'btn-tmcontrol')
      .style('float', 'right')
      .property('type', 'reset') // ?
      .on('click', function(d) { d.machine.reset(); });

  // use a plain Array to ease setup, then propagate the actual data
  [{label: 'Save positions', onClick: function(d) {
    Storage.saveNodePositions(d.name, d.machine.stateMap);
  }},
  {label: 'Load positions', onClick: function(d) {
    var positions = Storage.loadPositions(d.name);
    if (positions) {
      Position.arrangeNodes(positions, d.machine.stateMap);
    }
  }}].map(function(obj) {
    div.append('button')
        .attr('class', 'btn-tmcontrol btn-positioning')
        .style('float', 'right')
        .text(obj.label)
        .on('click', function(d) {
          obj.onClick(d);
        });
  });
}

// (D3Selection, TMVizData) -> void
function rebindControls(buttons, data) {
  buttons.datum(data);
  bindStepRunButtons(buttons.filter('.btn-step').node(), buttons.filter('.btn-run').node(), data);
}

// Contains & provides controls for a TMViz.
function TMVizControl(parentSelection, machineSpec) {
  Object.defineProperty(this, 'parentSelection', {
    value: parentSelection,
    writable: false,
    configurable: false,
    enumerable: true
  });
  if (machineSpec) {
    this.setMachine(machineSpec);
  }
}

// TODO: annotate with types
// type Spec = {State: Object}
// Spec -> void
TMVizControl.prototype.setMachine = function(machineSpec) {
  var divs = this.parentSelection
    .selectAll('div.machine')
    // TODO: key by an ID guaranteed to be unique
      .data([machineSpec], function(d) { return d.name; });
  // Exit
  divs.exit().remove();

  // Update
  // FIXME: handle when previous machine was not loaded (e.g. had errors)
  divs.each(function() {
    var div = d3.select(this);
    div.select('.machine-diagram').each(function(d) {
      // save position table
      var posTable = Position.getPositionTable(this.__olddata__.machine.stateMap);
      // clear contents
      this.innerHTML = '';
      this.__olddata__.machine.isRunning = false; // important
      this.__olddata__ = d;
      // display new spec
      div.select('h3').text(function(d) { return d.name; });
      var diagramDiv = d3.select(this);
      // TODO: impl. proper data join in TMViz
      d.machine = new TMViz.TMViz(diagramDiv, d);
      Position.setPositionInfo(posTable, d.machine.stateMap);
      // FIXME: call force.start
      // rebind controls to data
      rebindControls(div.selectAll('button'), d);
    });
  });

  // Enter
  divs.enter()
    .append('div')
      .attr('class', 'machine')
      .each(function(d) {
        var div = d3.select(this);
        div.append('h3')
            .text(function(d) { return d.name; });

        d.machine = (function() {
          var diagram = div.append('div')
              .attr('class', 'machine-diagram')
              .property('__olddata__', function(d) { return d; });
          return new TMViz.TMViz(diagram, d);
        })();
        addControls(div);
      });
};

// eval a string and set the returned spec as the machine
TMVizControl.prototype.setMachineString = function(specString) {
  var dirConvention = 'var L = MoveHead.left;\nvar R = MoveHead.right;\n';
  // TODO: limit permissions? place inside iframe sandbox and run w/ web worker
  var spec = (new Function('write', 'move', 'skip', 'MoveHead', 'MoveTape',
    dirConvention + specString))(
      TM.write, TM.move, TM.skip, TM.MoveHead, TM.MoveTape);
  this.setMachine(spec);
};

exports.TMVizControl = TMVizControl;
