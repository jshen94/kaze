
//////////////////////////////////////////////////
// Network support for game-scene.ts
//////////////////////////////////////////////////

import _ = require('lodash');
import GameScene = require('./game-scene');
import Controls = require('./controls');
import Interpolator = require('./interpolator');
import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;
import Direction = Controls.Direction;

export enum CharacterNetType {Sync, Offline}
export enum CallType {
    SyncChar = 0,
    SyncControls,
    BulletSpawn
} // value > 0, length < 256

export class CharacterPartial {
    constructor(public hp: number) {}
}

class ByteArrayReader {
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
        if (this.index !== this.size) throw 'size mismatch';
    }
}

class ByteArrayMaker {
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
        if (this.index !== this.byteSize) throw 'size mismatch';
        return this.buffer;
    }
}

export const serialize: {[i: number]: any} = {};
export const deserialize: {[i: number]: any} = {};

export const quickGetCharacterId = (view: DataView): number => {
    return view.getUint32(1); // Must match below
}

const AIM_DEGREES = 128;
const AIM_SLICE = 2 * Math.PI / AIM_DEGREES;

const aimToNumber = (aim: Vec2d): number => {
    const angle = aim.atan2() + Math.PI; // Make above 0 (original is above -PI)
    let result = Math.floor(angle / AIM_SLICE);
    if (result === AIM_DEGREES) result = AIM_DEGREES - 1;
    console.assert(result >= 0 && result < AIM_DEGREES, 'aim to number out of bounds');
    return result;
};

const numberToAim = (n: number): Vec2d => {
    const v = new Vec2d(1, 0); 
    v.rotate(n * AIM_SLICE - Math.PI);
    return v;
};

// TODO - Autopack

const packControls = (mouse: boolean, aim: Vec2d, vertical: Direction, horizontal: Direction): number => {
    const positiveV = vertical + 1;
    const positiveH = horizontal + 1;

    let twoBytes = 0;
    twoBytes |= positiveV;
    twoBytes <<= 2;
    twoBytes |= positiveH;
    twoBytes <<= 1;
    twoBytes |= mouse ? 1 : 0;
    twoBytes <<= 7;
    twoBytes |= aimToNumber(aim);
    return twoBytes;
};

const unpackControls = (packed: number, controls: Controls.Controls): void => {
    controls.aim = numberToAim(packed & 127);
    packed >>>= 7;
    controls.mouse = (packed & 1) > 0;
    packed >>>= 1;
    controls.horizontal = ((packed & 3) - 1) as Direction;
    packed >>>= 2;
    controls.vertical = ((packed & 3) - 1) as  Direction;
}

const testPackUnpackControls = (): void => {
    for (let i = 0; i < 5; ++i) {
        const controls = new Controls.Controls;
        controls.vertical = (Math.floor(Math.random() * 3) - 1) as Direction;
        controls.horizontal = (Math.floor(Math.random() * 3) - 1) as Direction;
        controls.mouse = Math.random() > 0.5;
        controls.aim = new Vec2d(Math.random() * 100, Math.random() * 100);
        const n = packControls(controls.mouse, controls.aim, controls.vertical, controls.horizontal);
        const twoBytes = new ArrayBuffer(2);
        const view = new DataView(twoBytes);
        view.setUint16(0, n);
        const m = view.getUint16(0);
        const controls2 = new Controls.Controls;
        unpackControls(m, controls2);
        if (Math.abs(controls.aim.atan2()) - Math.abs(controls2.aim.atan2()) >= AIM_SLICE) console.error('aim', controls.aim, controls2.aim);
        if (controls.horizontal != controls2.horizontal) console.error('horizontal', controls.horizontal, controls2.horizontal);
        if (controls.vertical != controls2.vertical) console.error('vertical', controls.vertical, controls2.vertical);
        if (controls.mouse != controls2.mouse) console.error('mouse', controls.mouse, controls2.mouse);
    }
    console.log('DONE testPackUnpackControls');
};
//testPackUnpackControls();

serialize[CallType.SyncChar] = (character: GameScene.Character, diff: number): ArrayBuffer => {
    const maker = new ByteArrayMaker(26);

    // 7 bytes
    maker.addUint8(CallType.SyncChar);
    // TODO - Uint16 and post auto-increment check
    maker.addUint32(character.id);
    maker.addUint16(diff);

    // 17 bytes
    maker.addFloat32(character.position.x);
    maker.addFloat32(character.position.y);
    maker.addFloat32(character.velocity.x);
    maker.addFloat32(character.velocity.y);
    maker.addUint8(aimToNumber(character.aim));

    // 2 bytes
    maker.addUint16(character.hp);

    return maker.make();
};

deserialize[CallType.SyncChar] = (interpolator: Interpolator.Interpolator<CharacterPartial>, view: DataView): void => {
    const reader = new ByteArrayReader(view);

    // 7 bytes
    reader.getUint8();
    reader.getUint32();
    const diff = reader.getUint16();

    // 17 bytes
    const x = reader.getFloat32();
    const y = reader.getFloat32();
    const vx = reader.getFloat32();
    const vy = reader.getFloat32();
    const aim = numberToAim(reader.getUint8());

    // 2 bytes
    const hp = reader.getUint16(); 

    reader.check();

    interpolator.push(x, y, vx, vy, aim, diff, new CharacterPartial(hp));
};

serialize[CallType.SyncControls] = (controls: Controls.Controls): ArrayBuffer => {
    const maker = new ByteArrayMaker(3);
    maker.addUint8(CallType.SyncControls);
    maker.addUint16(packControls(controls.mouse, controls.aim, controls.vertical, controls.horizontal));
    return maker.make();
};

deserialize[CallType.SyncControls] = (character: GameScene.Character, view: DataView): void => {
    const reader = new ByteArrayReader(view);
    reader.getUint8();
    unpackControls(reader.getUint16(), character.controls);
    reader.check();
};

serialize[CallType.BulletSpawn] = (bullet: GameScene.Bullet): ArrayBuffer => {
    const maker = new ByteArrayMaker(22);
    maker.addUint8(CallType.BulletSpawn);
    maker.addFloat32(bullet.position.x);
    maker.addFloat32(bullet.position.y);
    maker.addFloat32(bullet.velocity.x);
    maker.addFloat32(bullet.velocity.y);
    maker.addUint8(bullet.weapon.id);
    maker.addUint32(bullet.owner.id);
    return maker.make();
}

deserialize[CallType.BulletSpawn] = (
    spawnBullet: (ownerId: number, weaponId: number, x: number, y: number, vx: number, vy: number) => void,
    view: DataView
) => {
    const reader = new ByteArrayReader(view);
    reader.getUint8();
    const x = reader.getFloat32();
    const y = reader.getFloat32();
    const vx = reader.getFloat32();
    const vy = reader.getFloat32();
    const weaponId = reader.getUint8();
    const ownerId = reader.getUint32();
    reader.check();
    spawnBullet(ownerId, weaponId, x, y, vx, vy);
}
