// TODO - Server side zero vector aim check

import _ = require('lodash');
import WebSocket = require('ws');
import path = require('path');
import http = require('http');

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

export interface IServerOptions {
    port: number;
    viewportWidth: number;
    viewportHeight: number;
    onConnect: (result: IOnConnectResult) => void;
    onClose: (result: IOnCloseResult) => void;
    hookOnUpdate: (onUpdate: (diff: number, c: GameScene.Controller) => void) => void;
    addCharacter: (name: string) => Character;
    deleteCharacter: (character: Character) => void;
}

export interface IOnCloseResult {
    ip: string;
}

export interface IOnConnectResult {
    ws: WebSocket;
    messageHandler: MessageHandler<MessageSource>;
    ip?: string;
}

class Client {
    isInit: boolean;
    character?: Character;
    readonly sentBullets: WeakSet<GameScene.Bullet> = new WeakSet<GameScene.Bullet>();
    readonly sentExplosions: WeakSet<GameScene.Explosion> = new WeakSet<GameScene.Explosion>();
    constructor(public ip?: string) {}
}

interface IVisibleCharacters {
    lastVisible: Set<Character>;
    currentVisible: Set<Character>;
}

export class Server {
    static getInstance(options: IServerOptions): Server {
        if (Server.instance) throw new Error('server already setup');
        return new Server(options);
    }

    private static MaxNameLength = 20;
    private static instance: Server | null = null;

    private static fixName(candidateName: string): string {
        const postStringCheck = typeof candidateName === 'string' &&
            candidateName.trim() !== '' ? candidateName : 'Anonymous';
        return postStringCheck.substring(0, Server.MaxNameLength);
    }

    private static getCharacterSubset(character: Character): Shared.CharacterInit {
        return _.pick(character, ['id', 'type', 'name']) as Shared.CharacterInit;
    }

    //////////////////////////////////////////////////

    readonly characterMap = new Map<WebSocket, Character>();
    readonly messageHandler = new MessageHandler<MessageSource>();

    private clientMap = new Map<WebSocket, Client>();
    private visibilityTracker = new Map<Client, IVisibleCharacters>();
    private wss: WebSocket.Server;

    private constructor(public options: IServerOptions) {
        this.wss = new WebSocket.Server({port: options.port});
    }

    broadcast(data: any): boolean {
        // Public interface does not expose messaging unsetup clients
        return this.broadcastP(data, true);
    }

    start(): void {
        this.wss.on('connection', this.onNewConnection);
        console.log('listening');
    }

    //////////////////////////////////////////////////

