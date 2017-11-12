//////////////////////////////////////////////////
// Simple grid where each cell is a tile and might contain barriers which impede movement
// Create infinite map by sampling from this grid
//////////////////////////////////////////////////

import Calcs = require('./calcs');
import Draw = require('./draw');
import MapFile_ = require('./map-file');
import MapFile = MapFile_.MapFile;
import AnimatedSpriteSheet = Draw.AnimatedSpriteSheet;
import Vec2d = Calcs.Vec2d;

export enum BarrierType {None, Left, Top, LeftTop}

export class FloorTileRegion { 
    constructor(
        public bx1: number, public by1: number,
        public bx2: number, public by2: number, public spriteSheet: AnimatedSpriteSheet) {}
};

export class FloorTileGrid {
    private grid: (AnimatedSpriteSheet | null)[];
    private barrierGrid: (BarrierType | null)[];

    constructor(readonly blockWidth: number, readonly blockHeight: number) {
        this.grid = new Array(blockWidth * blockHeight);
        this.barrierGrid = new Array(blockWidth * blockHeight);
    }

    private constrainBlockCoord(bx: number, by: number): Vec2d {
        if (bx < 0) bx = 0;
        if (bx >= this.blockWidth) bx = this.blockWidth - 1;
        if (by < 0) by = 0;
        if (by >= this.blockHeight) by = this.blockHeight - 1;
        return new Vec2d(bx, by);
    }

    private isOutside(bx: number, by: number): boolean {
        return bx < 0 || bx >= this.blockWidth || by < 0 || by >= this.blockHeight;
    }

    setSpriteSheet(bx: number, by: number, spriteSheet: AnimatedSpriteSheet): void {
        const b = this.constrainBlockCoord(bx, by);
        this.grid[b.y * this.blockWidth + b.x] = spriteSheet;
    }

    setBarrier(bx: number, by: number, barrierType: BarrierType): void {
        const b = this.constrainBlockCoord(bx, by);
        this.barrierGrid[b.y * this.blockWidth + b.x] = barrierType;
    }

    getSpriteSheet(bx: number, by: number, constrain: boolean = true): AnimatedSpriteSheet | null {
        if (constrain) {
            const b =  this.constrainBlockCoord(bx, by); 
            return this.grid[b.y * this.blockWidth + b.x]; 
        } else {
            if (this.isOutside(bx, by)) return null;
            return this.grid[by * this.blockWidth + bx]; 
        }
    }

    getBarrierType(bx: number, by: number, constrain: boolean = true): BarrierType | null {
        if (constrain) {
            const b =  this.constrainBlockCoord(bx, by); 
            return this.barrierGrid[b.y * this.blockWidth + b.x]; 
        } else {
            if (this.isOutside(bx, by)) return null;
            else return this.barrierGrid[by * this.blockWidth + bx]; 
        }
    }

    setRegion(region: FloorTileRegion): void {
        for (let i = region.bx1; i <= region.bx2; ++i) {
            for (let j = region.by1; j <= region.by2; ++j) {
                this.setSpriteSheet(i, j, region.spriteSheet);
            }
        }
    }

    static fromMapFileBarrierOnly(map: MapFile): FloorTileGrid {
        const width = map.mapContent.blockWidth;
        const height = map.mapContent.blockHeight;
        const grid = new FloorTileGrid(width, height);
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const barrierType = map.mapContent.barrierRows[y][x];
                grid.setBarrier(x, y, barrierType);
            }
        }
        return grid;
    }

    static fromMapFile(map: MapFile, imageFileToSpriteSheet: Map<string, AnimatedSpriteSheet>, defaultFileName: string): FloorTileGrid {
        const width = map.mapContent.blockWidth;
        const height = map.mapContent.blockHeight;
        const grid = new FloorTileGrid(width, height);

        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const fileName_ = map.spriteFileNames[map.mapContent.rows[y][x]];
                const fileName = fileName_ === undefined ? defaultFileName : fileName_;
                const spriteSheet = imageFileToSpriteSheet.get('./' + fileName); // Webpack prefixes with ./
                if (spriteSheet === undefined) throw 'broken trying to find sprite sheet ' + fileName;
                console.assert(spriteSheet.animateWidth === 1);
                console.assert(spriteSheet.animateHeight === 1);
                grid.setSpriteSheet(x, y, spriteSheet);

                const barrierType = map.mapContent.barrierRows[y][x];
                grid.setBarrier(x, y, barrierType);
            }
        }

        return grid;
    }
}

//////////////////////////////////////////////////

export const makeGetFloorTileRegion = (floorTileGrid: FloorTileGrid, topX: number, topY: number)
    : ((i: number, j: number) => AnimatedSpriteSheet | null) => {
    return (i, j) => floorTileGrid.getSpriteSheet(i - topX, j - topY, false);
};

export const makeGetBarrierTypeRegion = (floorTileGrid: FloorTileGrid, topX: number, topY: number)
    : ((i: number, j: number) => BarrierType | null) => {
    return (i, j) => floorTileGrid.getBarrierType(i - topX, j - topY, false);
};

export const makeGetFloorTilePattern = 
    (floorTileGrid: FloorTileGrid): ((i: number, j: number) => AnimatedSpriteSheet | null) => {
    return (i, j) => {
        i = i % floorTileGrid.blockWidth;
        if (i < 0) i += floorTileGrid.blockWidth;
        j = j % floorTileGrid.blockHeight;
        if (j < 0) j += floorTileGrid.blockHeight;
        return floorTileGrid.getSpriteSheet(i, j);
    };
};

export const makeGetBarrierTypePattern = 
    (floorTileGrid: FloorTileGrid): ((i: number, j: number) => BarrierType | null) => {
    return (i, j) => {
        i = i % floorTileGrid.blockWidth;
        if (i < 0) i += floorTileGrid.blockWidth;
        j = j % floorTileGrid.blockHeight;
        if (j < 0) j += floorTileGrid.blockHeight;
        return floorTileGrid.getBarrierType(i, j);
    };
};
