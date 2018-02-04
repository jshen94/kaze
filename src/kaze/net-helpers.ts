export class ByteArrayReader {
    private index: number = 0;
    private size: number;

    constructor(private view: DataView) {
        this.size = view.byteLength;
    }

    getUint8(): number {
        const v = this.view.getUint8(this.index);
        this.index += 1;
        return v;
    }

    getUint16(): number {
        const v = this.view.getUint16(this.index);
        this.index += 2;
        return v;
    }

    getUint32(): number {
        const v = this.view.getUint32(this.index);
        this.index += 4;
        return v;
    }

    getInt8(): number {
        const v = this.view.getInt8(this.index);
        this.index += 1;
        return v;
    }

    getInt16(): number {
        const v = this.view.getInt16(this.index);
        this.index += 2;
        return v;
    }

    getInt32(): number {
        const v = this.view.getUint32(this.index);
        this.index += 4;
        return v;
    }

    getFloat32(): number {
        const v = this.view.getFloat32(this.index);
        this.index += 4;
        return v;
    }

    check(): void {
        if (this.index !== this.size) throw new Error('size mismatch');
    }
}

export class ByteArrayMaker {
    private buffer: ArrayBuffer;
    private view: DataView;
    private index: number = 0;

    constructor(private byteSize: number) {
        this.buffer = new ArrayBuffer(byteSize);
        this.view = new DataView(this.buffer);
    }

    addUint8(value: number) {
        this.view.setUint8(this.index, value);
        this.index += 1;
    }

    addUint16(value: number) {
        this.view.setUint16(this.index, value);
        this.index += 2;
    }

    addUint32(value: number) {
        this.view.setUint32(this.index, value);
        this.index += 4;
    }

    addInt8(value: number) {
        this.view.setInt8(this.index, value);
        this.index += 1;
    }

    addInt16(value: number) {
        this.view.setInt16(this.index, value);
        this.index += 2;
    }

    addInt32(value: number) {
        this.view.setUint32(this.index, value);
        this.index += 4;
    }

    addFloat32(value: number) {
        this.view.setFloat32(this.index, value);
        this.index += 4;
    }

    make(): ArrayBuffer {
        if (this.index !== this.byteSize) throw new Error('size mismatch');
        return this.buffer;
    }
}
