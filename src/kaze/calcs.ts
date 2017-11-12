import _ = require('lodash');

export class Rect {
    constructor(public size: Vec2d, public position: Vec2d) {}

    get x2(): number { return this.position.x + this.size.x; }
    get y2(): number { return this.position.y + this.size.y; }
    get discreteX2(): number { return Math.ceil(this.x2) - 1; }
    get discreteY2(): number { return Math.ceil(this.y2) - 1; }

    collidesWith(other: Rect): boolean {
        return !(
            this.position.y > other.y2 || other.position.y > this.y2 ||
            this.position.x > other.x2 || other.position.x > this.x2
        );
    }

    containsVec(other: Vec2d): boolean {
        return !(
            other.x > this.x2 || other.x < this.position.x || 
            other.y > this.y2 || other.y < this.position.y
        );
    }
}

export class Vec2d {
    constructor(public x: number, public y: number) {}

    static copy(other: Vec2d): Vec2d {
        return new Vec2d(other.x, other.y);
    }

    swap(): Vec2d {
        const temp = this.x;
        this.x = this.y;
        this.y = temp;
        return this;
    }

    add(other: Vec2d): Vec2d {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtract(other: Vec2d): Vec2d {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    mult(m: number): Vec2d {
        this.x *= m;
        this.y *= m;
        return this;
    }

    getMagnitude(): number {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }

    normalize(): Vec2d {
        const magnitude = this.getMagnitude();
        if (magnitude === 0) {
            this.mult(0);
        } else {
            this.mult(1 / magnitude);
        }
        return this;
    }

    magnitude(m: number): Vec2d {
        this.normalize();
        this.mult(m);
        return this;
    }

    rotate(radians: number): Vec2d {
        const x = this.x * Math.cos(radians) - this.y * Math.sin(radians);
        const y = this.x * Math.sin(radians) + this.y * Math.cos(radians);
        this.x = x;
        this.y = y;
        return this;
    }

    atan2(): number {
        return Math.atan2(this.y, this.x);
    }

    static dot(a: Vec2d, b: Vec2d): number {
        return a.x * b.x + a.y * b.y;
    }

    static angleBetween(a: Vec2d, b: Vec2d): number {
        const am = a.getMagnitude();
        const bm = b.getMagnitude();
        if (am === 0 || bm === 0) return 0;
        let inner = Vec2d.dot(a, b) / (am * bm);
        if (inner > 1) inner = 1;
        if (inner < -1) inner = -1;
        return Math.acos(inner);
    }

    static add(a: Vec2d, b: Vec2d): Vec2d {
        const result = Vec2d.copy(a);
        result.add(b);
        return result;
    }

    static subtract(a: Vec2d, b: Vec2d): Vec2d {
        const result = Vec2d.copy(a);
        result.subtract(b);
        return result;
    }

    static mult(a: Vec2d, m: number): Vec2d {
        const result = Vec2d.copy(a);
        result.mult(m);
        return result;
    }

    static magnitude(a: Vec2d, m: number): Vec2d {
        const result = Vec2d.copy(a);
        result.magnitude(m);
        return result;
    }

    static normalize(a: Vec2d): Vec2d {
        return Vec2d.magnitude(a, 1);
    }
};

export const aimbot = 
    (source: Vec2d, target: Vec2d, sourceVelocity: Vec2d, bulletSpeed: number): Vec2d => {
    const diff = Vec2d.subtract(source, target);
    const c = Math.pow(diff.x, 2) + Math.pow(diff.y, 2);
    const b = 2 * diff.x * sourceVelocity.x + 2 * diff.y * sourceVelocity.y;
    const a = Math.pow(sourceVelocity.x, 2) + Math.pow(sourceVelocity.y, 2) - Math.pow(bulletSpeed, 2);
    const d = Math.sqrt(Math.pow(b, 2) - 4 * a * c);
    let t = (-b - d) / (2 * a);
    if (t < 0) t = (-b + d) / (2 * a);
    return new Vec2d(diff.x + t * sourceVelocity.x, diff.y + t * sourceVelocity.y);
};

export const timeToHit = (a: number, b: number, aSpeed: number, bSpeed: number): number => {
    const speedDiff = aSpeed - bSpeed;
    if (speedDiff === 0) return a === b ? 0 : -1;
    const time = (b - a) / speedDiff;
    if (time < 0) return -1;
    return time;
};

export const timeToHitRect =
    (dot: Vec2d, dotVelocity: Vec2d, rect: Rect, recVelocity: Vec2d): number => {

    // Collision interval for each axis, always x < y
    const xt = new Vec2d(
        timeToHit(dot.x, rect.position.x, dotVelocity.x, recVelocity.x),
        timeToHit(dot.x, rect.x2, dotVelocity.x, recVelocity.x)
    );
    const yt = new Vec2d(
        timeToHit(dot.y, rect.position.y, dotVelocity.y, recVelocity.y),
        timeToHit(dot.y, rect.y2, dotVelocity.y, recVelocity.y)
    );

    // If any interval doesn't exist, will never collide
    if (xt.x === -1 && xt.y === -1) return -1;
    if (yt.x === -1 && yt.y === -1) return -1;

    // Preprocess -1 to 0 to create valid collision intervals (think about x or y = 0 case)
    if (xt.x === -1) xt.x = 0;
    else if (xt.y === -1) xt.y = 0;
    if (yt.x === -1) yt.x = 0;
    else if (yt.y === -1) yt.y = 0;

    // Make it so that x < y always
    if (xt.y < xt.x) xt.swap();
    if (yt.y < yt.x) xt.swap();

    // If no overlap, then will never collide
    if (xt.x > yt.y || yt.x > xt.y) return -1;

    // If overlap, then pick the 2nd biggest along timeline (visualize)
    return Math.max(xt.x, yt.x);
};

export const posOnReverse = (
    a: Vec2d,
    aVelocity: Vec2d, 
    accel: number,
    maxSpeed: number,
    timeToArrive: number
): Vec2d => {

    const currentSpeed = aVelocity.getMagnitude();
    if (currentSpeed === 0) return Vec2d.copy(a);
    const timeToZero = currentSpeed / accel; 
    const timeToMax = maxSpeed / accel;
    const nx = aVelocity.x / currentSpeed;
    const ny = aVelocity.y / currentSpeed;
    const b = new Vec2d(0, 0);

    if (timeToArrive < timeToZero) {
        b.x = currentSpeed / 2 * nx * timeToArrive + a.x;
        b.y = currentSpeed / 2 * ny * timeToArrive + a.y;
    } else if (timeToArrive < timeToZero + timeToMax) {
        b.x = currentSpeed / 2 * nx * timeToZero + a.x;
        b.y = currentSpeed / 2 * ny * timeToZero + a.y;
        b.x += maxSpeed / 2 * -nx * (timeToArrive - timeToZero);
        b.y += maxSpeed / 2 * -ny * (timeToArrive - timeToZero);
    } else {
        b.x = currentSpeed / 2 * nx * timeToZero + a.x;
        b.y = currentSpeed / 2 * ny * timeToZero + a.y;
        b.x += maxSpeed / 2 * -nx * timeToMax;
        b.y += maxSpeed / 2 * -ny * timeToMax;
        b.x += maxSpeed * -nx * (timeToArrive - timeToMax - timeToZero);
        b.y += maxSpeed * -ny * (timeToArrive - timeToMax - timeToZero);
    }

    return b;
};

export const lerp = (a: Vec2d, b: Vec2d, t: number): Vec2d => {
    return new Vec2d(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

// https://en.wikipedia.org/wiki/Slerp
// TODO - Practical 180 degree case...
export const slerp = (a: Vec2d, b: Vec2d, t: number): Vec2d => {
    const angle = Vec2d.angleBetween(a, b); // [0, Math.PI] (Math.acos definition)
    if (angle === 0 || angle === Math.PI) return lerp(a, b, t);
    const angleSin = Math.sin(angle);
    const t1 = Math.sin((1 - t) * angle) / angleSin;
    const t2 = Math.sin(t * angle) / angleSin;
    const t1x = t1 * a.x;
    const t1y = t1 * a.y;
    const t2x = t2 * b.x;
    const t2y = t2 * b.y;
    return new Vec2d(t1x + t2x, t1y + t2y);
};

// https://en.wikipedia.org/wiki/Cubic_Hermite_spline
export const hermite = (a: Vec2d, b: Vec2d, aVelocity: Vec2d, bVelocity: Vec2d, t: number): Vec2d => {

    // 4 coefficients
    const t1 = 2 * Math.pow(t, 3) - 3 * Math.pow(t, 2) + 1;
    const t2 = Math.pow(t, 3) - 2 * Math.pow(t, 2) + t;
    const t3 = -2 * Math.pow(t, 3) + 3 * Math.pow(t, 2);
    const t4 = Math.pow(t, 3) - Math.pow(t, 2);

    // 4 2d vectors
    const t1x = t1 * a.x;
    const t1y = t1 * a.y;
    const t2x = t2 * aVelocity.x;
    const t2y = t2 * aVelocity.y;
    const t3x = t3 * b.x;
    const t3y = t3 * b.y;
    const t4x = t4 * bVelocity.x;
    const t4y = t4 * bVelocity.y;

    return new Vec2d(t1x + t2x + t3x + t4x, t1y + t2y + t3y + t4y);
};

const factorial_ = (k: number): number => {
    return k === 0 ? 1 : k * factorial_(k - 1);
};

export const factorial = (k: number): number => factorial_(Math.floor(k));

// https://en.wikipedia.org/wiki/Poisson_distribution
export const poissonCdf = (lambda: number, k: number): number => {
    k = Math.floor(k);
    const a = Math.pow(Math.E, -lambda);
    let sum = 0;
    for (let i = 0; i < k; ++i) { // Approximate, curves off around here
        sum += Math.pow(lambda, i) / factorial(i);
    }
    return a * sum;
};

export const funcToMap = (func: (i: number) => number, start: number, end: number, increment: number)
    : Map<number, number> => {
    const map = new Map<number, number>();
    for (let i = start; i <= end; i += increment) {
        map.set(i, func(i));
    }
    return map;
};
