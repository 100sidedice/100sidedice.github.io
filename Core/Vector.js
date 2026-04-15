export default class Vector {
    // Compare this vector to another for equality
    equals(v) {
        return v && this.x === v.x && this.y === v.y;
    }
    // Encode a Vector to a simple array [x, y]
    static encode(v) {
        return [v.x, v.y];
    }

    // Decode an array [x, y] to a Vector
    static decode(arr) {
        if (!Array.isArray(arr) || arr.length < 2) return new Vector(0, 0);
        return new Vector(arr[0], arr[1]);
    }
    // Linearly interpolate between this and another vector
    lerp(v, t) {
        return new Vector(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t
        );
    }
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    encode() {
        return [this.x, this.y];
    }

    // Decode an array [x, y] to a Vector

    // ----- Immutable versions (return new vectors) -----
    clone() { return new Vector(this.x, this.y); }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(scalar,type='') {
        if (type === '') return new Vector(this.x * scalar, this.y * scalar);
        if (type === 'x') return new Vector(this.x * -1, this.y);
        if (type === 'y') return new Vector(this.x, this.y * -1);
    }
    div(scalar) {
        return scalar !== 0 ? new Vector(this.x / scalar, this.y / scalar) : new Vector(this.x, this.y);
    }
    scale(v){ return new Vector(this.x * v.x, this.y * v.y); }
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }
    round(){
        return new Vector(Math.round(this.x),Math.round(this.y))
    }
    roundS(){
        this.x = Math.round(this.x)
        this.y = Math.round(this.y)
        return this;
    }
    mod(value){
        return new Vector(this.x % value,this.y % value)
    }
    modS(value){
        this.x = this.x % value
        this.y = this.y % value
        return this;
    }
    floor(){
        return new Vector(Math.floor(this.x),Math.floor(this.y))
    }
    floorS(){
        this.x = Math.floor(this.x)
        this.y = Math.floor(this.y)
        return this;
    }
    max(scalar){
        return new Vector(Math.max(this.x,scalar),Math.max(this.y,scalar))
    }
    maxS(scalar){
        this.x = Math.max(this.x,scalar)
        this.y = Math.max(this.y,scalar)
        return this;
    }
    min(scalar){
        return new Vector(Math.min(this.x,scalar),Math.min(this.y,scalar))
    }
    minS(scalar){
        this.x = Math.min(this.x,scalar)
        this.y = Math.min(this.y,scalar)
        return this;
    }
    rotateS(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.x = this.x * cos - this.y * sin;
        this.y = this.x * sin + this.y * cos;
        return this;
    }
    addS(v,type='') { 
        if (type === '') { this.x += v.x; this.y += v.y; }
        if (type === 'x') this.x += v.x;
        if (type === 'y') this.y += v.y;
        return this; 
    }
    subS(v) { this.x -= v.x; this.y -= v.y; return this; }
    multS(scalar,type='') {
        if (type === '') { this.x *= scalar; this.y *= scalar; }
        if (type === 'x') this.x *= scalar;
        if (type === 'y') this.y *= scalar;
        return this;
    }
    divS(scalar) { if (scalar !== 0) { this.x /= scalar; this.y /= scalar; } return this; }
    scaleS(v){ this.x *= v.x; this.y *= v.y; return this; }
    rotateS(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x; this.y = y;
        return this;
    }


    flip() { return new Vector(this.y, this.x); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        let mag = this.mag();
        return mag !== 0 ? this.div(mag) : new Vector(this.x, this.y);
    }
    normalizeS() {
        let mag = this.mag();
        if (mag !== 0) { this.x /= mag; this.y /= mag; }
        return this;
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    angleTo(v1,v2){
        return Math.acos(v1.mult(v2).div(v1.mag()*v2.mag()))
    }
    cross(v) { return this.x * v.y - this.y * v.x; }
    distanceTo(v) { return Math.sqrt((v.x - this.x) ** 2 + (v.y - this.y) ** 2); }

    // ----- Static helpers -----
    static add(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y); }
    static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    static zero() { return new Vector(0, 0); }
    static one() { return new Vector(1, 1); }

    /**
     * Evaluate a simple expression against each component and return a new Vector.
     * Expression can use `this` to refer to the component value and the
     * helper functions: round(), floor(), max(a,b), min(a,b).
     * Allowed operators: + - * / % and parentheses.
     * Example: v.math('this*round(121/2)')
     */
    math(expr) {
        const evalComp = (comp) => {
            if (typeof expr !== 'string') throw new Error('math: expr must be a string');
            // basic sanitization: remove allowed identifiers and ensure no other letters remain
            const stripped = expr.replace(/\bthis\b/g, '')
                                  .replace(/\bround\b/g, '')
                                  .replace(/\bfloor\b/g, '')
                                  .replace(/\bmax\b/g, '')
                                  .replace(/\bmin\b/g, '')
                                  .replace(/\bsign\b/g, '')
                                  .replace(/\babs\b/g, '')
                                  .replace(/\bceil\b/g, '')
                                  .replace(/\bclamp\b/g, '');
            // build a RegExp safely (avoid unescaped '/' in literal). Allow digits, operators, parentheses, dot, comma and whitespace.
            const invalidCharRe = new RegExp(`[^0-9+\\-*/%().,\\s]`);
            if (invalidCharRe.test(stripped)) {
                throw new Error('math: expression contains disallowed characters');
            }

            // replace `this` with the variable name used in the sandbox
            const code = expr.replace(/\bthis\b/g, 'thisVal');

            // build a small sandboxed function with only allowed helpers
            const clampFunc = (v, a, b) => Math.max(a, Math.min(b, v));
            const fn = new Function('thisVal', 'round', 'floor', 'max', 'min', 'sign', 'abs', 'ceil', 'clamp', `return (${code});`);
            // call with Math helpers and clamp
            return Number(fn(comp, Math.round, Math.floor, Math.max, Math.min, Math.sign, Math.abs, Math.ceil, clampFunc));
        };

        const nx = evalComp(this.x);
        const ny = evalComp(this.y);
        return new Vector(nx, ny);
    }

    /**
     * In-place variant of math(expr). Modifies this vector and returns it.
     */
    mathS(expr) {
        const res = this.math(expr);
        this.x = res.x;
        this.y = res.y;
        return this;
    }
}
export function v(x,y){
    return new Vector(x,y)
}