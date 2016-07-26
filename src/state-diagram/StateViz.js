'use strict';

var isBrowserIEorEdge = require('../util').isBrowserIEorEdge;
var d3 = require('d3');
var _ = require('lodash/fp');
var assign = require('lodash').assign; // need mutable assign()

// *** Arrays as vectors ***

// Add vectors.
// Note: dimensions are not checked. Missing dimensions become NaN.
function addV(array1, array2) {
  return array1.map(function (x, i) { return x + array2[i]; });
}

function negateV(array) {
  return array.map(function (x) { return -x; });
}

function subtractV(array1, array2) {
  return addV(array1, negateV(array2));
}

// Scale the vector by a scalar.
function multiplyV(array, scalar) {
  return array.map(function (x) { return scalar*x; });
}

// Vector norm, squared
function normSqV(array) {
  function sq(x) { return x*x; }
  function add(x, y) { return x + y; }
  return array.map(sq).reduce(add, 0);
}

// Vector norm
function normV(array) { return Math.sqrt(normSqV(array)); }

// Return a copy of the vector rescaled as a unit vector (norm = 1).
function unitV(array) {
  var n = normV(array);
  return array.map(function (x) { return x / n; });
}

// *** 2D Vectors ***
function angleV(array) {
  var x = array[0], y = array[1];
  return Math.atan2(y, x);
}

function vectorFromLengthAngle(length, angle) {
  return [Math.cos(angle) * length, Math.sin(angle) * length];
}

// *** Utilities ***

// Count the directed edges that start at a given node and end at another.
// Important: each node must have a unique .index property.
// Example usage:
// var counts = new EdgeCounter(edges);
// var edgesFrom2To5 = counts.numEdgesFromTo(2,5);
// var edgesFrom5to2 = counts.numEdgesFromTo(5,2);
function EdgeCounter(edges) {
  edges.forEach(function (e) {
    var key = e.source.index +','+ e.target.index;
    this[key] = (this[key] || 0) + 1;
  }, this);
}

EdgeCounter.prototype.numEdgesFromTo = function (src, target) {
  return this[String(src)+','+String(target)] || 0;
};

var EdgeShape = Object.freeze({
  loop: {},     // self-loop: a->a
  arc: {},      // curved arc: a->b when b->a exists
  straight: {}  // straight edge: a->b when b->a does not exist
});

EdgeCounter.prototype.shapeForEdge = function (e) {
  if (e.target.index === e.source.index) {
    return EdgeShape.loop;
  } else if (this.numEdgesFromTo(e.target.index, e.source.index)) {
    // has returning edge => arc
    return EdgeShape.arc;
  } else {
    return EdgeShape.straight;
  }
};

// create a function that will compute an edge's SVG 'd' attribute.
function edgePathFor(nodeRadius, shape, d) {
  // case: self-loop
  var loopEndOffset, loopArc;
  if (shape === EdgeShape.loop) {
    // start at the top (90°), end slightly above the right (15°)
    loopEndOffset = vectorFromLengthAngle(nodeRadius, -15 * Math.PI/180);
    loopArc = ' a 19,27 45 1,1 ' + loopEndOffset[0] + ',' + (loopEndOffset[1]+nodeRadius);
    return function () {
      var x1 = d.source.x,
          y1 = d.source.y;
      return 'M ' + x1 + ',' + (y1-nodeRadius) + loopArc;
    };
  }
  // case: between nodes
  if (shape === EdgeShape.arc) {
    // sub-case: arc
    return function () {
      // note: p1 & p2 have to be delayed, to access x/y at the time of the call
      var p1 = [d.source.x, d.source.y];
      var p2 = [d.target.x, d.target.y];
      var offset = subtractV(p2, p1);
      var radius = 6/5*normV(offset);
      // Note: SVG's y-axis is flipped, so vector angles are negative
      // relative to standard coordinates (as used in Math.atan2).
      // Proof: angle(r <cos ϴ, -sin ϴ>) = angle(r <cos -ϴ, sin -ϴ>) = -ϴ.
      var angle = angleV(offset);
      var sep = -Math.PI/2/2; // 90° separation, half on each side
      var source = addV(p1, vectorFromLengthAngle(nodeRadius, angle+sep));
      var target = addV(p2, vectorFromLengthAngle(nodeRadius, angle+Math.PI-sep));
      // IDEA: consider http://www.w3.org/TR/SVG/paths.html#PathDataCubicBezierCommands
      return (p1[0] <= p2[0])
        ? 'M '+source[0]+' '+source[1]+' A '+radius+' '+radius+' 0 0,1 '+target[0]+' '+target[1]
        : 'M '+target[0]+' '+target[1]+' A '+radius+' '+radius+' 0 0,0 '+source[0]+' '+source[1];
    };
  } else if (shape === EdgeShape.straight) {
    return function () {
      // sub-case: straight line
      var p1 = [d.source.x, d.source.y];
      var p2 = [d.target.x, d.target.y];
      var offset = subtractV(p2, p1);
      // avoid spurious errors when bounding causes node centers to coincide
      if (offset[0] === 0 && offset[1] === 0) { return null; }

      var target = subtractV(p2, multiplyV(unitV(offset), nodeRadius));
      return 'M '+p1[0]+' '+p1[1]+' L '+ target[0] +' '+ target[1];
    };
  }
}

