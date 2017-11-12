import FloorTileGrid = require('./floor-tile-grid');
import BarrierType = FloorTileGrid.BarrierType;

export class MapContent {
    // Empty map on construction
    name: string = 'New map';
    blockWidth: number = 0;
    blockHeight: number = 0;
    rows: number[][] = [];
    barrierRows: FloorTileGrid.BarrierType[][] = [];

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

export class MapFile {
    constructor(public mapContent: MapContent, public spriteFileNames: string[]) {}
}
