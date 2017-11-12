//////////////////////////////////////////////////
// Server, client common code
//////////////////////////////////////////////////

import GameScene = require('../kaze/game-scene');
import NetworkedCharacter = GameScene.NetworkedCharacter;
import Character = GameScene.Character;

export const MapWidth = null;
export const MapHeight = 20;
export const MapBlockLength = 50;

export const CharacterHeight = 40;
export const CharacterWidth = 40;

export const ViewportWidth = 500;
export const ViewportHeight = 500;

export const burstWeapon = new GameScene.Weapon();
burstWeapon.damage = 85;
burstWeapon.lifetime = 2000;
burstWeapon.color = '#00aaff';
burstWeapon.speed = 0.225;
burstWeapon.shots = 3;
burstWeapon.reload = 620;
burstWeapon.rate = 100;
burstWeapon.bulletShape = GameScene.BulletShape.Line;
burstWeapon.bulletLength = 10;

export class DuelZoneCharacterData {
    kills: number = 0;
    deaths: number = 0;
    constructor(public baseName: string) {}
}

export interface HasDuelZoneCharacterData {
    data: DuelZoneCharacterData;
}

export const makeSceneData = (): GameScene.GameSceneData => {
    const sceneData = new GameScene.GameSceneData();
    sceneData.blockLength = MapBlockLength;
    sceneData.blockWidth = MapWidth;
    sceneData.blockHeight = MapHeight;
    return sceneData;
};
