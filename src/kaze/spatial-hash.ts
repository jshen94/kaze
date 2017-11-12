import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;

export class Rect extends Calcs.Rect {
    constructor(public id: number, size: Vec2d, position: Vec2d) {
        super(size, position);
    }
}

export class Dot {
    constructor(public id: number, public position: Vec2d) {}
}

export class Block {
    readonly dots: Map<number, Dot> = new Map<number, Dot>();
    readonly rects: Map<number, Rect> = new Map<number, Rect>();

    constructor(public readonly isFake: boolean = false) {}

    isEmpty(): boolean {
        return this.dots.entries().next().done && this.rects.entries().next().done;
    }

    forEachDotCollideWithRect(dot: Dot, isFinished: (rect: Rect) => boolean) {
        for (let rect of this.rects.values()) {
            if (rect.containsVec(dot.position)) {
                if (isFinished(rect)) return true;
            }
        };
        return false;
    }

    forEachRectCollideWithRect (rect: Rect, isFinished: (rect: Rect) => boolean) {
        for (let otherRect of this.rects.values()) {
            if (rect.collidesWith(otherRect)) {
                if (isFinished(rect)) return true;
            }
        };
        return false;
    }
}

export const getShKey = (bx: number, by: number): string => {
    return bx + ',' + by;
};

export class SpatialHash {
    readonly pixelWidth: number | null; 
    readonly pixelHeight: number | null;
    readonly all: Block = new Block;
    readonly fakeBlock: Block = new Block(true);
    readonly blocks: Map<string, Block> = new Map<string, Block>();

    constructor(
        public readonly blockWidth: number | null, // Null - infinite map
        public readonly blockHeight: number | null,
        public readonly blockLength: number) 
    {
        this.pixelWidth = blockWidth !== null ? blockWidth * blockLength : null;
        this.pixelHeight = blockHeight !== null ? blockHeight * blockLength : null;
    }

    getBlock(bx: number, by: number, isReading: boolean): Block {
        const key = getShKey(bx, by);
        if (this.blocks.has(key)) {
            return this.blocks.get(key) as Block;
        } else {
            if (isReading) {
                return this.fakeBlock;
            } else {
                const newBlock = new Block;
                this.blocks.set(key, newBlock);
                return newBlock;
            }
        }
    }

    isRectOutside(rect: Rect): boolean {
        if (this.pixelWidth !== null && (rect.position.x < 0 || rect.x2 >= this.pixelWidth)) return true; 
        if (this.pixelHeight !== null && (rect.position.y < 0 || rect.y2 >= this.pixelHeight)) return true; 
        return false;
    }

    isDotOutside(dot: Dot): boolean {
        if (this.pixelWidth && (dot.position.x < 0 || dot.position.x >= this.pixelWidth)) return true; 
        if (this.pixelHeight && (dot.position.y < 0 || dot.position.y >= this.pixelHeight)) return true;
        return false;
    }

    isBlockOutside(v: Vec2d): boolean {
        if (this.blockWidth && (v.x < 0 || v.x >= this.blockWidth)) return true; 
        if (this.blockHeight && (v.y < 0 || v.y >= this.blockHeight)) return true;
        return false;
    }

    pixelToBlock(x: number, y: number): Vec2d {
        return new Vec2d(Math.floor(x / this.blockLength), Math.floor(y / this.blockLength));
    }

    didBlockChange(x: number, y: number, newX: number, newY: number): boolean {
        const before = this.pixelToBlock(x, y);
        const after = this.pixelToBlock(newX, newY);
        return before.x !== after.x || before.y !== after.y;
    }

    didDotChangeBlock(dot: Dot, newX: number, newY: number): boolean {
        return this.didBlockChange(dot.position.x, dot.position.y, newX, newY);
    }

    didRectChangeBlock(rect: Rect, newX: number, newY: number): boolean {
        return this.didBlockChange(rect.position.x, rect.position.y, newX, newY) || 
            this.didBlockChange(
                rect.discreteX2, rect.discreteY2, 
                Math.ceil(newX + rect.size.x) - 1, Math.ceil(newY + rect.size.y) - 1);
    }

    editRect(rect: Rect, newX: number, newY: number): boolean {
        const needBlockMove = this.didRectChangeBlock(rect, newX, newY);
        if (needBlockMove) this.removeRect(rect.id);
        rect.position.x = newX;
        rect.position.y = newY;
        if (needBlockMove) this.addRect(rect);
        return needBlockMove;
    }

