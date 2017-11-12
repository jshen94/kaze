import React = require('react');
import ReactDOM = require('react-dom');
import $ = require('jquery');
import _ = require('lodash');

import Calcs = require('../kaze/calcs');
import MapFile = require('../kaze/map-file');
import KazeClient = require('../kaze/client');
import KazeShared = require('../kaze/client-server');
import Scene = require('../kaze/scene');
import GameScene = require('../kaze/game-scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import GsNetwork = require('../kaze/game-scene-network');
import Draw = require('../kaze/draw');
import Controls = require('../kaze/controls');
import Shared = require('./index-server');
import Components = require('../kaze/components');

let DuelZoneSettings: any = null;
const importSettings = (r: __WebpackModuleApi.RequireContext) => {
    const keys = r.keys();
    if (keys.length >= 1) DuelZoneSettings = r(keys[0]); // Read JSON
};
importSettings(require.context('.', false, /settings.json$/));

//////////////////////////////////////////////////
// Load assets

const imageFileToUrl: {[s: string]: string} = {};
const importAllImages = (r: __WebpackModuleApi.RequireContext) => {
    r.keys().forEach(key => imageFileToUrl[key] = r(key));
};
importAllImages(require.context('../../assets/images', false, /.*.(jpeg|jpg|png)/));

const imageFileToSpriteSheet = new Map<string, Draw.AnimatedSpriteSheet>();
for (const key in imageFileToUrl) {
    imageFileToSpriteSheet.set(key, new Draw.AnimatedSpriteSheet(imageFileToUrl[key], 1, 1));
}

const parsedMapJson: object = require('../../assets/maps/hank.json'); // Webpack will parse

//////////////////////////////////////////////////
// DOM

const $root = $('<div />');
$root.attr('id', 'root');
$(document.body).append($root); 
ReactDOM.render(
    // TODO - Constants for width/height b/c of server side viewport
    <Components.Canvas 
        id='my-canvas' width='500px' height='500px' isVisible={true} />, $root[0]
);

//////////////////////////////////////////////////

const name = prompt('Enter name:', 'Henry') || 'Faker';
const url = DuelZoneSettings === null ? 'ws://127.0.0.1:1337' : DuelZoneSettings.defaultGameUrl;

const canvas = document.getElementById('my-canvas');
if (canvas === null) throw 'canvas not found';
const detachedControls = new Controls.Controls();
detachedControls.register(canvas);

const sceneData = Shared.makeSceneData();
const playerT = new Draw.AnimatedSpriteSheet(imageFileToUrl['./black.png'], 1, 1); // Webpack prefixes with ./
const floorTileGrid = FloorTileGrid.FloorTileGrid.fromMapFile(parsedMapJson as MapFile.MapFile, imageFileToSpriteSheet, 'floor.png');
sceneData.getFloorTile = FloorTileGrid.makeGetFloorTileRegion(floorTileGrid, 0, 0);
sceneData.getBarrierType = FloorTileGrid.makeGetBarrierTypeRegion(floorTileGrid, 0, 0);
sceneData.onCharacterBulletHit = (controller, character, bullet) => {
    return true; // Make bullet disappear
};
sceneData.onBegin = (controller: GameScene.Controller): void => {
    detachedControls.onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'e' && controller.uiBoxes.length === 0) {
            controller.uiBoxes.push(new GameScene.UiBox([
                '[Test] Accept duel?', '1) Yes', '2) No'
            ], Math.random() * 50, Math.random() * 50, 250));
        }
    };
    detachedControls.onKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'e' && controller.uiBoxes.length > 0) {
            controller.uiBoxes.splice(0);
        }
    };
};
const scene = GameScene.createGameScene(sceneData);

const addCharacter = (attributes: KazeShared.CharacterInit): Shared.DuelZoneCharacter => {
    const character = Shared.makeCharacter(attributes.name, attributes.type, attributes.id);
    character.refreshName();
    character.setNetworkType(GsNetwork.CharacterNetType.Sync);
    character.spriteSheets = [playerT];
    character.spriteSheetIndex = 0;
    scene.controller.grid.registerRect(character);
    return character;
};

const deleteCharacter = (id: number): void => {
    scene.controller.grid.unregisterRect(id);
};

const spawnBullet = (
    owner: GameScene.Character, weapon: GameScene.Weapon,
    x: number, y: number, vx: number, vy: number
): void => {
    const bullet = new GameScene.Bullet(owner, weapon);
    bullet.position.x = x;
    bullet.position.y = y;
    bullet.velocity.x = vx;
    bullet.velocity.y = vy;
    scene.controller.grid.registerDot(bullet);
};

const getWeapon = (id: number): GameScene.Weapon => {
    if (id != Shared.burstWeapon.id) throw 'weapon not supported';
    return Shared.burstWeapon;
};

const onError = (e: Event): void => {
    alert('ERROR');
    throw e;
};

const onClose = (): void => {
    alert('DISCONNECTED');
};

const onConnect = (result: KazeClient.OnConnectResult): void => {
    const player = result.characterMap.get(result.playerId);
    if (player === undefined) throw 'player not found in character map';
    sceneData.camera = () => player.position;
    sceneData.cameraOffset = Calcs.Vec2d.mult(player.size, 0.5);

    result.messageHandler.on({id: '@updateKd', func: (json) => {
        if (!_.isNumber(json.id)) throw 'invalid kd target';
        if (!_.isNumber(json.kills)) throw 'invalid kd kills';
        if (!_.isNumber(json.deaths)) throw 'invalid kd deaths';

        const character = result.characterMap.get(json.id) as Shared.DuelZoneCharacter;
        character.kills = json.kills;
        character.deaths = json.deaths;
        character.refreshName();
    }});

    const canvasCasted = canvas as HTMLCanvasElement;
    Scene.playScene({fps: 60, canvas: canvasCasted, scene});
};

KazeClient.connectToServer({
    url, 
    name,
    onConnect,
    onError,
    onClose,
    detachedControls,
    addCharacter,
    deleteCharacter,
    spawnBullet,
    getWeapon
});
