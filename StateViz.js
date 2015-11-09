'use strict';
// requires d3.js

// *** Arrays as vectors ***

// Add vectors.
// Note: dimensions are not checked. Missing dimensions become NaN.
function addV(array1, array2) {
  return array1.map(function(x, i) { return x + array2[i]; });
}

function negateV(array) {
  return array.map(function(x) { return -x; });
}

function subtractV(array1, array2) {
  return addV(array1, negateV(array2));
}

// Scale the vector by a scalar.
function multiplyV(array, scalar) {
  return array.map(function(x) { return scalar*x; });
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
  return array.map(function(x) { return x / n; });
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
// Example usage:
// var counts = countEdges(edges);
// var edgesFrom2To5 = counts.numEdgesFromTo(2,5);
// var edgesFrom5to2 = counts.numEdgesFromTo(5,2);
function countEdges(edges) {
  var result = {
    numEdgesFromTo: function(src, target) {
      return this[String(src)+','+String(target)] || 0;
    }
  };
  edges.forEach(function(edge) {
    var key = edge.source.index +','+ edge.target.index;
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}


// *** D3 diagram ***

// TODO: allow multiple diagrams per page? as is, some element IDs would collide.

// Create a Turing Machine state diagram inside a given SVG using the given nodes and edges.
// Each node/edge object is also annotated with a @domNode@ property corresponding
// to its SVG element.
function visualizeState(svg, nodeArray, linkArray) {
  // based on [Graph with labeled edges](http://bl.ocks.org/jhb/5955887)
  // and [Sticky Force Layout](http://bl.ocks.org/mbostock/3750558)
  var w = 1000;
  var h = 400;
  var linkDistance=200;
  var nodeRadius = 15;

  var colors = d3.scale.category10();

  svg.attr({'width': w,
            'height': h});

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
  }

  // set up force layout
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
  var edgeSelection = svg.selectAll('.edgepath')
    .data(linkArray)
    .enter();

  // append edges before nodes, so nodes are painted on top
  var edgepaths = edgeSelection
    .append('path')
      .attr({'class':'edgepath',
             'id': function(d,i) { return 'edgepath'+i; }})
      .each(function(d) { d.domNode = this; });

  var edgelabels = edgeSelection
    .append('text')
      .attr('class', 'edgelabel')
      .attr('dy', '-7px');

  edgelabels.append('textPath')
      .attr('xlink:href', function(d,i) { return '#edgepath'+i; })
      .attr('startOffset', '50%')
      .text(function(d) { return d.label; });

  // Nodes
  var nodeSelection = svg.selectAll('.node')
    .data(nodeArray)
    .enter();

  var nodecircles = nodeSelection
    .append('circle')
      .attr('class', 'node')
      .attr('r', nodeRadius)
      .style('fill', function(d,i) { return colors(i); })
      .each(function(d) { d.domNode = this; })
      .on('dblclick', releasenode)
      .call(drag);

  var nodelabels = nodeSelection
   .append('text')
     .attr('class', 'nodelabel')
     .attr('dy', '0.25em') /* dy doesn't work in CSS */
     .text(function(d) { return d.label; });

  // Arrowhead
  svg.append('defs').selectAll('marker')
      .data(['arrowhead', 'active-arrowhead'])
    .enter().append('marker')
      .attr({'id': function(d) { return d; },
             'viewBox':'0 -5 10 10',
             'refX':10,
             'orient':'auto',
             'markerWidth':10,
             'markerHeight':10})
    .append('path')
      .attr('d', 'M 0 -5 L 10 0 L 0 5 Z');

  // Force Layout Update
  var edgeCount = countEdges(linkArray);

  force.on('tick', function(){
    nodecircles.attr({'cx': function(d) { return d.x; },
                      'cy': function(d) { return d.y; }
    });

    nodelabels.attr('x', function(d) { return d.x; }) 
              .attr('y', function(d) { return d.y; });

    edgepaths.attr('d', function(d) {
      var x1 = d.source.x,
          y1 = d.source.y;
      // case: self-loop
      if (d.target.index === d.source.index) {
        return 'M ' + x1 + ',' + (y1-nodeRadius) +
          ' A 30,20 -45 1,1 ' + (x1+nodeRadius) + ',' + y1;
      }
      // case: between nodes
      var p1 = [d.source.x, d.source.y];
      var p2 = [d.target.x, d.target.y];
      var offset = subtractV(p2, p1);
      var target;
      // TODO: account for multiple edges with same source + target
      // right now it works for back and forth: one edge out and one edge in.
      if (edgeCount.numEdgesFromTo(d.target.index, d.source.index)) {
        // sub-case: arc
        var radius = 6/5*normV(offset);
        // Note: SVG's y-axis is flipped, so vector angles are negative
        // relative to standard coordinates (as used in Math.atan2).
        // Proof: angle(r <cos ϴ, -sin ϴ>) = angle(r <cos -ϴ, sin -ϴ>) = -ϴ.
        var angle = angleV(offset);
        var sep = -Math.PI/2/2; // 90° separation, half on each side
        var source = addV(p1, vectorFromLengthAngle(nodeRadius, angle+sep));
        target = addV(p2, vectorFromLengthAngle(nodeRadius, angle+Math.PI-sep));
        // TODO: consider http://www.w3.org/TR/SVG/paths.html#PathDataCubicBezierCommands
        return 'M '+source[0]+' '+source[1]+' A '+radius+' '+radius + ' 0 0,1 '+
          target[0] + ' ' +target[1];
      } else {
        // sub-case: straight line
        target = subtractV(p2, multiplyV(unitV(offset), nodeRadius));
        return 'M '+x1+' '+y1+' L '+ target[0] +' '+ target[1];
      }
    });

    edgelabels.attr('transform', function(d) {
      // auto-rotate edge labels that are upside-down
      if (d.target.x < d.source.x) {
        var box = this.getBBox();
        var rx = box.x+box.width/2;
        var ry = box.y+box.height/2;
        return 'rotate(180 '+rx+' '+ry+')';
      } else {
        return null;
      }
    });
  });
}
