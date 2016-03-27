function Line(p1, p2) {
    // don't rely on p1 or p2 to stay the same object, may be replaced
    // (i.e. don't keep references to them)
    this.p1 = p1; // Vector
    this.p2 = p2;
    this.selected = false;
}

function Fan(line1, line2) {
    // reference to lines in lineData
    // keep the objects the same
    this.line1 = line1; 
    this.line2 = line2;
    this.color = "#2d8923"
    this.strokeWidth = 1;
    this.numNails = 20;
    this.selected = false;
}
Fan.prototype.strings = function() {
    console.assert(this.numNails >= 2);
    var l1p1 = this.line1.p1;
    var l1p2 = this.line1.p2;
    var l1delta = l1p2.minus(l1p1).div(this.numNails - 1)

    var l2p1 = this.line2.p1;
    var l2p2 = this.line2.p2;
    var l2delta = l2p1.minus(l2p2).div(this.numNails - 1);

    var lines = [];
    for (i = 0; i < this.numNails; i++) {
        lines.push(new Line(l1p1.plus(l1delta.times(i)), 
                            l2p2.plus(l2delta.times(i))));
    }
    return lines;
};


////////
// modes

function changeMode(mode_) {
    mode.reset();

    if (mode_ == "draw")
        mode = modeDraw;
    else if (mode_ == "select")
        mode = modeSelect;
    else
        console.assert(false);

    mode.reset();
}

var modeDraw = {
    updatingLine: false, // currently drawing a line (with updates on mousemove)

    reset: function() {
        this.updatingLine = false;
    },

    svgClick: function(coords) {
        // start new line
        if (!this.updatingLine) {
            this.updatingLine = true;
            var point = snapToLineData(new Vector(coords[0], coords[1]));
            var newLine = new Line(point, point.clone());
            lineData.push(newLine);

            // if a line is currently selected (by hand or by being the last one created)
            // create a new fan with it
            if (selection instanceof Line)
                fanData.push(new Fan(selection, newLine));
        }
        // finish current line
        else {
            this.updatingLine = false;
            selection = lineData[lineData.length - 1];
        }
    },

    mousemove: function(coords) {
        // update current line when moving mouse
        if (this.updatingLine) {
            var lastLine = lineData[lineData.length - 1];
            var mousePos = new Vector(coords[0], coords[1]);
            lastLine.p2 = snap(mousePos, lastLine.p2, lastLine.p1);
            update();
        }
    },

    fanClick: function(){},
    circleClick: function(){},
    circleDrag: function(){},
};

var modeSelect = {
    reset: function(){},

    // unselect
    svgClick: function() {
        unselect();
        update();
    },

    mousemove: function(){},

    // select fan
    fanClick: function(elem) {
        d3.event.stopPropagation();
        select(d3.select(elem.parentNode.parentNode).datum());
        update();
    },

    // select line
    circleClick: function(elem) {
        // select corresponding line
        d3.event.stopPropagation();
        select(d3.select(elem.parentNode).datum());
        update();
    },

    // move line end around
    circleDrag: function(elem, mousePos) {
        var d = d3.select(elem).datum(); // {p: point, side: either "p1" or "p2"}
        var otherSide = d.side === "p1" ? "p2" : "p1";

        var line = d3.select(elem.parentNode).datum();

        var snapped = snap(new Vector(mousePos[0], mousePos[1]), d.p, line[otherSide]);
        line[d.side] = snapped;
        update();
    }
};


// snaps a point p to the endpoints of lines in lineData when nearer than radius
// doesn't snap to exclude
function snapToLineData(p, exclude) {
    var radius = 10;
    var points = lineData.flatMap(function(line) {
        return [line.p1, line.p2];
    });
    if (exclude)
        points.remove(exclude);

    var closestPoint = p.closestPoint(points);
    if (closestPoint && p.minus(closestPoint).length() < radius) {
        return closestPoint.clone(); // ahhhh y u no did immutable
    }
    return p;
}

// lineStart: the starting point of line ending in p
function snapToSelectedLineLength(p, lineStart) {
    if (!(selection instanceof Line))
        return p;

    var radius = 20;
    var selLineLength = selection.p1.minus(selection.p2).length();
    var delta = p.minus(lineStart);
    var curLineLength = delta.length();

    if (Math.abs(selLineLength - curLineLength) < radius) {
        // stretch the line
        return lineStart.plus(delta.times(selLineLength / curLineLength));
    }
    return p;
}

// priorize snapping to lineData points
function snap(p, exclude, lineStart) {
    var snap1 = snapToLineData(p, exclude);
    var snap2 = snapToSelectedLineLength(p, lineStart);

    if (!snap1.eq(p))
        return snap1;
    return snap2;
}


