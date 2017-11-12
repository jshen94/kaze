
//////////////////////////////////////////////////
// Network layer for client
//////////////////////////////////////////////////

import _ = require('lodash');

import Controls = require('./controls');
import GameScene = require('./game-scene');
import GsNetwork = require('./game-scene-network');
import MsgHandler = require('./msg-handler');
import LagMaker = require('./lag-maker');
import Shared = require('./client-server');
import MessageHandler = MsgHandler.MessageHandler;

import NetworkedCharacter = GameScene.NetworkedCharacter;

const CONTROL_UPLOAD_MS = 1000 / 30;
const SERVER_FPS = 60;
const FAKE_LAG_UPLOAD_MS = 0;
const FAKE_LAG_DOWNLOAD_MS = 0;

export type Message = DataView | any;

export type ClientOptions = {
    url: string;
    name: string;

    onConnect: (r: OnConnectResult) => void;
    onError: (e: Event) => void;
    onClose:  () => void;

    detachedControls: Controls.Controls;
    addCharacter: (i: Shared.CharacterInit) => NetworkedCharacter;
    deleteCharacter: (id: number) => void;

    spawnBullet: (
        owner: NetworkedCharacter, weapon: GameScene.Weapon,
        x: number, y: number, vx: number, vy: number
    ) => void;

    getWeapon: (id: number) => GameScene.Weapon;
}

export type OnConnectResult = {
    ws: WebSocket;
    messageHandler: MessageHandler<Message>;
    characterMap: Map<number, NetworkedCharacter>;
    playerId: number;
}

const addMessageCallback = (
    connection: WebSocket,
    onWsMessage: (e: Event) => void,
    lagDownload: number
): void => {
    if (lagDownload) {
        // Re-route through lag maker
        console.log(`using fake download lag ms of ${lagDownload}`);
        const downLagMaker = new LagMaker.LagMaker({
            send: onWsMessage, 
            averageFps: SERVER_FPS,
            fixedDelay: lagDownload
        });
        connection.onmessage = downLagMaker.send;
        downLagMaker.start();
    } else {
        connection.onmessage = onWsMessage;
    }
};

const getSend = (connection: WebSocket, lagUpload: number)
    : ((msg: any) => void) => {
    if (lagUpload) {
        console.log(`using fake upload lag ms of ${lagUpload}`);
        const upLagMaker = new LagMaker.LagMaker({
            send: connection.send.bind(connection), 
            averageFps: SERVER_FPS,
            fixedDelay: lagUpload
        });
        upLagMaker.start();
        return upLagMaker.send;
    } else {
        return connection.send.bind(connection);
    }
};

export const connectToServer = (options: ClientOptions): void => {
    const connection = new WebSocket(options.url);
    connection.binaryType = 'arraybuffer'; // Still can send strings
    connection.onerror = options.onError;
    connection.onclose = options.onClose;

    const characterMap = new Map<number, NetworkedCharacter>(); // ID -> Character
    let player: NetworkedCharacter | undefined = undefined;

    const addCharacter = (attributes: Shared.CharacterInit): NetworkedCharacter => {
        const character = options.addCharacter(attributes);
        characterMap.set(attributes.id, character);
        return character;
    };

    const deleteCharacter = (id: number): void => {
        options.deleteCharacter(id);
        characterMap.delete(id);
    };

    const resolveSpawnBullet = (
        ownerId: number, weaponId: number,
        x: number, y: number, vx: number, vy: number
    ): void => {
        // Is still found if owner is outside visibility, position of owner is just wrong
        // Sanity check - ownerId is not the local spatial hash ID
        const owner = characterMap.get(ownerId);
        if (owner === undefined) throw 'invalid networked bullet owner';
        const weapon = options.getWeapon(weaponId);
        options.spawnBullet(owner, weapon, x, y, vx, vy);
    };

    // Redirect messages through handler
    // Messages are either a string which implies JSON with at least a "type" field
    // or a byte array with the first byte being an ID from GsNetwork.netIds.
    const messageHandler = new MessageHandler<Message>();
    const onWsMessage = (e: Event): void => {
        const me = e as MessageEvent;
        if (me.data === null || me.data === undefined) {
            console.assert(false, 'invalid ws data received');
        } else {
            if (typeof me.data === 'string') {
                const json = JSON.parse(me.data);
                console.assert(json.type, 'invalid json type');
                messageHandler.emit(json.type, false, json);
            } else if (me.data instanceof ArrayBuffer){
                const view = new DataView(me.data);
                messageHandler.emit(view.getUint8(0), false, view);
            }
        }
    };

    addMessageCallback(connection, onWsMessage, FAKE_LAG_DOWNLOAD_MS);
    const send = getSend(connection, FAKE_LAG_UPLOAD_MS);

    //////////////////////////////////////////////////

    connection.onopen = () => {
        send(JSON.stringify({type: 'joinGame', name: options.name}));
    };

    const syncPlayer = () => {
        const data = GsNetwork.serialize[GsNetwork.CallType.SyncControls](options.detachedControls);
        send(data);
    };

    // Got list of server character IDs, types, and player ID
    messageHandler.on({id: 'gameState', func: (json: any) => {
        json.characters.forEach((ch: Shared.CharacterInit) => addCharacter(ch));
        if (!_.isNumber(json.playerId)) throw 'invalid player id from server';
        player = characterMap.get(json.playerId);
        if (player === undefined) throw 'could not find player';
        send(JSON.stringify({type: 'gameStateDone'}));
        setInterval(syncPlayer, CONTROL_UPLOAD_MS);
        options.onConnect({ws: connection, messageHandler, characterMap, playerId: json.playerId});
    }});

    messageHandler.on({id: 'addChar', func: (json: any) => {
        if (player === undefined || player === null)
            throw 'invalid player id';

        if (json === undefined || json === null ||
            json.character === undefined || json.character === null ||
            !_.isNumber(json.character.id))
            throw 'invalid character id from server';

        if (json.character.id !== player.id) {
            addCharacter(json.character);
        }
    }});

    messageHandler.on({id: 'deleteChar', func: (json: any) => {
        if (player === undefined || player === null)
            throw 'invalid player id';

        if (json === undefined || json === null ||
            json.character === undefined || json.character === null ||
            !_.isNumber(json.character.id))
            throw 'invalid character id from server';

        if (json.character.id !== player.id) {
            deleteCharacter(json.character.id);
        }
    }});

    // Sync snapshot of network character
    messageHandler.on({id: GsNetwork.CallType.SyncChar, func: (view: DataView) => {
        if (player === undefined) {
            console.assert(false, 'server tried to sync before player setup');
            return;
        }

        const id = GsNetwork.quickGetCharacterId(view);
        if (characterMap.has(id)) {
            const character = characterMap.get(id) as NetworkedCharacter;
            GsNetwork.deserialize[GsNetwork.CallType.SyncChar](character.interpolator, view);
        }
    }});

    messageHandler.on({id: GsNetwork.CallType.BulletSpawn, func: (view: DataView) => {
        GsNetwork.deserialize[GsNetwork.CallType.BulletSpawn](resolveSpawnBullet, view);
    }});
};
