// TODO - More robustness
// TODO - Server side zero vector aim check

import _ = require('lodash');
import WebSocket = require('ws');
import path = require('path');

import GameScene = require('./game-scene');
import GsNetwork = require('./game-scene-network');
import MsgHandler = require('./msg-handler');
import Shared = require('./client-server');
import Calcs = require('./calcs');
import SpatialHash = require('./spatial-hash');
import Character = GameScene.Character;
import MessageHandler = MsgHandler.MessageHandler;
import Vec2d = Calcs.Vec2d;

export type Message = DataView | any; // any = JSON

export class MessageSource {
    constructor(public ws: WebSocket, public msg: Message) {}
}

export type ServerOptions = {
    port: number;
    viewportWidth: number;
    viewportHeight: number;
    onConnect: (result: OnConnectResult) => void;
    onClose: (result: OnCloseResult) => void;
    hookOnUpdate: (onUpdate: (diff: number, c: GameScene.Controller) => void) => void;
    addCharacter: (name: string) => Character;
    deleteCharacter: (character: Character) => void;
}

export type OnCloseResult = {
    ip: string;
}

export type OnConnectResult = {
    ws: WebSocket; 
    messageHandler: MessageHandler<MessageSource>;
    ip: string | undefined;
    broadcast: (msg: any) => void; 
}

class Client {
    isInit: boolean;
    character?: Character;
    sentBullets: WeakSet<GameScene.Bullet> = new WeakSet<GameScene.Bullet>();
    constructor(public ip: string | undefined) {}
}

type DoubleCharacterSet = {
    lastVisible: Set<GameScene.Character>;
    currentVisible: Set<GameScene.Character>;
}

