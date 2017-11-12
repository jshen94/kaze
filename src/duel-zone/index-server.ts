//////////////////////////////////////////////////
// Server, client common code
//////////////////////////////////////////////////

import GameScene = require('../kaze/game-scene');

export const MapWidth = null;
export const MapHeight = 20;
export const MapBlockLength = 50;

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

export class DuelZoneCharacter extends GameScene.Character {
    kills: number = 0;
    deaths: number = 0;
    baseName: string;

    constructor(name: string, radius: number) {
        super(radius);
        this.name = name;
        this.baseName = name; 
    }

    refreshName(): void {
        this.name = DuelZoneCharacter.getNameKdr(this.baseName, this.kills, this.deaths);
    }

    static getNameKdr(name: string, kills: number, deaths: number): string {
        return `${name} (${kills.toString()}-${deaths.toString()})`;
    }
}

export const makeCharacter = (name: string, type: number, id: number | null = null): DuelZoneCharacter => {
    const character = new DuelZoneCharacter(name, 20);
    if (id !== null) character.id = id; // Server picks ID for client
    character.weapon = burstWeapon;
    character.type = type;
    return character;
};

export const makeSceneData = (): GameScene.GameSceneData => {
    const sceneData = new GameScene.GameSceneData();
    sceneData.blockLength = MapBlockLength;
    sceneData.blockWidth = MapWidth;
    sceneData.blockHeight = MapHeight;
    return sceneData;
};
