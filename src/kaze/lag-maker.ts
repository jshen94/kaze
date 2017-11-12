//////////////////////////////////////////////////
// Simulates lag
//////////////////////////////////////////////////

import Calcs = require('./calcs');
import _ = require('lodash');

// Delays messages by *fixedDelay*, while keeping expected value
// of arrival at *averageFps*, distributed poisson. If messages 
// arrive too fast, or intentionally by setting *averageFps* slow,
// then dumps messages all at once if buffer size exceeds *queueMaxLength*>
export type LagMakerOptions<T> = {
    send: (data: T) => void;
    averageFps: number;
    fixedDelay: number;
    queueMaxLength?: number;
}

export class LagMaker<T> {
    private points: T[] = [];
    private poissonQueueId?: NodeJS.Timer;
    private averageDelay: number;
    private maxPoissonInput: number;
    private poissonMap: Map<number, number>;

    constructor(private options: LagMakerOptions<T>) {
        this.averageDelay = 1000 / options.averageFps;
        this.maxPoissonInput = 2 * this.averageDelay + 1; // @ 2 * lambda, poisson CDF is almost always at 1
        const withLambda = _.curry(Calcs.poissonCdf)(this.averageDelay);
        this.poissonMap = Calcs.funcToMap(withLambda, 0, this.maxPoissonInput, 1);
        if (!options.queueMaxLength) options.queueMaxLength = 10;
    }

    private drawPoisson(): number {
        const uniform = Math.random();
        for (let i = 0; i < this.maxPoissonInput; ++i) {
            const answer = this.poissonMap.get(i);
            if (answer === undefined) throw 'broken poisson map';
            if (uniform < answer) {
                return i;
            }
        }
        return this.maxPoissonInput;
    }

    private realSend(point: T): void {
        this.options.send(point);
    }

    private startPoissonQueue(delay: number): void {
        this.poissonQueueId = setTimeout(() => {
            if (this.points.length > 0) {
                const point = this.points.shift() as T;
                this.realSend(point);
                const delay = this.drawPoisson(); 
                if (this.points.length > (this.options.queueMaxLength as number)) {
                    console.log(`dumping ${this.points.length} points`);
                    this.points.forEach(this.realSend.bind(this));
                    this.points.splice(0);
                }
                this.startPoissonQueue(delay);
            } else {
                this.startPoissonQueue(0);
            }
        }, delay);
    }

    send = (data: T): void => { 
        setTimeout(() => this.points.push(data), this.options.fixedDelay);
    }

    start(): void {
        this.startPoissonQueue(0);
    }

    stop(): void {
        if (this.poissonQueueId !== undefined) {
            clearTimeout(this.poissonQueueId);
        }
    }

    static test(): void {
        const test = new LagMaker<number>({
            send: (i) => console.log(i),
            averageFps: 60,
            fixedDelay: 200
        });
        test.start();
        for (let i = 0; i < 30; ++i) test.send(i);
    }
}
