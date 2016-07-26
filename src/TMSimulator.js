'use strict';

var parseSpec = require('./parser').parseSpec,
    TMViz = require('./TMViz'),
    watchInit = require('./watch').watchInit,
    values = require('lodash').values;

/**
 * Turing machine simulator component.
 *
 * Contains a state diagram, tape diagram, and button controls.
 * @param {[type]} container [description]
 * @param {[type]} buttons   [description]
 */
function TMSimulator(container, buttons) {
  this.container = container;
  this.buttons = buttons;

  var self = this;
  buttons.step
      .addEventListener('click', function () {
        self.machine.isRunning = false;
        self.machine.step(); // each step click corresponds to 1 machine step
      });
  buttons.run
      .addEventListener('click', function () {
        self.machine.isRunning = !self.machine.isRunning;
      });
  buttons.reset
      .addEventListener('click', function () {
        self.machine.reset();
      });
  buttons.all = values(buttons);

  this.clear();
}

TMSimulator.prototype.clear = function () {
  this.sourceCode = null;
};

Object.defineProperties(TMSimulator.prototype, {
  /**
   * The machine's source code.
   * • Setting a new source code will attempt to persist the state node positions.
   * • To set a new machine, first call .clear(), then set the source code.
   */
  sourceCode: {
    get: function () {
      return this.__sourceCode;
    },
    // throws if sourceCode has errors
    set: function (sourceCode) {
      if (this.machine) {
        this.machine.isRunning = false; // important
        this.machine.stateviz.force.stop();
      }
      if (sourceCode == null) {
        // clear display
        this.machine = null;
        this.container.innerHTML = '';
      } else {
        // parse & check, then set
        var spec = parseSpec(sourceCode);
        if (this.machine) {
          // case: update
          // copy & restore positions, clear & load contents
          var posTable = this.machine.positionTable;
          this.clear();
          this.machine = new TMViz(this.container, spec, posTable);
        } else {
          // case: load new
          this.machine = new TMViz(this.container, spec);
        }
      }
      this.__sourceCode = sourceCode;
    },
    enumerable: true
  },
  positionTable: {
    get: function () {
      return this.machine && this.machine.positionTable;
    },
    set: function (posTable) {
      if (this.machine && posTable) {
        this.machine.positionTable = posTable;
      }
    },
    enumerable: true
  },
  machine: {
    get: function () {
      return this.__machine;
    },
    set: function (machine) {
      this.__machine = machine;
      this.rebindButtons();
    }
  }
});

/////////////
// Buttons //
/////////////

/**
 * The innerHTML for the "Run" button.
 * The default value can be overridden.
 * @type {string}
 */
TMSimulator.prototype.htmlForRunButton =
  '<span class="glyphicon glyphicon-play" aria-hidden="true"></span><br>Run';
TMSimulator.prototype.htmlForPauseButton =
  '<span class="glyphicon glyphicon-pause" aria-hidden="true"></span><br>Pause';

// bind: .disabled for Step and Run, and .innerHTML (Run/Pause) for Run
function rebindStepRun(stepButton, runButton, runHTML, pauseHTML, machine) {
  function onHaltedChange(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
  }
  function onRunningChange(isRunning) {
    runButton.innerHTML = isRunning ? pauseHTML : runHTML;
  }
  watchInit(machine, 'isHalted', function (prop, oldval, isHalted) {
    onHaltedChange(isHalted);
    return isHalted;
  });
  watchInit(machine, 'isRunning', function (prop, oldval, isRunning) {
    onRunningChange(isRunning);
    return isRunning;
  });
}

// internal method.
TMSimulator.prototype.rebindButtons = function () {
  var buttons = this.buttons;
  var enable = (this.machine != null);
  if (enable) {
    rebindStepRun(buttons.step, buttons.run,
      this.htmlForRunButton, this.htmlForPauseButton, this.machine);
  }
  buttons.all.forEach(function (b) { b.disabled = !enable; });
};

module.exports = TMSimulator;