function rectCenter(svgrect) {
  return {x: svgrect.x + svgrect.width/2,
          y: svgrect.y + svgrect.height/2};
}

function identity(x) { return x; }
function noop() {}

function limitRange(min, max, value) {
  return Math.max(min, Math.min(value, max));
}

// IE padding hack so that SVG resizes properly.
// This works across browsers but we only need it for IE.
var appendSVGTo = !isBrowserIEorEdge
  ? function (div) { return div.append('svg'); }
  : function (div, hwRatio) {
    return div
      .append('div')
        .style({
          width: '100%',
          height: '0',
          'padding-bottom': (100 * hwRatio) + '%',
          position: 'relative'
        })
      .append('svg')
        .style({
          position: 'absolute',
          top: '0',
          left: '0'
        });
  };

// *** D3 diagram ***
require('./StateViz.css');

// type LayoutNode = {label: string};
// type StateMap = {[state: string]: LayoutNode};

/**
 * Create a state diagram inside an SVG.
 * Each vertex/edge (node/link) object is also annotated with @.domNode@
 * corresponding to its SVG element.
 *
 * Note: currently, element IDs (e.g. for textPath) will collide if multiple
 * diagrams are on the same document (HTML page).
 * @param  {D3Selection}      container     Container to add the SVG to.
 * @param  {[LayoutNode] | StateMap} nodes  Parameter to D3's force.nodes.
 *   Important: passing a StateMap is recommended when using setPositionTable.
 *   Passing an array will key the state nodes by array index.
 * @param  {[LayoutEdge]}     linkArray     Parameter to D3's force.links.
 */
