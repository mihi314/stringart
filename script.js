function Line(p1, p2) {
    // don't rely on p1 or p2 to stay the same object, may be replaced
    // (i.e. don't keep references to them)
    this.p1 = p1; // Vector
    this.p2 = p2;
    this.selected = false;
}
Line.prototype.length = function(newLength) {
    return this.p2.minus(this.p1).length();
};
Line.prototype.angle = function(newAngle) {
    return this.p2.minus(this.p1).angle();
};

function Fan(line1, line2) {
    // reference to lines in lineData
    // keep the objects the same
    this.line1 = line1; 
    this.line2 = line2;
    this.color = "#2d8923"
    this.strokeWidth = 1;
    this.numNails = 20;
    this.selected = false;
};
// return all the lines/strings comprising the fan that spans line1 and line2
// p1 of the returned strings touch line1, p2 touch line2
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

    svgClick: function(mouseCoords) {
        // start new line
        if (!this.updatingLine) {
            this.updatingLine = true;
            var point = snapToNails(new Vector(mouseCoords[0], mouseCoords[1]));
            var newLine = new Line(point, point.clone());
            lineData.push(newLine);

            // if a line is currently selected (by hand or by being the last one created)
            // create a new fan with it
            if (selection instanceof Line) {
                var newFan = new Fan(selection, newLine);
                newFan.numNails = Math.max(Math.round(newFan.line1.length() / nailDistance + 1), 2);
                fanData.push(newFan);
            }
        }
        // finish current line
        else {
            this.updatingLine = false;
            select(lineData[lineData.length - 1]);
            update();
        }
    },

    // todo: unify with modeSelect.circleDrag
    mousemove: function(mouseCoords) {
        // update current line when moving mouse
        if (this.updatingLine) {
            var lastLine = lineData[lineData.length - 1];
            var mousePos = new Vector(mouseCoords[0], mouseCoords[1]);
            lastLine.p2 = snap(mousePos, lastLine, lastLine.p1, nailDistance);
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
    circleDrag: function(elem, mouseCoords) {
        var d = d3.select(elem).datum(); // {p: point, side: either "p1" or "p2"}
        var otherSide = d.side === "p1" ? "p2" : "p1";

        var line = d3.select(elem.parentNode).datum();

        var snapped = snap(new Vector(mouseCoords[0], mouseCoords[1]), line, line[otherSide], nailDistance);
        line[d.side] = snapped;
        update();
    }
};


// snaps a point p to the endpoints of lines in lineData when nearer than radius
// doesn't snap to exclude
// returns p when no snapping was done
function snapToNails(p, excludedLine) {
    var radius = 10;

    var nails1 = lineData.flatMap(function(line) {
        if (line !== excludedLine)
            return [line.p1, line.p2];
        return [];
    });

    var nails2 = fanData.flatMap(function(fan) {
        // exclude all nails that lie on the excludedLine
        // all nails on line1 of a fan are "p1", so only include "p2"
        var side = null;
        if (fan.line1 === excludedLine)
            side = "p2";
        else if (fan.line2 === excludedLine)
            side = "p1"
    
        return fan.strings().flatMap(function(line) {
            if (side)
                return [line[side]];
            else
                return [line.p1, line.p2];
        });
    });

    var closestNail = p.closestPoint(nails1.concat(nails2));
    if (closestNail && p.minus(closestNail).length() < radius) {
        return closestNail.clone(); // ahhhh y u no did immutable
    }
    return p;
}

// lineStart: the starting point of line ending in p
// returns p when no snapping was done
function snapToLength(p, lineStart, length) {
    var radius = 20;
    var delta = p.minus(lineStart);
    var curLineLength = delta.length();

    if (Math.abs(length - curLineLength) < radius) {
        // stretch the line
        return lineStart.plus(delta.times(length / curLineLength));
    }
    return p;
}

// priorize snapping to nails
// lineStart: the starting point of line ending in p
// returns p when no snapping was done
function snap(p, excludedLine, lineStart, nailDistance) {
    var snap1 = snapToNails(p, excludedLine);

    // snap to selected line length
    // but not when the excluded line (i.e. the one being changed) is the selected one
    if (selection instanceof Line && selection !== excludedLine) {
        var length = selection.p1.minus(selection.p2).length();
    }
    // no line selected, 
    // snap to multiples of nailDistance
    // hmmm, only when not in circleDrag?
    else {
        var curLineLength = p.minus(lineStart).length();
        var length = Math.round(curLineLength / nailDistance) * nailDistance;
    }
    var snap2 = snapToLength(p, lineStart, length);

    // actually snapped to a nail
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
    if (selection)
        updatePropertyBox(selection);
}

// create and update the lines representing the nails
function updateLines() {
    // group for the lines
    var lines = svg.select("g#lines").selectAll("line")
        .data(lineData);
    lines.enter().append("line");
    lines.exit().remove();
    // enter+update
    lines.attr(lineAttrs)
        .classed("selected", function(d) { return d.selected; });
    
    // dragging circles are in a separate group so that they are always on top
    // of the rest of the svg elements
    // they are additionaly grouped in pairs
    var groups = svg.select("g#circles").selectAll("g")
        .data(lineData);
    groups.enter().append("g")
    groups.exit().remove();

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
    var fans = svg.select("g#fans").selectAll("g.fan")
        .data(fanData);

    var fansEnter = fans.enter().append("g")
        .classed("fan", true);
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

// populate the property box to reflect current selection
function updatePropertyBox(lineOrFan) {
    if (lineOrFan instanceof Line) {
        var props = lineProps;
        var idSuffix = "line";
    }
    else {
        var props = fanProps;
        var idSuffix = "fan";
    }
    props.forEach(function(prop, accessors) {
        d3.select("#" + idSuffix + "-" + prop).property("value", accessors.get(lineOrFan));
    })
}

// property: setter
var lineProps = d3.map({
    x1: {set: function(line, val) { val = Number(val); line.p1.x = val; },
         get: function(line) { return Math.round(line.p1.x); }},
    y1: {set: function(line, val) { val = Number(val); line.p1.y = val; },
         get: function(line) { return Math.round(line.p1.y); }},
    x2: {set: function(line, val) { val = Number(val); line.p2.x = val; },
         get: function(line) { return Math.round(line.p2.x); }},
    y2: {set: function(line, val) { val = Number(val); line.p2.y = val; },
         get: function(line) { return Math.round(line.p2.y); }},
    length: {
        set: function(line, val) {
            val = Number(val);
            var delta = line.p2.minus(line.p1);
            line.p2 = line.p1.plus(Vector.fromPolar(val, line.angle()));
        },
        get: function(line) { return Math.round(line.length()); }},
    angle: {
        set: function(line, val) {
            val = Number(val);
            var delta = line.p2.minus(line.p1);
            line.p2 = line.p1.plus(Vector.fromPolar(delta.length(), val));
        },
        get: function(line) { return Math.round(line.angle()*10)/10; }}
});
var fanProps = d3.map({
    color: {
        set: function(fan, val) {
            fan.color = val;
        },
        get : function(fan) { return fan.color; }
    },
    strokeWidth: {
        set: function(fan, val) {
            val = Number(val);
            if (val >= 0)
                fan.strokeWidth = val;
        },
        get: function(fan) { return fan.strokeWidth; }
    },
    numNails: {
        set: function(fan, val) {
            val = Number(val);
            if (val >= 2)
                fan.numNails = val;
        },
        get: function(fan) { return fan.numNails; }
    }
});

function attachPropHandlers(type, props) {
    var idSuffix = (type === Line) ? "line" : "fan";
    props.forEach(function(prop, accessors) {
        d3.select("#" + idSuffix + "-" + prop).on("input", function() {
            if (!(selection instanceof type))
                return;
            if (this.value) {
                accessors.set(selection, this.value);
                update();
            }
        });
    });
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

// changes the z-position of the selected Line/Fan
function moveSelection(dir) {
    if (selection instanceof Line)
        var data = lineData;
    else if (selection instanceof Fan)
        var data = fanData;
    else
        return;

    var pos = data.indexOf(selection);
    console.assert(pos !== -1);

    var newPos = pos + dir;
    if (newPos < 0 || newPos >= data.length)
        return

    // remove at old position
    data.splice(pos, 1);
    // insert at new one
    data.splice(newPos, 0, selection);
    update();
}


////////////
// saving

function save() {
    unselect(); // set "selected" properties to false
    update();
    var json = JSON.stringify({"lineData": lineData, "fanData": fanData}, function(k, v) {
        // also save the type of the object to serialize, in order to cast to it when loading
        if (!(v instanceof Array) && (v.constructor.name !== "Object")) {
            v.type = v.constructor.name;
        }

        // Lines inside a Fan object get serialized as an index into the lineData array
        // (could be generalized to make all duplicate objects point be the same object again when loading)
        // "this" is the object containing the current key/value pair
        if ((this instanceof Fan) && (v instanceof Line)) {
            return lineData.indexOf(v);
        }
        return v;
    });
    
    saveToFile(json, "stringart.txt");
}

function saveToFile(text, filename) {
    var a = document.createElement("a");
    var file = new Blob([text], {type: "text/plain"});
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
}

// eventhandler after clicking load button
function loadFromFile() {
    var file = event.target.files[0];
    // user hit cancel etc
    if (!file)
        return;

    var reader = new FileReader();
    reader.onload = function() {
        load(event.target.result);
    }
    reader.readAsText(file);
}

function load(jsonString) {
    var json = JSON.parse(jsonString, function(k, v) {
        // cast objects back to our types again
        if (v.type) {
            var constructor = window[v.type];
            console.assert(constructor);
            delete v.type;

            var obj = Object.create(constructor.prototype);
            _.extendOwn(obj, v);
            return obj;
        }
        return v;
    });

    lineData = json.lineData;
    fanData = json.fanData.map(function(fan) {
        fan.line1 = lineData[fan.line1];
        fan.line2 = lineData[fan.line2];
        return fan;
    });

    update();
}


////////////
// main

var lineData = []; // array of Line objects
var fanData = []; // array of Fan objects

var selection = null; // Fan, String or null
var mode = modeDraw;

var nailDistance = 20;

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

// handle property box changes
attachPropHandlers(Line, lineProps);
attachPropHandlers(Fan, fanProps);

update();
