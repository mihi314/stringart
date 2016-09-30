function Line(p1, p2) {
    // don't rely on p1 or p2 to stay the same object, may be replaced
    // (i.e. don't keep references to them)
    this.p1 = p1; // Vector, tail
    this.p2 = p2; // arrow
    // keep this side fixed when adjusting length/angle
    this.keepFixed = "p1";
}
Line.prototype.length = function() {
    return this.p2.minus(this.p1).length();
};
Line.prototype.angle = function() {
    return this.p2.minus(this.p1).angle();
};
Line.prototype.adjust = function(newLength, newAngle) {
    var delta = Vector.fromPolar(newLength, newAngle)
    if (this.keepFixed === "p1")
        this.p2 = this.p1.plus(delta);
    else
        this.p1 = this.p2.minus(delta);
};
Line.prototype.sideOf = function(p) {
    if (this.p1.eq(p))
        return "p1"
    if (this.p2.eq(p))
        return "p2"
    return null;
};

function Fan(line1, line2) {
    // reference to lines in lineData
    // keep the objects the same
    this.line1 = line1; 
    this.line2 = line2;
    this.color = "#2d8923"
    this.strokeWidth = 1;
    this.numNails = 20;
}
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
                newFan.color = lastColor;
                newFan.numNails = Math.max(Math.round(newFan.line1.length() / nailDistance + 1), 2);
                fanData.push(newFan);
            }

            // then select the new line (to see its properties while moving)
            select(newLine);
        }
        // finish current line
        else {
            this.updatingLine = false;
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

    // deselect
    svgClick: function() {
        deselect();
        update();
    },

    mousemove: function(){},

    // select fan
    fanClick: function(d, elem) {
        d3.event.stopPropagation();
        select(d3.select(elem.parentNode.parentNode).datum());
        update();
    },

    // select line
    // d: {line, side}
    circleClick: function(d, elem) {
        d3.event.stopPropagation();

        // select corresponding line
        select(this.nextLineInStack(d.line[d.side], selection));
        update();
    },

    // move line end around
    // d: {line, side}
    circleDrag: function(d, elem) {
        var otherSide = d.side === "p1" ? "p2" : "p1";

        var snapped = snap(new Vector(d3.event.x, d3.event.y), d.line, d.line[otherSide], nailDistance);
        d.line[d.side] = snapped;
        update();
    },

    // returns the line one below currentLine (wraps around)
    // currentLine can be any object
    nextLineInStack: function(point, currentLine) {
        // find all lines which endpoints are stacked at the clicked circle
        var stackedLines = lineData.filter(function(line, i) {
            return line.sideOf(point) !== null;
        });
        console.assert(stackedLines.length > 0);

        var stackPos = stackedLines.indexOf(currentLine);
        if (stackPos == -1)
            var line = stackedLines[0]
        else
            var line = stackedLines[(stackPos+1) % stackedLines.length]

        return line;
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

    if (curLineLength == 0) {
        // p and lineStart are the same, can't determine a direction to stretch in
        return p;
    }

    if (Math.abs(length - curLineLength) < radius) {
        // stretch the line
        return lineStart.plus(delta.times(length / curLineLength));
    }
    return p;
}

// prioritize snapping to nails
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
    saveToLocalStorage();
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
        .classed("selected", isSelected);


    // circles for dragging and selecting in selection mode

    // dragging circles are in a separate group so that they are always on top
    // of the rest of the svg elements
    // they are additionally grouped in pairs
    var groups = svg.select("g#circles").selectAll("g")
        .data(lineData, function(d) { return Object.id(d); });
    groups.enter().append("g")
    groups.exit().remove();

    // sorting to move the circles of the selected line to the top, 
    // which is then prioritized when dragging (when multiple circles 
    // are stacked on top of each other)
    // the key function above is needed for this to work
    groups.sort(function(line1, line2) {
        if (isSelected(line1))
            return 1;
        if (isSelected(line2))
            return -1; 
        return 0;
    });

    var drag = d3.behavior.drag()
        .on("drag", function(d) {
            d3.event.sourceEvent.stopPropagation();
            mode.circleDrag(d, this);
        });

    var circles = groups.selectAll("circle")
        .data(function(d) { return [{line: d, side: "p1"}, {line: d, side: "p2"}] });
    circles.enter().append("circle")
        .call(drag)
        .on("click", function(d) {
            if (d3.event.defaultPrevented)
                return; // click already suppressed
            mode.circleClick(d, this);
        })
    circles.exit().remove();
    circles.attr("cx", function(d) { return d.line[d.side].x; })
           .attr("cy", function(d) { return d.line[d.side].y; });
}
function moveToEnd(array, elem) {
    var pos = array.indexOf(elem);
    if (pos !== -1) {
        array.splice(pos, 1);
        array.push(elem);
    }
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
        .attr("stroke-width", function(d) { return d.strokeWidth * (isSelected(d) ? 1.5 : 1); });

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
            if (d3.event.defaultPrevented)
                return; // click already suppressed
            mode.fanClick(d, this);
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
        $("#" + idSuffix + "-" + prop).val(accessors.get(lineOrFan));
    })
}