    editDot(dot: Dot, newX: number, newY: number): boolean {
        const needBlockMove = this.didDotChangeBlock(dot, newX, newY);
        if (needBlockMove) this.removeDot(dot.id);
        dot.position.x = newX;
        dot.position.y = newY;
        if (needBlockMove) this.addDot(dot);
        return needBlockMove;
    }

    forEachRect(func: (rect: Rect) => void): void {
        this.all.rects.forEach(func);
    }

    forEachDot(func: (dot: Dot) => void): void {
        this.all.dots.forEach(func);
    }

    private handleEmptyBlock(block: Block, bx: number, by: number): void {
        if (block.isEmpty() && !block.isFake) {
            this.blocks.delete(getShKey(bx, by));
        }
    }

    loopDot(dot: Dot, isReading: boolean, func: (block: Block, bx: number, by: number) => void) {
        const b = this.pixelToBlock(dot.position.x, dot.position.y);
        if (this.isBlockOutside(b)) return;
        const block = this.getBlock(b.x, b.y, isReading);
        func(block, b.x, b.y);
        if (!isReading) this.handleEmptyBlock(block, b.x, b.y);
    }

    loop(bx1: number, by1: number, bx2: number, by2: number,
        isReading: boolean, isFinished: (block: Block, bx: number, by: number) => boolean): boolean {

        if (this.blockWidth !== null && bx1 < 0) bx1 = 0;
        if (this.blockHeight !== null && by1 < 0) by1 = 0;
        if (this.blockWidth !== null && bx2 >= this.blockWidth) bx2 = this.blockWidth - 1;
        if (this.blockHeight !== null && by2 >= this.blockHeight) by2 = this.blockHeight - 1;

        for (let i = bx1; i <= bx2; ++i) {
            for (let j = by1; j <= by2; ++j) {
                const block = this.getBlock(i, j, isReading);
                const leave = isFinished(block, i, j); // Processing happens inside inFinished
                if (!isReading) this.handleEmptyBlock(block, i, j);
                if (leave) return true; // True -> Break loop flag
            }
        }

        return false;
    }

    loopPixels(x1: number, y1: number, x2: number, y2: number,
        isReading: boolean, isFinished: (block: Block, bx: number, by: number) => boolean): boolean {
        const a = this.pixelToBlock(x1, y1);
        const b = this.pixelToBlock(x2, y2);
        return this.loop(a.x, a.y, b.x, b.y, isReading, isFinished);
    }

    loopRect(rect: Rect, isReading: boolean, 
        isFinished: (block: Block, bx: number, by: number) => boolean): boolean {
        return this.loopPixels(rect.position.x, rect.position.y, rect.discreteX2, rect.discreteY2, isReading, isFinished); 
    }

    loopDotCollideWithRect(dot: Dot, func: (dot: Dot) => boolean): void {
        this.loopDot(dot, true, (b) => b.forEachDotCollideWithRect(dot, func));
    }

    loopRectCollideWithRect(rect: Rect, isFinished: (rect: Rect) => boolean): boolean {
        return this.loopRect(rect, true, (b) => b.forEachRectCollideWithRect(rect, isFinished));
    }

    addRect(rect: Rect): void {
        this.loopRect(rect, false, (b) => {
            b.rects.set(rect.id, rect); 
            return false; 
        });
    }

    removeRect(id: number): void {
        const rect = this.all.rects.get(id);
        if (rect === undefined) throw 'removing invalid rect';
        console.assert(rect.id === id, 'rect key id is not actual id');
        this.loopRect(rect, false, (b) => {
            b.rects.delete(rect.id); 
            return false; 
        });
    }

    registerRect(rect: Rect): void {
        this.addRect(rect);
        this.all.rects.set(rect.id, rect);
    }

    unregisterRect(id: number): void {
        this.removeRect(id);
        this.all.rects.delete(id);
    }

    addDot(dot: Dot): void {
        this.loopDot(dot, false, (b) => {
            b.dots.set(dot.id, dot);
        });
    }

    removeDot(id: number): void {
        const dot = this.all.dots.get(id);
        if (dot === undefined) throw 'removing invalid dot';
        console.assert(dot.id === id, 'dot key id is not actual id');
        this.loopDot(dot, false, (b) => {
            b.dots.delete(dot.id);
        });
    }

    registerDot(dot: Dot): void {
        this.addDot(dot);
        this.all.dots.set(dot.id, dot);
    }

    unregisterDot(id: number): void {
        this.removeDot(id);
        this.all.dots.delete(id);
    }
};
