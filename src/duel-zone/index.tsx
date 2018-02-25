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

import VirtualFloorTileGrid = FloorTileGrid.VirtualFloorTileGrid;
import IHasDuelZoneCharacterData = Shared.IHasDuelZoneCharacterData;
import DuelZoneCharacterData = Shared.DuelZoneCharacterData;

class DuelZoneNetCharacter extends GameScene.NetworkedCharacter implements IHasDuelZoneCharacterData {

    static getNameKdr(data: DuelZoneCharacterData): string {
        return `${data.baseName} (${data.kills.toString()}-${data.deaths.toString()})`;
    }

    data: DuelZoneCharacterData;

    constructor(serverId: number, name: string, width: number, height: number) {
        super(serverId, width, height);
        this.data = new DuelZoneCharacterData(name);
        this.refreshName();
    }

    refreshName(): void {
        this.name = DuelZoneNetCharacter.getNameKdr(this.data);
    }
}

//////////////////////////////////////////////////
// Load assets

// Zone settings

let DuelZoneSettings: any = null;
const importSettings = (r: __WebpackModuleApi.RequireContext) => {
    const keys = r.keys();
    if (keys.length >= 1) DuelZoneSettings = r(keys[0]); // Read JSON
};
importSettings(require.context('.', false, /settings.json$/));

// Images

const imageFileToUrl: {[s: string]: string} = {};
const importAllImages = (r: __WebpackModuleApi.RequireContext) => {
    r.keys().forEach((key) => imageFileToUrl[key] = r(key));
};
importAllImages(require.context('../../assets', false, /.*.(jpeg|jpg|png)/));

const imageFileToSpriteSheet = new Map<string, Draw.AnimatedSpriteSheet>();
_.forOwn(imageFileToUrl, (value, key) => {
    imageFileToSpriteSheet.set(key, new Draw.AnimatedSpriteSheet(imageFileToUrl[key], 1, 1));
});

// Map

// Webpack will parse
const parsedMapJson = require('../../assets/hank.json') as MapFile.MapFile; 
const parsedDsMapJson = require('../../assets/dropship.json') as MapFile.MapFile;

//////////////////////////////////////////////////
// DOM

const $root = $('<div />');
$root.attr('id', 'root');
$(document.body).append($root);

interface IEverythingState {
    isStoreShown: boolean;
    isLoginShown: boolean;
}

class Everything extends React.Component<{}, IEverythingState> {
    constructor(props: {}) {
        super(props);
        this.state = {isStoreShown: false, isLoginShown: true};
    }

    onStoreClosed = (): void => {
        this.setState({isStoreShown: false});
    }

    onLoginClose = (): void => {
        this.setState({isLoginShown: false});
        setupAndConnect(this, '');
    }

    onAccept = (name: string): void => {
        this.setState({isLoginShown: false});
        setupAndConnect(this, name);
    }

    render(): JSX.Element {
        return (
            <Components.WindowContainer>
                <Components.Canvas id='my-canvas'
                                   width={Shared.ViewportWidth + 'px'}
                                   height={Shared.ViewportHeight + 'px'}
                                   isVisible={true} />

                <Components.Window title='Weapons'
                                   background='white'
                                   width={500}
                                   initialTop={-Shared.ViewportHeight / 2 - 100} // The relative height hack implies the static position is below the canvas, move it up a bit
                                   onCloseClick={this.onStoreClosed}
                                   isVisible={this.state.isStoreShown}>

                    <Components.ListMenu items={[{text: 'Fenrir', onClick: () => alert(3)},
                                                 {text: 'RR', onClick: () => alert(3)},
                                                 {text: 'Power Armour', onClick: () => alert(3)}]} />
                </Components.Window>

                <Components.Window title='Login'
                                   background='white'
                                   width={500}
                                   initialTop={-Shared.ViewportHeight / 2 - 100} // The relative height hack implies the static position is below the canvas, move it up a bit
                                   onCloseClick={this.onLoginClose}
                                   isVisible={this.state.isLoginShown}>
                    <Components.Login onAccept={this.onAccept} />
                </Components.Window>
            </Components.WindowContainer>
        );
    }
}

ReactDOM.render(
    <Everything />, $root[0]
);

//////////////////////////////////////////////////

