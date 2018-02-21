//////////////////////////////////////////////////
// Network support for game-scene.ts
//////////////////////////////////////////////////

import _ = require('lodash');
import GameScene = require('./game-scene');
import Controls = require('./controls');
import Interpolator = require('./interpolator');
import Calcs = require('./calcs');
import SpatialHash = require('./spatial-hash');
import NetHelpers = require('./net-helpers');

import Vec2d = Calcs.Vec2d;
import Direction = Controls.Direction;
import ByteArrayMaker = NetHelpers.ByteArrayMaker;
import ByteArrayReader = NetHelpers.ByteArrayReader;

//** Must be unsigned byte
export enum CallType {
    SyncChar = 0,
    SyncControls,
    BulletSpawn,
    ExplosionSpawn,
    UnsyncChar,
    PrefireTrigger
}

// Additional networked information which is not interpolated
export class CharacterPartial {
    constructor(public hp: number) {}
}

export const AIM_DEGREES = 128;
export const AIM_SLICE = 2 * Math.PI / AIM_DEGREES;

export const aimToNumber = (aim: Vec2d): number => {
    const angle = aim.atan2() + Math.PI; // Make above 0 (original is above -PI)
    let result = Math.floor(angle / AIM_SLICE);
    if (result === AIM_DEGREES) result = AIM_DEGREES - 1;
    console.assert(result >= 0 && result < AIM_DEGREES, 'aim to number out of bounds');
    return result;
};

export const numberToAim = (n: number): Vec2d => {
    const v = new Vec2d(1, 0);
    v.rotate(n * AIM_SLICE - Math.PI);
    return v;
};

// TODO - Autopack, move to net-helpers

export const MAX_WEAPON_COUNT = 8;

export const packControls = (mouse: boolean, aim: Vec2d, vertical: Direction, horizontal: Direction, weaponIndex: number): number => {
    //** weaponIndex < MAX_WEAPON_COUNT;

    const positiveV = vertical + 1;
    const positiveH = horizontal + 1;

    // 2 bytes
    let b = 0;
    b |= positiveV; // 2
    b <<= 2;
    b |= positiveH; // .. 4
    b <<= 1;
    b |= mouse ? 1 : 0; // .. 5
    b <<= 7;
    b |= aimToNumber(aim); // .. 12
    b <<= 3;
    b |= weaponIndex; // 0-7 // .. 15
    return b;
};

export const unpackControls = (packed: number, character: GameScene.Character): void => {
    const controls = character.controls;
    // 2 bytes
    character.trySetWeaponIndex(packed & 7);
    packed >>>= 3;
    controls.aim = numberToAim(packed & 127);
    packed >>>= 7;
    controls.mouse = (packed & 1) > 0;
    packed >>>= 1;
    controls.horizontal = ((packed & 3) - 1) as Direction;
    packed >>>= 2;
    controls.vertical = ((packed & 3) - 1) as Direction;
};

//////////////////////////////////////////////////

export const serialize: {[i: number]: any} = {};
export const deserialize: {[i: number]: any} = {};

export const quickGetCharacterId = (view: DataView): number => {
    return view.getUint32(1); // Must match SyncChar calls below
};

serialize[CallType.PrefireTrigger] = (character: GameScene.Character): ArrayBuffer => {
    const maker = new ByteArrayMaker(6);
    maker.addUint8(CallType.PrefireTrigger);
    maker.addUint32(character.id);
    maker.addUint8(character.prefiring ? 1 : 0); // TODO Compress
    return maker.make();
};

deserialize[CallType.PrefireTrigger] = (character: GameScene.NetworkedCharacter, view: DataView): void => {
    const reader = new ByteArrayReader(view);
    reader.getUint8();
    reader.getUint32();
    character.prefiring = reader.getUint8() > 0;
    reader.check();
};

serialize[CallType.UnsyncChar] = (character: GameScene.Character): ArrayBuffer => {
    const maker = new ByteArrayMaker(5);
    maker.addUint8(CallType.UnsyncChar);
    maker.addUint32(character.id);
    return maker.make();
};

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
    maker.addUint16(packControls(controls.mouse, controls.aim, controls.vertical, controls.horizontal, controls.weaponIndex));
    return maker.make();
};

deserialize[CallType.SyncControls] = (character: GameScene.Character, view: DataView): void => {
    const reader = new ByteArrayReader(view);
    reader.getUint8();
    unpackControls(reader.getUint16(), character);
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
};

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
};

serialize[CallType.ExplosionSpawn] = (explosion: GameScene.Explosion): ArrayBuffer => {
    const maker = new ByteArrayMaker(14);
    maker.addUint8(CallType.ExplosionSpawn);
    maker.addFloat32(explosion.position.x);
    maker.addFloat32(explosion.position.y);
    maker.addUint8(explosion.explosionType.id);
    maker.addUint32(explosion.owner.id);
    return maker.make();
};

deserialize[CallType.ExplosionSpawn] = (
    spawnExplosion: (ownerId: number, explosionTypeId: number, x: number, y: number) => void,
    view: DataView
) => {
    const reader = new ByteArrayReader(view);
    reader.getUint8();
    const x = reader.getFloat32();
    const y = reader.getFloat32();
    const explosionTypeId = reader.getUint8();
    const ownerId = reader.getUint32();
    reader.check();
    spawnExplosion(ownerId, explosionTypeId, x, y);
};