    // *isInitOnly* - Only broadcast if the client is completely setup
    private broadcastP(data: any, isInitOnly = true): boolean {
        let failed = false;
        for (const [ws, client] of this.clientMap.entries()) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    if (!isInitOnly || (client.isInit && client.character)) {
                        ws.send(data);
                    }
                }
            } catch (e) {
                console.log('mid broadcast error ' + e.toString());
                failed = true;
            }
        }
        return failed;
    }

    // Messages are either a string which implies JSON with at least a "type" field
    // or a byte array with the first byte being an ID from GsNetwork.CallType.
    // Route to message handler
    private makeOnMessage(ws: WebSocket): ((d: WebSocket.Data) => void) {
        return (message: WebSocket.Data) => {
            try {
                if (typeof message === 'string') {
                    const json = JSON.parse(message as string);
                    if (!json.type) throw new Error('invalid json type field');
                    this.messageHandler.emit(json.type, ws, new MessageSource(ws, json));
                } else if (message instanceof Buffer) { // Buffer = Pre-ES6 NodeJS equivalent of ArrayBuffer
                    const view = new DataView((new Uint8Array(message as Buffer)).buffer); // Convert to UInt8Array ES6 interface...
                    //** First byte is call type convention
                    this.messageHandler.emit(view.getUint8(0), ws, new MessageSource(ws, view));
                } else {
                    console.error('unexpected ws message type ' + typeof message);
                }
            } catch (e) {
                console.error('message handler failed ' + e.message.toString());
            }
        };
    }

    private makeOnClose(ws: WebSocket): (() => void) {
        return () => {
            try {
                if (this.clientMap.has(ws)) {
                    const client = this.clientMap.get(ws) as Client;

                    const character = client.character;
                    if (character) {
                        this.options.deleteCharacter(character);
                        this.broadcastP(JSON.stringify({
                            type: 'deleteChar',
                            character: Server.getCharacterSubset(character)
                        }));
                    }

                    const ip = client.ip || '<NO IP?>';
                    this.options.onClose({ip});
                    console.log(`${ip} closed`);

                    this.clientMap.delete(ws);
                    this.characterMap.delete(ws);
                }
            } catch (e) {
                console.error('ws close failed ' + e.message.toString());
            }
        };
    }

    private onUpdateHook = (diff: number, controller: GameScene.Controller): void => {
        try {
            // Send each client only game state which needs to be sent
            this.clientMap.forEach((client: Client, clientWs: WebSocket) => {

                if (clientWs.readyState !== WebSocket.OPEN) return;
                if (!client.isInit || !client.character) return;
                if (!this.visibilityTracker.has(client)) throw new Error('visibility tracker does not have client?');

                const tracker = this.visibilityTracker.get(client) as IVisibleCharacters;
                const centerX = client.character.position.x + client.character.size.x;
                const centerY = client.character.position.y + client.character.size.y;
                const x1 = centerX - this.options.viewportWidth / 2;
                const y1 = centerY - this.options.viewportHeight / 2;
                const x2 = x1 + this.options.viewportWidth;
                const y2 = y1 + this.options.viewportHeight;

                tracker.currentVisible.clear();
                controller.grid.loopPixels(x1, y1, x2, y2, true, (b: SpatialHash.Block, bx, by) => {

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
                        if (rect instanceof Character) {
                            const character = rect as Character;
                            tracker.lastVisible.delete(character);
                            tracker.currentVisible.add(character);
                        } else if (rect instanceof GameScene.Explosion) {
                            const explosion = rect as GameScene.Explosion;
                            if (!client.sentExplosions.has(explosion)) {
                                // TODO - Test removal
                                client.sentExplosions.add(explosion);
                                const eSpawn = GsNetwork.serialize[GsNetwork.CallType.ExplosionSpawn](explosion);
                                clientWs.send(eSpawn);
                            }
                        }
                    });

                    return false;
                });

                // Signal removal of invisible
                tracker.lastVisible.forEach((character: Character) => {
                    const snapshot = GsNetwork.serialize[GsNetwork.CallType.UnsyncChar](character);
                    clientWs.send(snapshot);
                });

                // Update visible
                tracker.currentVisible.forEach((character: Character) => {
                    const snapshot = GsNetwork.serialize[GsNetwork.CallType.SyncChar](character, diff);
                    clientWs.send(snapshot);
                });

                // Current visible moves to last visible
                const temp = tracker.lastVisible;
                tracker.lastVisible = tracker.currentVisible;
                tracker.currentVisible = temp;
            });
        } catch (e) {
            console.error('exception in OnUpdateHook - ' + e.message.toString());
        }
    }

    // Received any player's input request
    private onSyncControls = ({ws, msg}: MessageSource): void => {
        if (!this.clientMap.has(ws)) throw new Error('SyncControls without connection?');
        const client = this.clientMap.get(ws) as Client;
        if (client.isInit && client.character) {
            GsNetwork.deserialize[GsNetwork.CallType.SyncControls](client.character, msg);
        }
    }

    // Finished setup
    private onGameStateDone = ({ws, msg}: MessageSource): void => {
        if (!this.clientMap.has(ws)) throw new Error('gameStateDone without connection?');
        const client = this.clientMap.get(ws) as Client;
        if (!client.character) throw new Error('could not find newly added character?');

        // Signal to all presence of this character
        this.broadcastP(JSON.stringify({
            type: 'addChar',
            character: Server.getCharacterSubset(client.character)
        }));
        client.character.off = false; // Now part of physics
        client.isInit = true; // Marked as completely finished init
        this.visibilityTracker.set(client, {
            currentVisible: new Set<Character>(),
            lastVisible: new Set<Character>()
        });

        this.characterMap.set(ws, client.character);

        // Alert game scene layer of new fully setup connection
        this.options.onConnect({
            ws, ip: client.ip, messageHandler: this.messageHandler
        });
    }

    private getOtherCharSubsets(): Shared.CharacterInit[] {
        const clients = Array.from(this.clientMap.values());
        const initClients = clients.filter((client) => client.isInit);
        //** If isInit, should have defined character
        const characters = initClients.map((client) => Server.getCharacterSubset(client.character as Character));
        return characters;
    }

    // Initial join request
    private onJoinGame = ({ws, msg}: MessageSource): void => {
        if (!this.clientMap.has(ws)) throw new Error('joinGame without connection?');

        const character = this.options.addCharacter(Server.fixName(msg.name)); // Reserve new ID
        character.off = true; // But disable all interaction before fully setup
        const client = this.clientMap.get(ws) as Client;
        client.character = character;
        const chrSubsets = this.getOtherCharSubsets(); //** Current character not in here because not setup
        chrSubsets.push(Server.getCharacterSubset(character));

        // Response pattern. Send data, expect a response by setting a one time
        // receiver that only listens for this specific ws.
        // Waits for ack from client that it is capable of receiving positions
        // because it has to setup itself using the initial game state dump.
        this.messageHandler.on({
            id: 'gameStateDone',
            isOnce: true,
            receiver: ws,
            func: this.onGameStateDone
        });

        ws.send(JSON.stringify({
            type: 'gameState',
            characters: chrSubsets,
            playerId: character.id
        }));

        console.log(`${client.ip} joined game as ${character.name} with id ${character.id}`);
    }

    private onNewConnection = (ws: WebSocket, req: http.IncomingMessage): void => {
        this.clientMap.set(ws, new Client(req.connection.remoteAddress));
        console.log('connection ' + req.connection.remoteAddress || '<NO IP?>');
        ws.on('message', this.makeOnMessage(ws));
        ws.on('close', this.makeOnClose(ws));
        this.options.hookOnUpdate(this.onUpdateHook);
        //** Exception handlers for these exist on onMessage
        this.messageHandler.on({id: GsNetwork.CallType.SyncControls, func: this.onSyncControls});
        this.messageHandler.on({id: 'joinGame', func: this.onJoinGame});
    }
}
