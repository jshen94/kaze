// TODO - Speed up even when below half...

//////////////////////////////////////////////////
// Interpolates between server state snapshots
// Only supports TCP
//////////////////////////////////////////////////

import _ = require('lodash');
import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;

export class InterpolatedSnapshot<T> {
    constructor(public position: Vec2d, public aim: Vec2d, public other: T) {}
}

export class Snapshot<T> {
    constructor(
        public position: Vec2d,
        public velocity: Vec2d,
        public aim: Vec2d,
        public dist: number, // Time in ms from first snapshot saved, server time
        public distToPrev: number, // Time in ms to last snapshot, server time
        public other: T) {}
}

export class Interpolator<T> {
    private snapshots: Snapshot<T>[] = [];

    constructor(readonly max: number) {
        console.assert(max >= 2, 'invalid max for interpolator');
    }

    // The snapshot index immediately beyond *t*
    private getNextSnapshotIndex(t: number): number {
        if (this.snapshots.length === 1) {
            return 0;
        } else {
            for (let i = 1; i < this.snapshots.length; ++i) {
                if (t < this.snapshots[i].dist) return i;
            }
            return this.snapshots.length - 1;
        }
    }

    // Shift all snapshots down until first has t = 0
    // Returns amount shifted
    private normalize(): number {
        if (this.snapshots.length > 0) {
            const firstDist = this.snapshots[0].dist;
            for (let i = 1; i < this.snapshots.length; ++i) {
                this.snapshots[i].dist -= firstDist;
            }
            return firstDist;
        } else {
            return 0;
        }
    }

    // Dequeues up to *index*, keeping the first snapshot at t = 0
    // Returns amount shifted
    private shift(index: number): number {
        this.snapshots.splice(0, index + 1);
        return this.normalize();
    }

    get length(): number {return this.snapshots.length;}

    // Add new snapshot
    push(x: number, y: number, vx: number, vy: number, aim: Vec2d, distToPrev: number, other: T): void {
        if (this.snapshots.length >= this.max) {
            console.log('warning: interpolate buffer full - discarding snapshots');
            this.shift(0);
        }
        const dist = this.snapshots.length === 0 ?  0 : ((_.last(this.snapshots) as Snapshot<T>).dist + distToPrev);
        this.snapshots.push(new Snapshot(new Vec2d(x, y), new Vec2d(vx, vy), aim, dist, distToPrev, other));
    }

    // Deletes all snapshots before *t* (because those already happened)
    // Returns new shifted *t*
    prune(t: number): number {
        if (this.snapshots.length === 0) return t;
        // Don't allow hopping way into the future, happens when debugger is paused
        t = Math.min(t, (_.last(this.snapshots) as Snapshot<T>).dist);
        const i = this.getNextSnapshotIndex(t);
        if (i >= 2) {
            const amountShifted = this.shift(i - 2);
            return t - amountShifted;
        } else { // Keep minimum 2 snapshots
            return t;
        }
    }

    // Interpolates position and rotation between snapshots
    // *t* - The time elapsed since the first snapshot (which has t = 0)
    // Returns a new interpolated snapshot
    interpolate(t: number): InterpolatedSnapshot<T> {
        if (this.snapshots.length === 0) 'tried to interpolate with 0 snapshots';
        if (t < 0) throw 't < 0';
        if (this.snapshots.length === 1) {
            const first = this.snapshots[0];
            return new InterpolatedSnapshot<T>(first.position, first.aim, first.other);
        } else {
            const i = this.getNextSnapshotIndex(t);
            const a = this.snapshots[i - 1];
            const b = this.snapshots[i];
            if (t < b.dist)  {
                const timeFraction = (t - a.dist) / b.distToPrev;
                const location = Calcs.hermite(a.position, b.position, a.velocity, b.velocity, timeFraction);
                const rotation = Calcs.slerp(a.aim, b.aim, timeFraction); // Assume |a| = |b|
                // For uninterpolated fields, use the old version (a) instead of (b)
                return new InterpolatedSnapshot<T>(location, rotation, a.other);
            } else {
                // Stay at last snapshot if requested time is beyond what's recorded
                const last = _.last(this.snapshots) as Snapshot<T>;
                return new InterpolatedSnapshot<T>(last.position, last.aim, last.other);
            }
        }
    }
}