//////////////////
// updating of svg

var lineAttrs = {
    x1: function(d) { return d.p1.x; },
    y1: function(d) { return d.p1.y; },
    x2: function(d) { return d.p2.x; },
    y2: function(d) { return d.p2.y; }
};

function update() {
    updateLines();
    updateFans();
    updateAttributeBox();
}

// create and update the lines representing the nails
function updateLines() {
    // group for the lines and dragging circles
    var groups = svg.selectAll("g.lines")
        .data(lineData);
    groups.enter().append("g")
        .classed("lines", true);
    groups.exit().remove();

    var lines = groups.selectAll("line").data(function(d) { return [d]; });
    lines.enter().append("line");
    lines.exit().remove();
    // enter+update
    lines.attr(lineAttrs);
    
    var drag = d3.behavior.drag().on("drag", function(d) {
            mode.circleDrag(this, d3.mouse(this));
        });

    // circles for dragging in selection mode
    var circles = groups.selectAll("circle")
        .data(function(d) { return [{p: d.p1, side: "p1"}, {p: d.p2, side: "p2"}] })
    circles.enter().append("circle")
        .call(drag)
        .on("click", function(d) {
            mode.circleClick(this);
        })
    circles.exit().remove();
    circles.attr("cx", function(d) { return d.p.x; })
           .attr("cy", function(d) { return d.p.y; });
}

// create and update the lines representing the strings between pairs of nails
function updateFans() {
    var fans = svg.selectAll("g.fans")
        .data(fanData);

    var fansEnter = fans.enter().append("g")
        .classed("fans", true);
    fansEnter.append("g").classed("string", true);
    fansEnter.append("g").classed("hover", true);
    fans.exit().remove();
    // update+enter
    // set attributes for all string lines
    fans.select("g.string")
        .attr("stroke", function(d) { return d.color; })
        .attr("stroke-width", function(d) { return d.strokeWidth * (d.selected ? 1.5 : 1); });

    // actual strings
    var strings = fans.select("g.string").selectAll("line")
        .data(function(d) {
            return d.strings();
        });
    strings.enter().append("line");
    strings.exit().remove();
    strings.attr(lineAttrs);

    // broader strokes when hovering, for easier selection
    var stringsHover = fans.select("g.hover").selectAll("line")
        .data(function(d) {
            return d.strings();
        });
    stringsHover.enter().append("line")
        .on("click", function(d) {
            mode.fanClick(this);
        })
    stringsHover.exit().remove();
    stringsHover.attr(lineAttrs);
}

// populate the attribute box to reflect current selection
function updateAttributeBox() {
    if (selection instanceof Fan) {
        d3.select("#fan-color").property("value", selection.color);
        d3.select("#fan-thickness").property("value", selection.strokeWidth);
        d3.select("#fan-nails").property("value", selection.numNails);
    }
    else {

    }
}


////////////
// selection

function select(primitive) {
    unselect();
    selection = primitive;
    selection.selected = true;
}

function unselect() {
    if (selection) {
        selection.selected = false;
        selection = null;
    }
}



var lineData = []; // array of Line objects
var fanData = []; // array of Fan objects

var selection = null; // Fan, String or null
var mode = modeDraw;


var svg = d3.select("svg")
    .on("click", function() {
        mode.svgClick(d3.mouse(this));
    })
    .on("mousemove", function() {
        mode.mousemove(d3.mouse(this));
    })
d3.select("body")
    .on("keydown", function() {
        // del key
        if (d3.event.keyCode === 46) {
            if (selection instanceof Line) {
                lineData.remove(selection);
                // also remove any fan containing that line
                fanData.remove(selection, function(fan, line) {
                    return fan.line1 === line || fan.line2 === line;
                });
                unselect();
                update();
            }
            else if (selection instanceof Fan) {
                fanData.remove(selection);
                unselect();
                update();
            }
        }
        // esc key
        else if (d3.event.keyCode === 27) {
            unselect();
            update();
        }
    });

// handle info box changes
d3.select("#fan-color").on("input", function() {
    if (this.value) {
        console.assert(selection instanceof Fan);
        selection.color = this.value;
        update();
    }
});
d3.select("#fan-thickness").on("input", function() {
    if (this.value && this.value >= 0) {
        console.assert(selection instanceof Fan);
        selection.strokeWidth = this.value;
        update();
    }
});
d3.select("#fan-nails").on("input", function() {
    if (this.value && this.value >= 2) {
        console.assert(selection instanceof Fan);
        selection.numNails = this.value;
        update();
    }
});

update();