function StateViz(container, nodes, linkArray) {
  /* References:
    [Sticky Force Layout](http://bl.ocks.org/mbostock/3750558) demonstrates
    drag to position and double-click to release.

    [Graph with labeled edges](http://bl.ocks.org/jhb/5955887) demonstrates
    arrow edges with auto-rotated labels.
  */

  /* eslint-disable no-invalid-this */ // eslint is not familiar with D3
  var w = 800;
  var h = 500;
  var linkDistance = 140;
  var nodeRadius = 20;

  var colors = d3.scale.category10();

  var svg = appendSVGTo(container, h/w);
  svg.attr({
    'viewBox': [0, 0, w, h].join(' '),
    'version': '1.1',
    ':xmlns': 'http://www.w3.org/2000/svg',
    ':xmlns:xlink': 'http://www.w3.org/1999/xlink'
  });

  // Force Layout

  // drag event handlers
  function dragstart(d) {
    d.fixed = true;
    svg.transition()
      .style('box-shadow', 'inset 0 0 1px gold');
  }
  function dragend() {
    svg.transition()
      .style('box-shadow', null);
  }
  function releasenode(d) {
    d.fixed = false;
    force.resume();
  }

  // set up force layout
  var nodeArray = nodes instanceof Array ? nodes : _.values(nodes);
  this.__stateMap = nodes;

  var force = d3.layout.force()
      .nodes(nodeArray)
      .links(linkArray)
      .size([w,h])
      .linkDistance([linkDistance])
      .charge([-500])
      .theta(0.1)
      .gravity(0.05)
      .start();

  var drag = force.drag()
      .on('dragstart', dragstart)
      .on('dragend', dragend);

  // Edges
  var edgeCounter = new EdgeCounter(linkArray);

  var edgeselection = svg.selectAll('.edgepath')
    .data(linkArray)
    .enter();

  var edgegroups = edgeselection.append('g');

  var labelAbove = function (d, i) { return String(-1.1*(i+1)) + 'em'; };
  var labelBelow = function (d, i) { return String(0.6+ 1.1*(i+1)) + 'em'; };

  edgegroups.each(function (edgeD, edgeIndex) {
    var group = d3.select(this);
    var edgepath = group
      .append('path')
        .attr({'class': 'edgepath',
               'id': 'edgepath'+edgeIndex })
        .each(function (d) { d.domNode = this; });

    var labels = group.selectAll('.edgelabel')
      .data(edgeD.labels).enter()
      .append('text')
        .attr('class', 'edgelabel');
    labels.append('textPath')
        .attr('xlink:href', function () { return '#edgepath'+edgeIndex; })
        .attr('startOffset', '50%')
        .text(identity);
    /* To reduce JS computation, label positioning varies by edge shape:
        * Straight edges can use a fixed 'dy' value.
        * Loops cannot use 'dy' since it increases letter spacing
          as labels get farther from the path. Instead, since a loop's shape
          is fixed, it allows a fixed translate 'transform'.
        * Arcs are bent and their shape is not fixed, so neither 'dy'
          nor 'transform' can be constant.
          Fortunately the curvature is slight enough that a fixed 'dy'
          looks good enough without resorting to dynamic translations.
    */
    var shape = edgeCounter.shapeForEdge(edgeD);
    edgeD.getPath = edgePathFor(nodeRadius, shape, edgeD);
    switch (shape) {
      case EdgeShape.straight:
        labels.attr('dy', labelAbove);
        edgeD.refreshLabels = function () {
          // flip edge labels that are upside-down
          labels.attr('transform', function () {
            if (edgeD.target.x < edgeD.source.x) {
              var c = rectCenter(this.getBBox());
              return 'rotate(180 '+c.x+' '+c.y+')';
            } else {
              return null;
            }
          });
        };
        break;
      case EdgeShape.arc:
        var isFlipped;
        edgeD.refreshLabels = function () {
          var shouldFlip = edgeD.target.x < edgeD.source.x;
          if (shouldFlip !== isFlipped) {
            edgepath.classed('reversed-arc', shouldFlip);
            labels.attr('dy', shouldFlip ? labelBelow : labelAbove);
            isFlipped = shouldFlip;
          }
        };
        break;
      case EdgeShape.loop:
        labels.attr('transform', function (d, i) {
          return 'translate(' + String(8*(i+1)) + ' ' + String(-8*(i+1)) + ')';
        });
        edgeD.refreshLabels = noop;
        break;
    }
  });
  var edgepaths = edgegroups.selectAll('.edgepath');

  // Nodes
  // note: nodes are added after edges so as to paint over excess edge lines
  var nodeSelection = svg.selectAll('.node')
    .data(nodeArray)
    .enter();

  var nodecircles = nodeSelection
    .append('circle')
      .attr('class', 'node')
      .attr('r', nodeRadius)
      .style('fill', function (d,i) { return colors(i); })
      .each(function (d) { d.domNode = this; })
      .on('dblclick', releasenode)
      .call(drag);

  var nodelabels = nodeSelection
   .append('text')
     .attr('class', 'nodelabel')
     .attr('dy', '0.25em') /* dy doesn't work in CSS */
     .text(function (d) { return d.label; });

  // Arrowheads
  var svgdefs = svg.append('defs');
  svgdefs.selectAll('marker')
      .data(['arrowhead', 'active-arrowhead', 'reversed-arrowhead', 'reversed-active-arrowhead'])
    .enter().append('marker')
      .attr({'id': function (d) { return d; },
             'viewBox':'0 -5 10 10',
             'refX': function (d) {
               return (d.lastIndexOf('reversed-', 0) === 0) ? 0 : 10;
             },
             'orient':'auto',
             'markerWidth':10,
             'markerHeight':10
            })
    .append('path')
      .attr('d', 'M 0 -5 L 10 0 L 0 5 Z')
      .attr('transform', function (d) {
        return (d.lastIndexOf('reversed-', 0) === 0) ? 'rotate(180 5 0)' : null;
      });

  var svgCSS =
    '.edgepath {' +
    '  marker-end: url(#arrowhead);' +
    '}' +
    '.edgepath.active-edge {' +
    '  marker-end: url(#active-arrowhead);' +
    '}' +
    '.edgepath.reversed-arc {' +
    '  marker-start: url(#reversed-arrowhead);' +
    '  marker-end: none;' +
    '}' +
    '.edgepath.active-edge.reversed-arc {' +
    '  marker-start: url(#reversed-active-arrowhead);' +
    '  marker-end: none;' +
    '}';
  svg.append('style').each(function () {
    if (this.styleSheet) {
      this.styleSheet.cssText = svgCSS;
    } else {
      this.textContent = svgCSS;
    }
  });

  // Force Layout Update
  force.on('tick', function () {
    // Keep coordinates in bounds. http://bl.ocks.org/mbostock/1129492
    // NB. Bounding can cause node centers to coincide, especially at corners.
    nodecircles.attr({cx: function (d) { return d.x = limitRange(nodeRadius, w - nodeRadius, d.x); },
                      cy: function (d) { return d.y = limitRange(nodeRadius, h - nodeRadius, d.y); }
    });

    nodelabels.attr('x', function (d) { return d.x; })
              .attr('y', function (d) { return d.y; });

    edgepaths.attr('d', function (d) { return d.getPath(); });

    edgegroups.each(function (d) { d.refreshLabels(); });

    // Conserve CPU when layout is fully fixed
    if (nodeArray.every(function (d) { return d.fixed; })) {
      force.stop();
    }
  });
  this.force = force;
  /* eslint-enable no-invalid-this */
}

// Positioning

// {[key: State]: Node} -> PositionTable
var getPositionTable = _.mapValues(_.pick(['x', 'y', 'px', 'py', 'fixed']));

// Tag nodes w/ positions. Mutates the node map.
// PositionTable -> {[key: State]: Node} -> void
function setPositionTable(posTable, stateMap) {
  _.forEach(function (node, state) {
    var position = posTable[state];
    if (position !== undefined) {
      assign(node, position);
    }
  }, stateMap);
}

Object.defineProperty(StateViz.prototype, 'positionTable', {
  get: function () { return getPositionTable(this.__stateMap); },
  set: function (posTable) {
    setPositionTable(posTable, this.__stateMap);
    // ensure that a cooled layout will update
    this.force.resume();
  }
});


module.exports = StateViz;
