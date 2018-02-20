//////////////////////////////////////////////////
// Simple grid where each cell is a tile and might
// contain barriers which impede movement or bullets.
//
// Create infinite map by sampling from this grid using `makeRegion`, `makePattern`.
// Can save infinite map into a grid using `combine`, then re-sample, repeat.
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
}

export class FloorTileGrid {

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
                if (spriteSheet === undefined) throw new Error('could not find in image file to sprite sheet ' + fileName);
                console.assert(spriteSheet.animateWidth === 1);
                console.assert(spriteSheet.animateHeight === 1);
                grid.setSpriteSheet(x, y, spriteSheet);

                const barrierType = map.mapContent.barrierRows[y][x];
                grid.setBarrier(x, y, barrierType);
            }
        }

        return grid;
    }

    private grid: (AnimatedSpriteSheet | undefined)[];
    private barrierGrid: (BarrierType | undefined)[];

    constructor(readonly blockWidth: number, readonly blockHeight: number) {
        this.grid = new Array(blockWidth * blockHeight);
        this.barrierGrid = new Array(blockWidth * blockHeight);
    }

    setSpriteSheet = (bx: number, by: number, spriteSheet: AnimatedSpriteSheet): void => {
        const b = this.constrainBlockCoord(bx, by);
        this.grid[b.y * this.blockWidth + b.x] = spriteSheet;
    }

    setBarrier = (bx: number, by: number, barrierType: BarrierType): void => {
        const b = this.constrainBlockCoord(bx, by);
        this.barrierGrid[b.y * this.blockWidth + b.x] = barrierType;
    }
    
    // Because grids are initialized to all undefined, need undefined -> null conversion
    // for tiles within bounds but nothing there

    getSpriteSheet = (bx: number, by: number, constrain: boolean = true): AnimatedSpriteSheet | null => {
        if (!constrain && this.isOutside(bx, by)) return null;
        const b = constrain ? this.constrainBlockCoord(bx, by) : new Vec2d(bx, by);
        const sheet = this.grid[b.y * this.blockWidth + b.x]; 
        return sheet === undefined ? null : sheet;
    }

    getBarrierType = (bx: number, by: number, constrain: boolean = true): BarrierType | null => {
        if (!constrain && this.isOutside(bx, by)) return null;
        const b = constrain ? this.constrainBlockCoord(bx, by) : new Vec2d(bx, by);
        const barrierType = this.barrierGrid[b.y * this.blockWidth + b.x]; 
        return barrierType === undefined ? null : barrierType;
    }

    setRegion = (region: FloorTileRegion): void => {
        for (let i = region.bx1; i <= region.bx2; ++i) {
            for (let j = region.by1; j <= region.by2; ++j) {
                this.setSpriteSheet(i, j, region.spriteSheet);
            }
        }
    }

    private constrainBlockCoord = (bx: number, by: number): Vec2d => {
        if (bx < 0) bx = 0;
        if (bx >= this.blockWidth) bx = this.blockWidth - 1;
        if (by < 0) by = 0;
        if (by >= this.blockHeight) by = this.blockHeight - 1;
        return new Vec2d(bx, by);
    }

    // Out of bounds elements might still be inside array due to 1D array, so need outside check!
    private isOutside = (bx: number, by: number): boolean => {
        return bx < 0 || by < 0 || bx >= this.blockWidth || by >= this.blockHeight;
    }
}

//////////////////////////////////////////////////

export type GetTileFunc<T> = (i: number, j: number) => T | null;
export type InnerGetTileFunc<T> = (i: number, j: number, constrain: boolean) => T | null;

export const makeRegion = <T>(x: number = 0, y: number = 0, func: InnerGetTileFunc<T>): GetTileFunc<T> => {
    return (i, j) => func(i - x, j - y, false);
};

export const makePattern = <T>(width: number, height: number, func: InnerGetTileFunc<T>): GetTileFunc<T> => {
    return (i, j) => {
        i = i % width;
        if (i < 0) i += width;
        j = j % height;
        if (j < 0) j += height;
        return func(i, j, true);
    };
};

export const makeGetBarrierTypePattern = (grid: FloorTileGrid): GetTileFunc<BarrierType> => {
    return makePattern(grid.blockWidth, grid.blockHeight, grid.getBarrierType);
};

export const makeGetBarrierTypeRegion = (grid: FloorTileGrid, x: number = 0, y: number = 0): GetTileFunc<BarrierType> => {
    return makeRegion(x, y, grid.getBarrierType);
};

export const makeGetFloorTilePattern = (grid: FloorTileGrid): GetTileFunc<AnimatedSpriteSheet> => {
    return makePattern(grid.blockWidth, grid.blockHeight, grid.getSpriteSheet);
};

export const makeGetFloorTileRegion = (grid: FloorTileGrid, x: number = 0, y: number = 0): GetTileFunc<AnimatedSpriteSheet> => {
    return makeRegion(x, y, grid.getSpriteSheet);
};

//////////////////////////////////////////////////

export class VirtualFloorTileGrid {
    static getEmpty(width: number, height: number): VirtualFloorTileGrid {
        return new VirtualFloorTileGrid(width, height, VirtualFloorTileGrid.getBarrierTypeEmpty);
    }

    private static getBarrierTypeEmpty(i: number, j: number): (BarrierType | null) {
        return null;
    }

    constructor(public width: number,
                public height: number,
                public getBarrierType: GetTileFunc<BarrierType>,
                public getFloorTile?: GetTileFunc<AnimatedSpriteSheet>) {}
}

export const combine = (a: VirtualFloorTileGrid[][]): FloorTileGrid => {

    let height = 0;
    let widthChamp: number | null = null;
    const heightChamps: number[] = [];
    a.forEach((row) => {
        let rowWidth = 0;
        let rowHeightChamp: number | null = null;
        row.forEach((vGrid) => {
            if (rowHeightChamp === null || vGrid.height > rowHeightChamp) rowHeightChamp = vGrid.height;
            rowWidth += vGrid.width;
        });
        if (widthChamp === null || rowWidth > widthChamp) widthChamp = rowWidth;
        if (rowHeightChamp === null) rowHeightChamp = 0;
        height += rowHeightChamp;
        heightChamps.push(rowHeightChamp);
    });

    if (widthChamp === null) throw new Error('combine returning empty grid');
    const result = new FloorTileGrid(widthChamp, height);

    let x = 0;
    let y = 0;
    let r = 0;
    a.forEach((row) => {
        x = 0;
        row.forEach((vGrid) => {
            for (let i = 0; i < vGrid.width; ++i) {
                for (let j = 0; j < vGrid.height; ++j) {
                    const bType = vGrid.getBarrierType(i, j);
                    if (bType) result.setBarrier(i + x, j + y, bType);
                    if (vGrid.getFloorTile) {
                        const sheet = vGrid.getFloorTile(i, j);
                        if (sheet) result.setSpriteSheet(i + x, j + y, sheet);
                    }
                }
            }
            x += vGrid.width;
        });
        y += heightChamps[r++];
    });

    return result;
};
