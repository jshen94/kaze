//////////////////////////////////////////////////
// Server for duel zone
//////////////////////////////////////////////////

import _ = require('lodash');

import Scene = require('../kaze/scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import GameScene = require('../kaze/game-scene');
import GsNetwork = require('../kaze/game-scene-network');
import Shared = require('./index-server');
import KazeServer = require('../kaze/server');
import Calcs = require('../kaze/calcs');

import Vec2d = Calcs.Vec2d;
import IHasDuelZoneCharacterData = Shared.IHasDuelZoneCharacterData;
import DuelZoneCharacterData = Shared.DuelZoneCharacterData;

class DuelZoneCharacter extends GameScene.Character implements IHasDuelZoneCharacterData {
    data: DuelZoneCharacterData;
    constructor(name: string, width: number, height: number) {
        super(width, height);
        this.name = name;
        this.weapons = [Shared.burstWeapon, Shared.autoWeapon];
        this.data = new DuelZoneCharacterData(name);
    }
}

const parsedMapJson = require('../../assets/maps/hank.json'); // Webpack will parse on compile
const floorTileGrid = FloorTileGrid.FloorTileGrid.fromMapFileBarrierOnly(parsedMapJson);

//////////////////////////////////////////////////

const addCharacter = (name: string): DuelZoneCharacter => {
    const character = new DuelZoneCharacter(name, Shared.CharacterWidth, Shared.CharacterWidth);
    scene.controller.grid.registerRect(character);
    return character;
};
const deleteCharacter = (character: DuelZoneCharacter): void => {
    scene.controller.grid.unregisterRect(character.id);
};
const hookOnUpdate = (
    onUpdate: (diff: number, c: GameScene.Controller) => void
): void => {
    sceneData.onUpdate = onUpdate;
};
const onClose = (result: KazeServer.IOnCloseResult): void => {};
const onConnect = (result: KazeServer.IOnConnectResult): void => {
    const characters = Array.from(server.characterMap.values());
    result.ws.send(JSON.stringify({
        type: '@kdInit',
        entries: characters.map((uncastedCharacter) => {
            const character = uncastedCharacter as DuelZoneCharacter;
            return [character.id, character.data.kills, character.data.deaths];
        })
    }));
    result.messageHandler.on({id: '@spawnExplosion', func: ({ws, msg}) => {
        const character = server.characterMap.get(ws);
        if (!character) throw new Error('cannot find character?');
        const explosion = new GameScene.Explosion(character, Shared.boom, Vec2d.copy(character.position));
        scene.controller.grid.registerRect(explosion);
    }});
};
const server = KazeServer.Server.getInstance({
    port: 1337,
    viewportWidth: Shared.ViewportWidth,
    viewportHeight: Shared.ViewportHeight,
    onConnect,
    onClose,
    hookOnUpdate,
    addCharacter,
    deleteCharacter
});

//////////////////////////////////////////////////

const sceneData = Shared.makeSceneData();
sceneData.getBarrierType = FloorTileGrid.makeGetBarrierTypeRegion(floorTileGrid, 0, 0);
sceneData.onCharacterBulletHit = (
    controller: GameScene.Controller,
    uncastedCharacter: GameScene.Character,
    bullet: GameScene.Bullet
) => {
    const character = uncastedCharacter as DuelZoneCharacter;
    character.hp -= bullet.weapon.damage;

    if (character.hp < 0) {
        const owner = bullet.owner as DuelZoneCharacter;
        owner.data.kills++;
        character.data.deaths++;

        character.hp = character.maxHp;
        owner.hp = owner.maxHp;

        controller.grid.editRect(
            character,
            Math.random() * (400 - character.size.x - 1),
            Math.random() * (400 - character.size.y - 1)
        );

        server.broadcast(JSON.stringify({
            type: '@updateKd',
            id: character.id,
            kills: character.data.kills,
            deaths: character.data.deaths
        }));

        server.broadcast(JSON.stringify({
            type: '@updateKd',
            id: owner.id,
            kills: owner.data.kills,
            deaths: owner.data.deaths
        }));
    }

    return true;
};
const scene = GameScene.createGameScene(sceneData);

//////////////////////////////////////////////////

Scene.playScene({
    fps: 60,
    canvas: new Scene.CanvasSizeSubstitute(Shared.ViewportWidth, Shared.ViewportHeight),
    scene
});
server.start();
