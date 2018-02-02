import _ = require('lodash');

import Scene = require('../kaze/scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import GameScene = require('../kaze/game-scene');
import GsNetwork = require('../kaze/game-scene-network');
import Shared = require('./index-server');
import KazeServer = require('../kaze/server');
import Calcs = require('../kaze/calcs');

import HasDuelZoneCharacterData = Shared.HasDuelZoneCharacterData;
import DuelZoneCharacterData = Shared.DuelZoneCharacterData;

//////////////////////////////////////////////////

export class DuelZoneCharacter extends GameScene.Character implements HasDuelZoneCharacterData {
    data: DuelZoneCharacterData; 

    constructor(name: string, width: number, height: number) {
        super(width, height);
        this.name = name;
        this.weapons = [Shared.burstWeapon, Shared.autoWeapon];
        this.data = new DuelZoneCharacterData(name);
    }
}

//////////////////////////////////////////////////

const parsedMapJson = require('../../assets/maps/hank.json'); // Will parse
const floorTileGrid = FloorTileGrid.FloorTileGrid.fromMapFileBarrierOnly(parsedMapJson);
const sceneData = Shared.makeSceneData();
const scene = GameScene.createGameScene(sceneData);
sceneData.getBarrierType = FloorTileGrid.makeGetBarrierTypeRegion(floorTileGrid, 0, 0);

//////////////////////////////////////////////////

const addCharacter = (name: string): DuelZoneCharacter => {
    const character = new DuelZoneCharacter(name, Shared.CharacterWidth, Shared.CharacterWidth);
    scene.controller.grid.registerRect(character);
    return character;
};

const deleteCharacter = (character: DuelZoneCharacter): void => {
    scene.controller.grid.unregisterRect(character.id);
};

type OnUpdate = (diff: number, c: GameScene.Controller) => void;
const hookOnUpdate = (onUpdate: OnUpdate): void => {
    sceneData.onUpdate = onUpdate;
};

const onClose = (result: KazeServer.OnCloseResult): void => {};

const onConnect = (result: KazeServer.OnConnectResult): void => {

    // TODO KD not sent at start yet

    sceneData.onCharacterBulletHit = (
        controller: GameScene.Controller,
        character_: GameScene.Character,
        bullet: GameScene.Bullet
    ) => {
        const character = character_ as DuelZoneCharacter;
        character.hp -= bullet.weapon.damage;

        if (character.hp < 0) {
            character.data.deaths++;

            const owner = bullet.owner as DuelZoneCharacter;
            owner.data.kills++;

            character.hp = character.maxHp;
            owner.hp = owner.maxHp;

            controller.grid.editRect(
                character, 
                Math.random() * (400 - character.size.x - 1),
                Math.random() * (400 - character.size.y - 1)
            );

            result.broadcast(JSON.stringify({
                type: '@updateKd', 
                id: character.id,
                kills: character.data.kills,
                deaths: character.data.deaths
            }));
            result.broadcast(JSON.stringify({
                type: '@updateKd', 
                id: owner.id,
                kills: owner.data.kills,
                deaths: owner.data.deaths
            }));
        }
        return true;
    };
};

Scene.playScene({
    fps: 60,
    canvas: new Scene.CanvasSizeSubstitute(Shared.ViewportWidth, Shared.ViewportHeight),
    scene
});

KazeServer.startServer({
    port: 1337,
    viewportWidth: Shared.ViewportWidth,
    viewportHeight: Shared.ViewportHeight,
    onConnect,
    onClose,
    hookOnUpdate, 
    addCharacter,
    deleteCharacter
});
