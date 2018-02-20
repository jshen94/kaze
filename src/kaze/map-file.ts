import _ = require('lodash');

import Calcs = require('./calcs');
import FloorTileGrid = require('./floor-tile-grid');
import BarrierType = FloorTileGrid.BarrierType;

export type MarkerMap = {[s: string]: string;}
export type InverseMarkerMap = {[s: string]: string;}

export const invertMarkersObject = (markers: MarkerMap): InverseMarkerMap => { 
    const inverted = _.invert(markers);
    if (Object.keys(inverted).length !== Object.keys(markers).length) throw new Error('markers had duplicate names and were not invertible');
    return inverted;
};

const markerCoordRegex = /^(\d*),(\d*)$/;
export const parseMarkerCoord = (coord: string): Calcs.Vec2d => {
    const result = markerCoordRegex.exec(coord);
    if (result === null) throw new Error('invalid marker coord');
    const a = parseInt(result[1]);
    const b = parseInt(result[2]);
    if (a === undefined || isNaN(a) || b === undefined || isNaN(b)) throw new Error('invalid marker coord');
    return new Calcs.Vec2d(a, b);
};

export class MapContent {
    name: string = 'New map';
    blockWidth: number = 0;
    blockHeight: number = 0;
    rows: number[][] = []; // Pointer to sprite sheet, -1 to use default sprite
    barrierRows: FloorTileGrid.BarrierType[][] = [];
    markers: MarkerMap = {}; // eg. Teleporter locations, or anything

    // Make empty map with dimensions
    initialize(name: string, blockWidth: number, blockHeight: number): void {
        const rows = Array(blockHeight);
        const barrierRows = Array(blockHeight);

        for (let y = 0; y < blockHeight; ++y) {
            const row = Array(blockWidth);
            const barrierRow = Array(blockWidth);

            row.fill(-1);
            barrierRow.fill(FloorTileGrid.BarrierType.None);

            rows[y] = row;
            barrierRows[y] = barrierRow;
        }

        this.rows = rows;
        this.barrierRows = barrierRows;
        this.name = name;
        this.blockWidth = blockWidth;
        this.blockHeight = blockHeight;
    }
}

// `spriteFileNames` - List of sprite references expected, order matters, index = ID 
export class MapFile {
    constructor(public mapContent: MapContent, public spriteFileNames: string[]) {}
}
