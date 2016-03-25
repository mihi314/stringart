// remove all occurences of elem from array
// if comp function gets passed in, use that for comparison
Array.prototype.remove = function(elem, comp) {
    if (comp === undefined)
        comp = function(e1, e2) { return e1 === e2; };

    for(var i = this.length - 1; i >= 0; i--) {
        if(comp(this[i], elem)) {
            this.splice(i, 1);
        }
    }
    return this;
}

function Line(x1, y1, x2, y2) {
    this.p1 = {x: x1, y: y1};
    this.p2 = {x: x2, y: y2};
    this.selected = false;
}

function Fan(line1, line2) {
    this.line1 = line1; // reference to a line in lineData
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
    var l1dx = (l1p2.x - l1p1.x) / (this.numNails - 1);
    var l1dy = (l1p2.y - l1p1.y) / (this.numNails - 1);

    var l2p1 = this.line2.p1;
    var l2p2 = this.line2.p2;
    var l2dx = (l2p2.x - l2p1.x) / (this.numNails - 1);
    var l2dy = (l2p2.y - l2p1.y) / (this.numNails - 1);

    var lines = [];
    for (i = 0; i < this.numNails; i++) {
        lines.push(new Line(l1p1.x + i*l1dx, l1p1.y + i*l1dy,
                            l2p1.x + i*l2dx, l2p1.y + i*l2dy));
    }
    return lines;
};


var lineData = []; // array of Line objects
var fanData = []; // array of Fan objects
var updatingLine = false; // currently drawing a line (with updates on mousemove)
var firstLineCreated = false;

var selection = null; // Fan, String or null

var mode = "draw";
var handlers = {
    draw: {
        svgClick: modeDraw_onSvgClick, 
        mousemove: modeDraw_onMousemove,
        circleClick: function(){},
        circleDrag: function(){},
        fanClick: function(){}
    },
    select: {
        svgClick: modeSelect_onSvgClick, 
        mousemove: function(){},
        circleClick: modeSelect_onCircleClick,
        circleDrag: modeSelect_onCircleDrag,
        fanClick: modeSelect_onFanClick
    }
};

var svg = d3.select("svg")
    .on("click", function() {
        handlers[mode].svgClick(d3.mouse(this));
    })
    .on("mousemove", function() {
        handlers[mode].mousemove(d3.mouse(this));
    })
// handle delete key
d3.select("body")
    .on("keydown", function() {
        // del key
        if (d3.event.keyCode !== 46)
            return;

        if (selection instanceof Line) {
            lineData.remove(selection);
            // also remove any fan containing that line
            fanData.remove(selection, function(fan, line) {
                return fan.line1 === line || fan.line2 === line;
            });
            selection = null;
            update();
        }
        else if (selection instanceof Fan) {
            fanData.remove(selection);
            selection = null;
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

function modeDraw_onSvgClick(coords) {
    // start new line
    if (!updatingLine) {
        updatingLine = true;
        var newLine = new Line(coords[0], coords[1], coords[0], coords[1]);
        lineData.push(newLine);

        if (firstLineCreated)
            fanData.push(new Fan(lineData[lineData.length-2], newLine));
    }
    // finish current line
    else {
        updatingLine = false;
        firstLineCreated = !firstLineCreated;
    }
}
function modeDraw_onMousemove(coords) {
    // update current line when moving mouse
    if (updatingLine) {
        var lastLine = lineData[lineData.length - 1];
        lastLine.p2.x = coords[0];
        lastLine.p2.y = coords[1];
        update();
    }
}

function modeSelect_onCircleDrag(d) {
    d.x += d3.event.dx;
    d.y += d3.event.dy;
    update();
}
function modeSelect_onCircleClick(elem) {
    d3.event.stopPropagation();
    if (selection)
        selection.selected = false;
    selection = d3.select(elem.parentNode).datum();
    selection.selected = true;
    update();
}
function modeSelect_onFanClick(elem) {
    d3.event.stopPropagation();
    if (selection)
        selection.selected = false;
    selection = d3.select(elem.parentNode.parentNode).datum();
    selection.selected = true;
    update();
}
function modeSelect_onSvgClick() {
    if (selection)
        selection.selected = false;
    selection = null;
    update();
}

var lineAttrs = {
    x1: function(d) { return d.p1.x; },
    y1: function(d) { return d.p1.y; },
    x2: function(d) { return d.p2.x; },
    y2: function(d) { return d.p2.y; }
};

function update() {
    updateLines();
    updateFans();
    updateSelection();
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
            handlers[mode].circleDrag(d);
        });

    // circles for dragging in selection mode
    var circles = groups.selectAll("circle")
        .data(function(d) { return [d.p1, d.p2] })
    circles.enter().append("circle")
        .call(drag)
        .on("click", function(d) {
            handlers[mode].circleClick(this);
        })
    circles.exit().remove();
    circles.attr("cx", function(d) { return d.x; })
           .attr("cy", function(d) { return d.y; });
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
            handlers[mode].fanClick(this);
        })
    stringsHover.exit().remove();
    stringsHover.attr(lineAttrs);
}

// populate the info box to reflect current selection
function updateSelection() {
    if (selection instanceof Fan) {
        d3.select("#fan-color").property("value", selection.color);
        d3.select("#fan-thickness").property("value", selection.strokeWidth);
        d3.select("#fan-nails").property("value", selection.numNails);
    }
    else {

    }
}

function changeMode(mode_) {
    mode = mode_;
    updatingLine = false;
    firstLineCreated = false;
    if (selection) {
        selection.selected = false;
        update();
    }
}
