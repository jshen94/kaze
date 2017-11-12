import _ = require('lodash');

import Scene = require('../kaze/scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import GameScene = require('../kaze/game-scene');
import GsNetwork = require('../kaze/game-scene-network');
import Shared = require('./index-server');
import KazeServer = require('../kaze/server');
import Calcs = require('../kaze/calcs');

//////////////////////////////////////////////////

const parsedMapJson = require('../../assets/maps/hank.json'); // Will parse
const floorTileGrid = FloorTileGrid.FloorTileGrid.fromMapFileBarrierOnly(parsedMapJson);
const sceneData = Shared.makeSceneData();
const scene = GameScene.createGameScene(sceneData);
sceneData.getBarrierType = FloorTileGrid.makeGetBarrierTypeRegion(floorTileGrid, 0, 0);

//////////////////////////////////////////////////

const addCharacter = (name: string): Shared.DuelZoneCharacter => {
    const character = Shared.makeCharacter(name, 0);
    character.setNetworkType(GsNetwork.CharacterNetType.Offline);
    scene.controller.grid.registerRect(character);
    return character;
};

const deleteCharacter = (character: Shared.DuelZoneCharacter): void => {
    scene.controller.grid.unregisterRect(character.id);
};

type OnUpdate = (diff: number, c: GameScene.Controller) => void;
const setOnUpdate = (onUpdate: OnUpdate): void => {
    sceneData.onUpdate = onUpdate;
};

const onClose = (result: KazeServer.OnCloseResult): void => {};

const onConnect = (result: KazeServer.OnConnectResult): void => {
    sceneData.onCharacterBulletHit = (
        controller: GameScene.Controller,
        character_: GameScene.Character,
        bullet: GameScene.Bullet
    ) => {
        const character = character_ as Shared.DuelZoneCharacter;
        character.hp -= bullet.weapon.damage;
        if (character.hp < 0) {
            character.deaths++;
            const owner = bullet.owner as Shared.DuelZoneCharacter;
            owner.kills++;
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
                kills: character.kills,
                deaths: character.deaths
            }));
            result.broadcast(JSON.stringify({
                type: '@updateKd', 
                id: owner.id,
                kills: owner.kills,
                deaths: owner.deaths
            }));
        }
        return true;
    };
};

Scene.playScene({fps: 60, scene});
KazeServer.startServer({
    port: 1337,
    viewport: new Calcs.Vec2d(500, 500), // TODO
    onConnect,
    onClose,
    setOnUpdate, 
    addCharacter,
    deleteCharacter
});
