'use strict';
// requires ./Tape.js, D3

var cellWidth = 50;
var cellHeight = 50;

function initTapeCells(selection) {
  selection.attr('class', 'tape-cell');
  selection.append('rect')
      // the box outline is purely visual, so remove its data binding
      .datum(null)
      .attr({'width': cellWidth,
             'height': cellHeight});
  selection.append('text')
      .text(function(d) { return d; })
      .attr({'x': cellWidth/2, 'y': cellHeight/2 + 8});
  return selection;
}

// Tape visualization centered around the tape head.
function TapeViz(svg, lookaround, blank, input) {
  Tape.call(this, blank, input);

  // width is before + head + after, trimming 2 off to show cut-off tape ends
  svg.attr({'width': cellWidth * (lookaround+1+lookaround-2) + 20,
            'height': cellHeight+20});

  this.__defineGetter__('lookaround', function() { return lookaround; });

  this.wrapper = svg.append('g').attr('class', 'wrapper');

  var tapeHead = svg.append('rect')
      .attr({'id': 'tape-head',
             'width': cellWidth+10,
             'height': cellHeight+10,
             'x': 10/2 + cellWidth*(lookaround-1),
             'y': 10/2
           });

  var cells = this.wrapper.selectAll('.tape-cell')
      .data(this.readRange(-lookaround, lookaround))
    .enter()
    .append('g')
      .attr('transform', function(d, i) { return 'translate(' + (-50+10 + cellWidth*i) + ' 10)'; })
      .call(initTapeCells)
  ;
}

TapeViz.prototype = Object.create(Tape.prototype);
TapeViz.prototype.constructor = TapeViz;

// TODO: concurrently fade out old value and fade in new value
// TODO: chain headLeft/Right to wait for write()?
TapeViz.prototype.write = function(symbol) {
  // don't animate if symbol stays the same
  if (Tape.prototype.read.call(this) === symbol) {
    return;
  }
  Tape.prototype.write.call(this, symbol);

  // remove leftover .exiting in case animation was interrupted
  this.wrapper.selectAll('.exiting').remove();

  // TODO: replace with .selectAll('.tape-cell:not(.exiting)'),
  // to avoid need to remove .exiting ?
  d3.select(this.wrapper[0][0].childNodes[this.lookaround])
      .datum(symbol)
    .select('text')
      .attr('fill-opacity', '1')
      .attr('stroke-opacity', '1')
    .transition()
      .attr('fill-opacity', '0.4')
      .attr('stroke-opacity', '0.1')
    .transition()
      .text(function(d) { return d; })
      .attr('fill-opacity', '1')
      .attr('stroke-opacity', '1')
    .transition()
      .duration(0)
      .attr('fill-opacity', null)
      .attr('stroke-opacity', null)
    ;
}

TapeViz.prototype.headRight = function() {
  Tape.prototype.headRight.call(this);
  // remove leftover .exiting in case animation was interrupted
  this.wrapper.selectAll('.exiting').remove();

  // add to right end
  var tapeView = this.wrapper.append('g')
      .datum(this.readOffset(this.lookaround))
      .call(initTapeCells);

  // remove from left end
  this.wrapper.select('.tape-cell')
      .classed('exiting', true);

  // shift all cells leftwards, but translate wrapper rightwards to compensate
  this.wrapper.selectAll('.tape-cell')
      .attr('transform', function(d, i) {
              return 'translate(' + (-50+10+cellWidth*(i-1)).toString() + ' 10)';
            });
  this.wrapper
      .attr('transform', 'translate(' + cellWidth.toString() + ')')
    .transition()
      .attr('transform', 'translate(0)')
    .transition()
      .duration(0)
      .attr('transform', null)
    .select('.exiting')
      .remove();
}

TapeViz.prototype.headLeft = function() {
  Tape.prototype.headLeft.call(this);
  // remove leftover .exiting in case animation was interrupted
  this.wrapper.selectAll('.exiting').remove();

  // add to left end
  var tapeView = this.wrapper.insert('g', ':first-child')
      .datum(this.readOffset(-this.lookaround))
      .call(initTapeCells);

  // remove from right end
  this.wrapper.select('.wrapper > .tape-cell:last-of-type')
      .classed('exiting', true);

  // translate cells rightward, and wrapper leftward. animate wrapper going right.
  this.wrapper.selectAll('.tape-cell')
      .attr('transform', function(d, i) {
              return 'translate(' + (-50+10+cellWidth*i).toString() + ' 10)';
            });
  this.wrapper
      .attr('transform', 'translate(' + (-cellWidth).toString() + ')')
    .transition()
      .attr('transform', 'translate(0)')
    .transition()
      .duration(0)
      .attr('transform', null)
    .select('.exiting')
      .remove();
  ;
}