function setupAndConnect(component: Everything, promptName: string) {
    const url = DuelZoneSettings === null ? 'ws://127.0.0.1:1337' : DuelZoneSettings.defaultGameUrl;

    const canvas = document.getElementById('my-canvas');
    if (canvas === null) throw new Error('canvas not found');

    const detachedControls = new Controls.Controls();
    detachedControls.register(canvas);

    const playerT = new Draw.AnimatedSpriteSheet(imageFileToUrl['./black.png'], 1, 1); // Webpack prefixes with ./

    const grid = FloorTileGrid.FloorTileGrid.fromMapFile(parsedMapJson, imageFileToSpriteSheet, 'floor.png');
    const dsGrid = FloorTileGrid.FloorTileGrid.fromMapFile(parsedDsMapJson, imageFileToSpriteSheet, 'floor.png');

    const explosionT = new Draw.AnimatedSpriteSheet(imageFileToUrl['./explosion.png'], 2, 2);
    explosionT.tickInterval = 99;
    explosionT.autoTick = true;
    Shared.boom.spriteSheet = explosionT; // Since client side, add the sprite in

    const getFloorDs = FloorTileGrid.makeGetFloorTilePattern(dsGrid);
    const getFloor = FloorTileGrid.makeGetFloorTileRegion(grid);
    const getBarrDs = FloorTileGrid.makeGetBarrierTypePattern(dsGrid);
    const getBarr = FloorTileGrid.makeGetBarrierTypeRegion(grid);

    const bigGrid = FloorTileGrid.combine([
        [VirtualFloorTileGrid.getEmpty(3, 3), new VirtualFloorTileGrid(dsGrid.blockWidth * 2, dsGrid.blockHeight * 2, getBarrDs, getFloorDs)],
        [VirtualFloorTileGrid.getEmpty(3, 3)],
        [new VirtualFloorTileGrid(grid.blockWidth, grid.blockHeight, getBarr, getFloor)]
    ]);

    const sceneData = Shared.makeSceneData();
    sceneData.getFloorTile = FloorTileGrid.makeGetFloorTileRegion(bigGrid);
    sceneData.getBarrierType = FloorTileGrid.makeGetBarrierTypeRegion(bigGrid);

    sceneData.onNetCharacterBulletHit = (controller, character, bullet) => {
        return true; // Make bullet disappear
    };

    sceneData.onBegin = (controller: GameScene.Controller): void => {
        let ticker = 0;
        const timeBox = new GameScene.UiBox(['Testing 123'], 5, 5, 150);
        controller.uiBoxes.push(timeBox);
        setInterval(() => {
            ticker++;
            timeBox.lines[0] = ticker.toString();
        }, 1000);
    };

    const scene = GameScene.createGameScene(sceneData);

    const addCharacter = (attributes: KazeShared.CharacterInit): DuelZoneNetCharacter => {
        const character = new DuelZoneNetCharacter(
            attributes.id, attributes.name,
            Shared.CharacterWidth, Shared.CharacterHeight
        );
        character.spriteSheets = [playerT];
        character.spriteSheetIndex = 0;
        scene.controller.grid.registerRect(character);
        return character;
    };

    const deleteCharacter = (id: number): void => {
        scene.controller.grid.unregisterRect(id);
    };

    const spawnBullet = (
        owner: GameScene.NetworkedCharacter, weapon: GameScene.Weapon,
        x: number, y: number, vx: number, vy: number
    ): void => {
        const bullet = new GameScene.Bullet(owner, weapon, new Calcs.Vec2d(vx, vy), new Calcs.Vec2d(x, y));
        scene.controller.grid.registerDot(bullet);
    };

    const spawnExplosion = (
        owner: GameScene.NetworkedCharacter, explosionType: GameScene.ExplosionType,
        x: number, y: number
    ): void => {
        const explosion = new GameScene.Explosion(owner, explosionType, x, y);
        scene.controller.grid.registerRect(explosion);
    };

    const getWeapon = (id: number): GameScene.Weapon => {
        if (id === Shared.burstWeapon.id) return Shared.burstWeapon;
        else if (id === Shared.autoWeapon.id) return Shared.autoWeapon;
        else if (id === Shared.rocketWeapon.id) return Shared.rocketWeapon;
        else if (id === Shared.sniperWeapon.id) return Shared.sniperWeapon;
        else throw new Error('weapon not supported');
    };

    const getExplosionType = (id: number): GameScene.ExplosionType => {
        if (id === Shared.boom.id) return Shared.boom;
        else throw new Error('explosion type not supported');
    };

    const onError = (e: Event): void => {
        alert('ERROR');
        throw e;
    };

    const onClose = (): void => {
        alert('DISCONNECTED');
    };

    const onConnect = (result: KazeClient.IOnConnectResult): void => {
        const player = result.characterMap.get(result.playerId);
        if (player === undefined) throw new Error('player not found in character map');

        sceneData.camera = () => player.position;
        sceneData.cameraOffset = Calcs.Vec2d.mult(player.size, 0.5);

        result.messageHandler.on({id: '@kdInit', func: (json: any) => {
            json.entries.forEach(([id, kills, deaths]: [number, number, number]) => {
                const character_ = result.characterMap.get(id);
                if (character_ === undefined) {
                    console.warn('server giving kds of characters not in map');
                    return;
                }

                const character = character_ as DuelZoneNetCharacter;
                character.data.kills = kills;
                character.data.deaths = deaths;
                character.refreshName();
            });
        }});

        result.messageHandler.on({id: '@updateKd', func: (json: any) => {
            if (!_.isNumber(json.id) || !_.isNumber(json.kills) || !_.isNumber(json.deaths)) {
                console.warn('kd data not numbers');
                return;
            }

            const character = result.characterMap.get(json.id) as DuelZoneNetCharacter;
            character.data.kills = json.kills;
            character.data.deaths = json.deaths;
            character.refreshName();
        }});

        detachedControls.onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'e' && scene.controller.uiBoxes.length === 1) {
                scene.controller.uiBoxes.push(new GameScene.UiBox([
                    '[Weapon list]', '1) Sterilizer', '2) Purifier', '3) Snub Cannon'
                ], Math.random() * 50, Math.random() * 50, 250));
            } else if (e.key === 'p') {
                component.setState({isStoreShown: true});
            }
        };
        detachedControls.onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'e' && scene.controller.uiBoxes.length === 2) {
                scene.controller.uiBoxes.splice(1, 1);
            }
        };

        const canvasCasted = canvas as HTMLCanvasElement;
        Scene.playScene({fps: 60, canvas: canvasCasted, scene});
    };

    KazeClient.connectToServer({
        url,
        onConnect,
        onError,
        onClose,
        detachedControls,
        addCharacter,
        deleteCharacter,
        spawnBullet,
        spawnExplosion,
        getWeapon,
        getExplosionType,
        name: promptName
    });
}
