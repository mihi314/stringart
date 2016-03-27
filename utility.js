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
Array.prototype.flatMap = function(lambda) { 
    return Array.prototype.concat.apply([], this.map(lambda));
};


function Vector(x, y) {
    this.x = x;
    this.y = y;
}
Vector.prototype.clone = function() {
    return new Vector(this.x, this.y);
}
Vector.prototype.eq = function(p) {
    return this.x === p.x && this.y === p.y;
}
Vector.prototype.plus = function(p) {
    return new Vector(this.x + p.x, this.y + p.y);
}
Vector.prototype.minus = function(p) {
    return new Vector(this.x - p.x, this.y - p.y);
}
Vector.prototype.times = function(factor) {
    return new Vector(this.x * factor, this.y * factor);
}
Vector.prototype.div = function(factor) {
    return new Vector(this.x / factor, this.y / factor);
}
Vector.prototype.length = function() {
    return Math.sqrt(this.x*this.x + this.y*this.y);
}
// angle to x-axis in degrees
Vector.prototype.angle = function() {
    return Math.atan2(this.y, this.x) / Math.Pi * 180;
}
// returns the closest point to this
// null if no points
Vector.prototype.closestPoint = function(points) {
    var minDist = Infinity;
    var minPoint = null;
    for (var i = 0; i < points.length; i++) {
        var dist = this.minus(points[i]).length();
        if (dist <= minDist) {
            minDist = dist;
            minPoint = points[i];
        }
    }
    return minPoint;
}
