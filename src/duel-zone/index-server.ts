//////////////////////////////////////////////////
// Server, client common code
//////////////////////////////////////////////////

import GameScene = require('../kaze/game-scene');
import Calcs = require('../kaze/calcs');
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

export const autoWeapon = new GameScene.Weapon();
autoWeapon.damage = 10;
autoWeapon.lifetime = 2000;
autoWeapon.color = '#ffffff';
autoWeapon.speed = 0.2;
autoWeapon.shots = 25;
autoWeapon.reload = 2000;
autoWeapon.rate = 50;
autoWeapon.bulletShape = GameScene.BulletShape.Circle;
autoWeapon.bulletLength = 2;

export const boom = new GameScene.ExplosionType(
    199,
    [
        {weapon: autoWeapon, fragmentCount: 16},
        {weapon: burstWeapon, fragmentCount: 8}
    ],
    new Calcs.Vec2d(60, 60),
    400
);

export const rocketWeapon = new GameScene.Weapon();
rocketWeapon.damage = 0;
rocketWeapon.lifetime = 4000;
rocketWeapon.color = '#ff0000';
rocketWeapon.speed = 0.4;
rocketWeapon.shots = 1;
rocketWeapon.reload = 1500;
rocketWeapon.rate = 1500;
rocketWeapon.bulletShape = GameScene.BulletShape.Circle;
rocketWeapon.bulletLength = 10;

//BEAM GRENADE
//boom.fragmentTypes.push({weapon: rocketWeapon, fragmentCount: 8});

export class DuelZoneCharacterData {
    kills: number = 0;
    deaths: number = 0;
    constructor(public baseName: string) {}
}

export interface IHasDuelZoneCharacterData {
    data: DuelZoneCharacterData;
}

export const makeSceneData = (): GameScene.GameSceneData => {
    const sceneData = new GameScene.GameSceneData();
    sceneData.blockLength = MapBlockLength;
    sceneData.blockWidth = MapWidth;
    sceneData.blockHeight = MapHeight;
    return sceneData;
};