// accessors for updating line and fan properties via the properties box
var lineProps = d3.map({
    x1: {event: "input",
         set: function(line, val) { val = Number(val); line.p1.x = val; },
         get: function(line) { return Math.round(line.p1.x); }},
    y1: {event: "input",
         set: function(line, val) { val = Number(val); line.p1.y = val; },
         get: function(line) { return Math.round(line.p1.y); }},
    x2: {event: "input",
         set: function(line, val) { val = Number(val); line.p2.x = val; },
         get: function(line) { return Math.round(line.p2.x); }},
    y2: {event: "input",
         set: function(line, val) { val = Number(val); line.p2.y = val; },
         get: function(line) { return Math.round(line.p2.y); }},
    length: {
        event: "input",
        set: function(line, val) { line.adjust(Number(val), line.angle()); },
        get: function(line) { return Math.round(line.length()); }},
    angle: {
        event: "input",
        // take the negative angle values, in order to make it more intuitive
        set: function(line, val) { line.adjust(line.length(), -Number(val)); },
        get: function(line) { return -Math.round(line.angle()*10)/10; }},
    keepFixedTail: {
        event: "change",
        set: function(line, val) { line.keepFixed = "p1"; },
        get: function(line) { return line.keepFixed === "p1" ? ["on"] : ["off"] }
    },
    keepFixedArrow: {
        event: "change",
        set: function(line, val) { line.keepFixed = "p2"; },
        get: function(line) { return line.keepFixed === "p2" ? ["on"] : ["off"] }
    }
});
var fanProps = d3.map({
    color: {
        event: "input",
        set: function(fan, val) {
            fan.color = val;
        },
        get : function(fan) {
            lastColor = fan.color;
            return fan.color;
        }
    },
    strokeWidth: {
        event: "input",
        set: function(fan, val) {
            val = Number(val);
            if (val >= 0)
                fan.strokeWidth = val;
        },
        get: function(fan) { return fan.strokeWidth; }
    },
    numNails: {
        event: "input",
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
        d3.select("#" + idSuffix + "-" + prop).on(accessors.event, function() {
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
    selection = primitive;
}

function deselect() {
    selection = null;
}

function isSelected(primitive) {
    return selection === primitive;
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

// eventhandler after clicking save button
function saveButtonHandler() {
    saveToFile(serializeToJSON(), "stringart.txt");
}

// eventhandler after clicking load button
function loadButtonHandler() {
    var file = event.target.files[0];
    // user hit cancel etc
    if (!file)
        return;

    var reader = new FileReader();
    reader.onload = function() {
        deserializeFromJSON(event.target.result);
        update();
    }
    reader.readAsText(file);
}

function clearButtonHandler() {
    lineData = [];
    fanData = [];
    deselect();
    update();
}

function saveToLocalStorage() {
    window.localStorage.setItem("lastState", serializeToJSON());
}

function loadFromLocalStorage() {
    var json = window.localStorage.getItem("lastState");
    if (json) {
        deserializeFromJSON(json);
        update();
    }
}

// serialization of the line and string data
function serializeToJSON() {
    var json = JSON.stringify({"lineData": lineData, "fanData": fanData}, function(k, v) {
        // also save the type of the object to serialize, in order to be able to cast to it when loading it again
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

    return json;
}

function deserializeFromJSON(jsonString) {
    var json = JSON.parse(jsonString, function(k, v) {
        // cast objects back to original types again
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
}

function saveToFile(text, filename) {
    var a = document.createElement("a");
    var file = new Blob([text], {type: "text/plain"});
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
}



////////////
// main

var lineData = []; // array of Line objects
var fanData = []; // array of Fan objects

var selection = null; // Fan, String or null
var mode = modeDraw;

var nailDistance = 20;
var lastColor = "#2d8923";

var svg = d3.select("svg")
    .on("click", function() {
        if (d3.event.defaultPrevented)
            return; // click already suppressed
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
                deselect();
                update();
            }
            else if (selection instanceof Fan) {
                fanData.remove(selection);
                deselect();
                update();
            }
        }
        // esc key
        else if (d3.event.keyCode === 27) {
            deselect();
            update();
        }
    });

// handle property box changes
attachPropHandlers(Line, lineProps);
attachPropHandlers(Fan, fanProps);

loadFromLocalStorage();
update();