export const startServer = (options: ServerOptions): void => {

    const clientMap = new Map<WebSocket, Client>();
    const visibilityTracker = new Map<Client, DoubleCharacterSet>();

    const messageHandler = new MessageHandler<MessageSource>();
    const wss = new WebSocket.Server({port: options.port});

    // *isInitOnly* - Only broadcast if the client is completely setup
    const broadcast = (data: any, isInitOnly = true): void => {
        for (const [ws, client] of clientMap.entries()) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    if (!isInitOnly || (client.isInit && client.character)) {
                        ws.send(data);
                    }
                }
            } catch (e) {
                console.log('mid broadcast error ' + e.toString());
            }
        }
    };

    wss.on('connection', (ws, req) => {
        clientMap.set(ws, new Client(req.connection.remoteAddress));
        console.log('connection ' + req.connection.remoteAddress || '<NO IP?>');

        // Messages are either a string which implies JSON with at least a "type" field
        // or a byte array with the first byte being an ID from GsNetwork.CallType.
        // Route to message handler
        ws.on('message', (message) => {
            if (typeof message === 'string') {
                try {
                    const json = JSON.parse(message as string);
                    if (!json.type) throw 'invalid json type field';
                    messageHandler.emit(json.type, ws, new MessageSource(ws, json));
                } catch (e) {
                    console.error('json handler failed ' + e.toString());
                }
            } else if (message instanceof Buffer) { // Buffer = Pre-ES6 NodeJS equivalent of ArrayBuffer
                try {
                    const view = new DataView((new Uint8Array(message as Buffer)).buffer); // Convert to UInt8Array ES6 interface...
                    // First byte is call type convention
                    messageHandler.emit(view.getUint8(0), ws, new MessageSource(ws, view));
                } catch (e) {
                    console.error('array buffer handler failed ' + e.toString());
                }
            } else {
                console.error('unexpected ws message type');
            }
        });

        ws.on('close', () => {
            if (clientMap.has(ws)) {
                const client = clientMap.get(ws) as Client;

                const character = client.character;
                if (character) {
                    options.deleteCharacter(character);
                    broadcast(JSON.stringify({
                        type: 'deleteChar',
                        character: _.pick(character, ['id', 'type', 'name'])
                    }));
                }

                const ip = client.ip || '<NO IP?>';
                options.onClose({ip});
                console.log(`${ip} closed`);

                clientMap.delete(ws);
            } 
        });
    });

    options.hookOnUpdate((diff: number, controller: GameScene.Controller) => {
        clientMap.forEach((client: Client, clientWs: WebSocket) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            if (!client.isInit || !client.character) return;
            if (!visibilityTracker.has(client)) throw 'visibility tracker does not have client?';

            const tracker = visibilityTracker.get(client) as DoubleCharacterSet;
            const centerX = client.character.position.x + client.character.size.x;
            const centerY = client.character.position.y + client.character.size.y;
            const x1 = centerX - options.viewportWidth / 2;
            const y1 = centerY - options.viewportHeight / 2;
            const x2 = x1 + options.viewportWidth;
            const y2 = y1 + options.viewportHeight;

            tracker.currentVisible.clear();
            controller.grid.loopPixels(x1, y1, x2, y2, true, (b: SpatialHash.Block, bx, by) => {
                // TODO Exception while looping

                b.dots.forEach((dot: SpatialHash.Dot) => {
                    if (dot instanceof GameScene.Bullet) {
                        const bullet = dot as GameScene.Bullet;
                        if (!client.sentBullets.has(bullet)) {
                            // TODO - Test removal
                            client.sentBullets.add(bullet);
                            const bSpawn = GsNetwork.serialize[GsNetwork.CallType.BulletSpawn](bullet);
                            clientWs.send(bSpawn);
                        }
                    }
                });

                // What's left of *lastVisible* after looping through all blocks
                // should be characters visible in last frame but not seen in this frame
                // *currentVisible* should contain visible characters this frame
                b.rects.forEach((rect: SpatialHash.Rect) => {
                    if (rect instanceof GameScene.Character)  {
                        const character = rect as Character;
                        tracker.lastVisible.delete(character);
                        tracker.currentVisible.add(character);
                    }
                });

                return false;
            });

            // Signal removal of invisible
            tracker.lastVisible.forEach((character: GameScene.Character) => {
                const snapshot = GsNetwork.serialize[GsNetwork.CallType.UnsyncChar](character);
                clientWs.send(snapshot);
            });

            // Update visible
            tracker.currentVisible.forEach((character: GameScene.Character) => {
                const snapshot = GsNetwork.serialize[GsNetwork.CallType.SyncChar](character, diff);
                clientWs.send(snapshot);
            });

            // Current visible moves to last visible
            const temp = tracker.lastVisible;
            tracker.lastVisible = tracker.currentVisible;
            tracker.currentVisible = temp;
        });
    });

    messageHandler.on({id: GsNetwork.CallType.SyncControls, func: ({ws, msg}) => {
        if (!clientMap.has(ws)) throw 'SyncControls without connection?';
        const client = clientMap.get(ws) as Client;
        if (client.isInit && client.character) {
            GsNetwork.deserialize[GsNetwork.CallType.SyncControls](client.character, msg);
        }
    }});

    const MAX_NAME_LENGTH = 20;
    const fixName = (candidateName: string): string => {
        const postStringCheck = typeof candidateName === 'string' && candidateName.trim() !== '' ? candidateName : 'Anonymous';
        return postStringCheck.substring(0, MAX_NAME_LENGTH);
    };

    messageHandler.on({id: 'joinGame', func: ({ws, msg}) => {
        if (!clientMap.has(ws)) throw 'joinGame without connection?';

        const character = options.addCharacter(fixName(msg.name)); // Reserve new ID
        character.off = true; // But disable all interaction before fully setup
        const client: Client = clientMap.get(ws) as Client;
        client.character = character;

        console.log(`${client.ip} joined game as ${character.name} with id ${character.id}`);

        // Prepare a list of other characters in the game
        const otherCharacters: Shared.CharacterInit[] = [];
        for (const otherClient of clientMap.values()) {
            if (otherClient === client) continue;
            if (otherClient.isInit && otherClient.character) {
                const otherCharacter = otherClient.character;
                otherCharacters.push({id: otherCharacter.id, type: otherCharacter.type, name: otherCharacter.name});
            }
        }
        otherCharacters.push(character);

        // Response pattern. Send data, expect a response by setting a one time
        // receiver that only listens for this specific ws.
        // ---
        // Waits for ack from client that it is capable of receiving positions 
        // because it has setup itself using the initial game state dump
        messageHandler.on({id: 'gameStateDone', isOnce: true, receiver: ws, func: ({ws: WebSocket, msg: any}) => {
            if (!clientMap.has(ws)) throw 'gameStateDone without connection?';
            const client = clientMap.get(ws) as Client;
            if (!client.character) throw 'could not find newly added character?';

            // ** End of character setup **

            const character = client.character;
            // Signal to all presence of this client
            broadcast(JSON.stringify({
                type: 'addChar',
                character: _.pick(character, ['id', 'type', 'name'])
            }));
            character.off = false; // Now part of physics
            client.isInit = true; // Completely finished init
            visibilityTracker.set(client, {
                currentVisible: new Set<GameScene.Character>(),
                lastVisible: new Set<GameScene.Character>()
            });
            // Hooks
            options.onConnect({ws, messageHandler, ip: client.ip, broadcast});
        }});

        ws.send(JSON.stringify({
            type: 'gameState', 
            characters: otherCharacters, 
            playerId: character.id 
        }));
    }});

    console.log('listening');
};
