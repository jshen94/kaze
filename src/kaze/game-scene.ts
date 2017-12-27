//////////////////////////////////////////////////
// Main gameplay loop, drawing, physics, etc
//////////////////////////////////////////////////

import Calcs = require('./calcs');
import Draw = require('./draw');
import Controls = require('./controls');
import Interpolator_ = require('./interpolator');
import GsNetwork = require('./game-scene-network');
import SpatialHash = require('./spatial-hash');
import FloorTileGrid = require('./floor-tile-grid');
import Scene = require('./scene');

import Vec2d = Calcs.Vec2d;
import Direction = Controls.Direction;
import BarrierType = FloorTileGrid.BarrierType;
import Interpolator = Interpolator_.Interpolator;

// Pass to createGameScene to create update loop
export class GameSceneData {
    private readonly zeroVector: Vec2d = new Vec2d(0, 0);
    camera: () => Vec2d = () => this.zeroVector;
    cameraOffset: Vec2d = new Vec2d(0, 0);

    floorColor: string = '#223322';
    outOfMapColor: string = 'black';
    bounceMultiplier: number = 0.8;
    frictionAccelMag: number = 0.0002;

    // Tiles
    blockWidth: number | null = 10; // null = Infinite
    blockHeight: number | null = 10;
    blockLength: number = 50;
    getFloorTile?: (i: number, j: number) => Draw.AnimatedSpriteSheet | null;
    getBarrierType?: (i: number, j: number) => BarrierType | null;

    // Events
    onCharacterBulletHit?: (c: Controller, ch: Character, b: Bullet) => boolean;
    onNetCharacterBulletHit?: (c: Controller, ch: NetworkedCharacter, b: Bullet) => boolean;
    onCharacterThingCollision?: (c: Controller, ch: Character, t: Thing) => boolean;
    onNetCharacterThingCollision?: (c: Controller, ch: NetworkedCharacter, t: Thing) => boolean;

    // Hooks
    onUpdate?: (diff: number, c: Controller) => void;
    onBegin?: (c: Controller) => void;
    onFinish?: (c: Controller) => void;
}

export enum SolidType {NotSolid, BlockAll, BlockCharacter}

export interface HasSpriteSheet {
    spriteSheetIndex: number;
    spriteSheets: Draw.AnimatedSpriteSheet[];
}

export interface DrawableCharacter extends HasSpriteSheet, SpatialHash.Rect {
    id: number;
    size: Vec2d;
    position: Vec2d;
    aim: Vec2d;
    hp: number;
    maxHp: number;
    type: number;
    name: string;
    off: boolean;
}

export class Thing extends SpatialHash.Rect implements HasSpriteSheet {
    spriteSheetIndex: number;
    spriteSheets: Draw.AnimatedSpriteSheet[];

    constructor(public solidType: SolidType) {
        super(new Vec2d(50, 50), new Vec2d(0, 0));
    }
}

export enum BulletShape {Line, Circle}

export class Weapon {
    private static idCounter: number = 0;
    readonly id: number = Weapon.idCounter++; // Must be unsigned byte
    damage: number = 200;
    lifetime: number = 2000;
    color: string = '#00ffff';
    speed: number = 0.225;
    shots: number = 3;
    reload: number = 1000;
    rate: number = 200;
    bulletShape: BulletShape = BulletShape.Circle;
    bulletLength: number = 4;
}

export class Bullet extends SpatialHash.Dot {
    lifetime: number;

    constructor(
        public owner: DrawableCharacter,
        public weapon: Weapon, 
        public velocity: Vec2d, position: Vec2d) {
        super(position);
        this.lifetime = weapon.lifetime;
    }

    static shootFrom(owner: DrawableCharacter, weapon: Weapon): Bullet {
        return new Bullet(
            owner, weapon,
            Vec2d.copy(owner.aim).magnitude(weapon.speed),
            new Vec2d(owner.position.x + owner.size.x / 2, owner.position.y + owner.size.y / 2)
        );
    }
}

export class Character extends SpatialHash.Rect implements DrawableCharacter {
    customBounceMultiplier: number | null = null;
    autoVBounce: boolean = false;
    autoHBounce: boolean = false;
    disableBackpeddle: boolean = false;
    wrapMap: boolean = false;
    off: boolean = false;
    maxHp: number = 1000;
    hp: number = this.maxHp;
    name: string = 'Character';
    type: number = 0;
    
    maxSpeed: number = 87 / 1000; // Pixels / second
    movementAccelMag: number = 0.3 / 1000;
    rotateSpeed: number = 3.5 / 1000; // Radians / second
    rotateDirection: Direction = Direction.Stationary;
    accel: Vec2d = new Vec2d(0, 0);
    velocity: Vec2d = new Vec2d(0, 0);
    aim: Vec2d = new Vec2d(0, -1);
    desiredAim: Vec2d = new Vec2d(0, -1);
    horizontal: Direction = Direction.Stationary;
    vertical: Direction = Direction.Stationary;
    firing: boolean = false;

    timeTillShot: number = 0;
    shotsBeforeReload: number = 0;
    weapons: Weapon[] = [new Weapon];
    private weaponIndex: number = 0;

    spriteSheetIndex: number = -1;
    spriteSheets: Draw.AnimatedSpriteSheet[] = [];

    controls: Controls.Controls = new Controls.Controls; 

    constructor(width: number, height: number) {
        super(new Vec2d(width, height), new Vec2d(0, 0));
    }

    getCurrentWeapon = (): Weapon => {
        return this.weapons[this.weaponIndex];
    }

    setWeaponIndex = (index: number): void => {
        if (index < this.weapons.length) {
            this.weaponIndex = index;
        }
    }
}

export const NetSnapshotMax = 32;
export class NetworkedCharacter extends SpatialHash.Rect implements DrawableCharacter {
    aim: Vec2d = new Vec2d(0, -1);

    maxHp: number = 1000;
    hp: number = this.maxHp;
    off: boolean = false;

    interpolator: Interpolator<GsNetwork.CharacterPartial> = new Interpolator<GsNetwork.CharacterPartial>(NetSnapshotMax);
    networkT: number = 0;

    type: number = 0;
    name: string = 'NetCharacter';

    spriteSheetIndex: number;
    spriteSheets: Draw.AnimatedSpriteSheet[];

    constructor(public readonly serverId: number, width: number, height: number) {
        super(new Vec2d(width, height), new Vec2d(0, 0));
    }
}

// Passed by createGameScene to callbacks inside GameSceneData 
// so that the receiver can manipulate the scene while it's running
export class Controller {
    isFinished: boolean = false;
    grid: SpatialHash.SpatialHash;
    uiBoxes: UiBox[] = [];

    constructor(data: GameSceneData) {
        this.grid = new SpatialHash.SpatialHash(data.blockWidth, data.blockHeight, data.blockLength); 
    }
}

export class UiBox {
    private static idCounter: number = 0;
    readonly id: number = UiBox.idCounter++;
    constructor(
        public lines: string[],
        public x: number = 0,
        public y: number = 0,
        public width: number = 150) {} // Height proportional to lines count
}

export interface GameScene extends Scene.Scene {
    controller: Controller;
}

export const createGameScene = (data: GameSceneData): GameScene => {
    const controller = new Controller(data);

    const begin = (context: CanvasRenderingContext2D | null): void => {
        if (context !== null) {
            context.font = '10pt Courier';
            context.textBaseline = 'top';
        }
        if (data.onBegin) data.onBegin(controller);
    };

    const visibleRects = new Set<SpatialHash.Rect>();
    const draw = (context: CanvasRenderingContext2D, width: number, height: number): void => {
        // Center of player
        const camera = data.camera();
        const playerCenterX = camera.x + data.cameraOffset.x; 
        const playerCenterY = camera.y + data.cameraOffset.y;

        // Position of screen corners in world space
        const x1 = playerCenterX - width / 2;
        const y1 = playerCenterY - height / 2;
        const x2 = x1 + width;
        const y2 = y1 + height;

        // Position of map corners relative to top-left corner of screen, clipped
        // Handle infinite map size
        const bgX1 = controller.grid.pixelWidth ? Math.max(0, -x1) : 0; 
        const bgY1 = controller.grid.pixelHeight ? Math.max(0, -y1) : 0;
        const bgX2 = controller.grid.pixelWidth ? Math.min(width, controller.grid.pixelWidth - x1) : width;
        const bgY2 = controller.grid.pixelHeight ? Math.min(height, controller.grid.pixelHeight - y1) : height;

        Draw.drawRect(context, 0, 0, width, height, data.outOfMapColor);
        Draw.drawRect(context, bgX1, bgY1, bgX2, bgY2, data.floorColor);

        controller.grid.loopPixels(x1, y1, x2, y2, true, (b: SpatialHash.Block, bx, by) => {
            if (data.getFloorTile === undefined) return false;
            const spriteSheet = data.getFloorTile(bx, by);
            if (spriteSheet === null) return false;

            // Position of tile relative to top-left corner of screen
            const tileX = bx * controller.grid.blockLength - x1;
            const tileY = by * controller.grid.blockLength - y1;
            spriteSheet.draw(context, tileX, tileY, controller.grid.blockLength, controller.grid.blockLength);

            return false;
        });

        controller.grid.loopPixels(x1, y1, x2, y2, true, (b: SpatialHash.Block) => {
            b.dots.forEach((dot: SpatialHash.Dot) => {
                if (dot instanceof Bullet) {
                    const bullet = dot as Bullet;
                    if (bullet.weapon.bulletShape === BulletShape.Circle) {
                        Draw.drawCircle(context, 
                            bullet.position.x - x1, bullet.position.y - y1,
                            bullet.weapon.bulletLength / 2, bullet.weapon.color);
                    } else if (bullet.weapon.bulletShape === BulletShape.Line) {
                        const vNorm = Calcs.Vec2d.magnitude(bullet.velocity, 1); 
                        Draw.drawLine(
                            context, 
                            bullet.position.x - vNorm.x * bullet.weapon.bulletLength - x1,
                            bullet.position.y - vNorm.y * bullet.weapon.bulletLength - y1,
                            bullet.position.x - x1,
                            bullet.position.y - y1,
                            bullet.weapon.color, 2);
                    } 
                }
            });
            return false;
        });

        visibleRects.clear();

        controller.grid.loopPixels(x1, y1, x2, y2, true, (b: SpatialHash.Block) => {
            b.rects.forEach((rect: SpatialHash.Rect) => {
                visibleRects.add(rect);
            });
            return false;
        });

        visibleRects.forEach((rect: SpatialHash.Rect) => {
            const rectX = rect.position.x - x1;
            const rectY = rect.position.y - y1;

            if (rect instanceof Character || rect instanceof NetworkedCharacter) {
                const character = rect as DrawableCharacter;
                if (character.off) return;

                const sprite = character.spriteSheets[character.spriteSheetIndex];
                if (!sprite) throw 'invalid sprite index for character'; 

                const halfSizeX = character.size.x / 2;
                const halfSizeY = character.size.y / 2;

                context.translate(rectX + halfSizeX, rectY + halfSizeY);
                context.rotate(character.aim.atan2());
                sprite.draw(context, -halfSizeX, -halfSizeY, character.size.x, character.size.y);
                context.setTransform(1, 0, 0, 1, 0, 0); // Identity matrix

                const hpBarY = rectY - 6;
                const hpBarWidth = character.size.x + 10;
                const hpBarX = rectX + (character.size.x - hpBarWidth) / 2;

                Draw.drawRect(context, hpBarX, hpBarY, hpBarWidth, 4, '#aa0000');
                Draw.drawRect(context, hpBarX, hpBarY, (character.hp / character.maxHp) * hpBarWidth, 4, '#00aa00');
                Draw.drawText(context, rectX + character.size.x / 2, rectY - 22, character.name, '#eeeecc', 'center');
            } else if (rect instanceof Thing) {
                const thing = rect as Thing;
                const sprite = thing.spriteSheets[thing.spriteSheetIndex];
                if (!sprite) throw 'invalid sprite index for character'; 

                sprite.draw(context, thing.position.x, thing.position.y, thing.size.x, thing.size.y);
            }

            return false;
        });

        const LINE_HEIGHT = 15;
        for (const uiBox of controller.uiBoxes) {
            const height = LINE_HEIGHT * uiBox.lines.length + 10;
            Draw.drawRect(context, uiBox.x, uiBox.y, uiBox.width, height, '#141414');
            for (let i = 0; i < uiBox.lines.length; ++i) {
                Draw.drawText(context, uiBox.x + 5, uiBox.y + 5 + i * LINE_HEIGHT, 
                    uiBox.lines[i], 'white');
            }
        }
    };

    const applyControlsToAccel = (character: Character): void => {
        character.accel.x = 0;
        character.accel.y = 0;

        if (character.horizontal !== Direction.Stationary) {
            if (character.horizontal === Direction.Positive) { // Left
                character.accel.x += character.aim.y;
                character.accel.y -= character.aim.x;
            } else if (character.horizontal === Direction.Negative) { // Right
                character.accel.x -= character.aim.y;
                character.accel.y += character.aim.x;
            }
        }

        if (character.vertical !== Direction.Stationary) {
            if (character.vertical === Direction.Positive) { // Forwards
                character.accel.x += character.aim.x;
                character.accel.y += character.aim.y;
            } else if (character.vertical === Direction.Negative) { // Backwards
                character.accel.x -= character.aim.x;
                character.accel.y -= character.aim.y;
            }
        }
        
        character.accel.magnitude(character.movementAccelMag);
    };

    const testBarrierCollision = (character: Character): boolean => {
        if (data.getBarrierType === undefined) return false;

        const topLeft = controller.grid.pixelToBlock(character.position.x, character.position.y);
        const bottomRight = controller.grid.pixelToBlock(character.discreteX2, character.discreteY2);

        for (let x = topLeft.x; x <= bottomRight.x; ++x) {
            for (let y = topLeft.y; y <= bottomRight.y; ++y) {

                const barrierType = data.getBarrierType(x, y);
                const crossLeft = x > topLeft.x;
                const crossTop = y > topLeft.y;

                if (barrierType === BarrierType.Left) {
                    if (crossLeft) return true;
                } else if (barrierType === BarrierType.Top) {
                    if (crossTop) return true;
                } else if (barrierType === BarrierType.LeftTop) {
                    if (crossLeft || crossTop) return true;
                }
            }
        }

        return false;
    }

    const testCollision = (character: Character, controller: Controller, data: GameSceneData): boolean => {
        if (controller.grid.isRectOutside(character)) return true;
        if (testBarrierCollision(character)) return true;

        return controller.grid.loopRectCollideWithRect(character, (collidedRect) => {
            if (collidedRect instanceof Thing) {
                if (collidedRect.solidType !== SolidType.NotSolid) {
                    if (data.onCharacterThingCollision) data.onCharacterThingCollision(controller, character, collidedRect);
                    return true;
                }
            }
            return false;
        });
    };

    const updateNetworkedCharacter = (
        character: NetworkedCharacter, diff: number, width: number, height: number
    ): void => {
        const interpolator = character.interpolator;
        if (interpolator.length === 0) return;

        // Speed up if behind, otherwise potentially permanently
        // playing in the past (because TCP). Appears as insanely high upload delay.
        const speedUpFactor = Math.max(0, interpolator.length - 2) * 0.1 + 1;
        const newT = character.networkT + diff * speedUpFactor;
        const interpolated = interpolator.interpolate(newT);
        character.networkT = interpolator.prune(newT);
        controller.grid.editRect(character, interpolated.position.x, interpolated.position.y);
        character.position = interpolated.position;
        character.aim = interpolated.aim;
        character.hp = interpolated.other.hp;

        // Turn characters out of screen off

        // Center of player
        const camera = data.camera();
        const playerCenterX = camera.x + data.cameraOffset.x; 
        const playerCenterY = camera.y + data.cameraOffset.y;

        // Position of screen corners in world space
        const x1 = playerCenterX - width / 2;
        const y1 = playerCenterY - height / 2;
        const x2 = x1 + width;
        const y2 = y1 + height;

        if (character.position.x + character.size.x < x1 || character.position.y + character.size.y < y1 || 
            character.position.x > x2 || character.position.y > y2) {
            character.off = true;
        }
    };

    const updateLocalCharacter = (character: Character, diff: number): void => {

        // Apply controls

        character.vertical = character.controls.vertical;
        if (character.disableBackpeddle) {
            if (character.vertical === -1) character.vertical = 0;
        }
        character.horizontal = character.controls.horizontal;
        character.firing = character.controls.mouse;
        character.desiredAim.x = character.controls.aim.x;
        character.desiredAim.y = character.controls.aim.y;

        // Rotate aim

        const controlsAngle = character.desiredAim.atan2();
        const aimAngle = character.aim.atan2();
        let ahead = controlsAngle - aimAngle;
        if (ahead < 0) ahead += 2 * Math.PI; // Make always positive

        const angleDiff = ahead > Math.PI ? ahead - 2 * Math.PI : ahead; // Pick shortest direction
        const rotatedAngle = (angleDiff > 0 ? 1 : -1) * character.rotateSpeed * diff;
        const trimmedAngle = Math.abs(rotatedAngle) >= Math.abs(angleDiff) ? angleDiff : rotatedAngle;
        character.aim.rotate(trimmedAngle);

        if (trimmedAngle === angleDiff) {
            character.rotateDirection = Direction.Stationary;
        } else {
            character.rotateDirection = ahead > Math.PI ? Direction.Negative : Direction.Positive; // Pick shortest direction
        }

        // Get acceleration

        let frictionMode = false;
        if (character.horizontal === 0 && character.vertical === 0) {
            // If stop moving, apply 'friction'
            character.accel.x = -character.velocity.x;
            character.accel.y = -character.velocity.y;
            character.accel.magnitude(data.frictionAccelMag);
            frictionMode = true;
        } else {
            applyControlsToAccel(character);
        }

        // Calc and apply new velocity

        if (frictionMode && data.frictionAccelMag * diff > character.velocity.getMagnitude()) { // If will start moving backwards, then just stop
            character.velocity.mult(0);
        } else {
            character.velocity.x += character.accel.x * diff;
            character.velocity.y += character.accel.y * diff;
            if (character.velocity.getMagnitude() > character.maxSpeed) {
                character.velocity.magnitude(character.maxSpeed);
            }
        }

        // Calc position diff, don't apply

        const diffSquared = Math.pow(diff, 2);
        const moveDiff = new Vec2d(
            character.velocity.x * diff + 0.5 * character.accel.x * diffSquared,
            character.velocity.y * diff + 0.5 * character.accel.y * diffSquared
        );
        const maxDist = character.maxSpeed * diff;
        const moveDiffMag = moveDiff.getMagnitude();
        if (moveDiffMag > maxDist) {
            moveDiff.magnitude(maxDist);
        }

        // Collision tests, then apply position

        if (character.wrapMap) { // Teleport to other side of map
            if (controller.grid.pixelWidth !== null) { // Not infinite
                if (character.x2 > controller.grid.pixelWidth) {
                    character.position.x = 0;
                } else if (character.position.x < 0) {
                    character.position.x = controller.grid.pixelWidth - character.size.x;
                }
            }
            if (controller.grid.pixelHeight !== null) { // Not infinite
                if (character.y2 > controller.grid.pixelHeight) {
                    character.position.y = 0;
                } else if (character.position.y < 0) {
                    character.position.y = controller.grid.pixelHeight - character.size.y;
                }
            }

            controller.grid.editRect(character, character.position.x + moveDiff.x, character.position.y + moveDiff.y);

        } else { // Bounce off side of map

            const oldX = character.position.x;
            const oldY = character.position.y;
            const newX = character.position.x + moveDiff.x;
            const newY = character.position.y + moveDiff.y;

            // Apply each dimension separately
            // If collided, then need to revert position

            controller.grid.editRect(character, newX, oldY);
            const collisionX = testCollision(character, controller, data);

            controller.grid.editRect(character, oldX, newY);
            const collisionY = testCollision(character, controller, data);

            if (collisionX && collisionY) controller.grid.editRect(character, oldX, oldY);
            else if (collisionY) controller.grid.editRect(character, newX, oldY);
            else if (collisionX) controller.grid.editRect(character, oldX, newY);
            else controller.grid.editRect(character, newX, newY);

            if (collisionX) {
                if (character.customBounceMultiplier !== null) {
                    character.velocity.x *= -character.customBounceMultiplier;
                } else {
                    character.velocity.x *= -data.bounceMultiplier;
                }
                if (character.autoVBounce) character.vertical *= -1;
            }

            if (collisionY) {
                if (character.customBounceMultiplier !== null) {
                    character.velocity.y *= -character.customBounceMultiplier;
                } else {
                    character.velocity.y *= -data.bounceMultiplier;
                }
                if (character.autoHBounce) character.horizontal *= -1;
            }
        }

        // Weapons

        character.timeTillShot -= diff;
        if (character.timeTillShot < 0) character.timeTillShot = 0;
        if (character.firing) {
            if (character.shotsBeforeReload >= character.getCurrentWeapon().shots) { 
                character.timeTillShot = character.getCurrentWeapon().reload;
                character.shotsBeforeReload = 0;
            } else if (character.timeTillShot === 0) { 
                const bullet = Bullet.shootFrom(character, character.getCurrentWeapon());
                controller.grid.registerDot(bullet);
                character.timeTillShot = character.getCurrentWeapon().rate; 
                character.shotsBeforeReload++;
            }
        }
    };

    // Returns true to request finish
    const update = (diff: number, width: number, height: number): boolean => {
        // External hook
        if (data.onUpdate) data.onUpdate(diff, controller);

        // Note: If A collides with B, only update one of A or B here
        controller.grid.forEachDot((dot) => {
            if (!(dot instanceof Bullet)) return;

            const bullet = dot as Bullet;
            bullet.lifetime -= diff;

            if (bullet.lifetime < 0 || controller.grid.isDotOutside(bullet)) {
                controller.grid.unregisterDot(bullet.id);
            } else {
                const newX = bullet.velocity.x * diff + bullet.position.x;
                const newY = bullet.velocity.y * diff + bullet.position.y;
                controller.grid.editDot(bullet, newX, newY);
                controller.grid.loopDotCollideWithRect(bullet, (rect: SpatialHash.Rect) => {
                    if (rect instanceof Character) {
                        const character = rect as Character;
                        if (!character.off && bullet.owner.id !== character.id) {
                            if (data.onCharacterBulletHit && data.onCharacterBulletHit(controller, character, bullet)) {
                                controller.grid.unregisterDot(bullet.id);
                                return true;
                            } 
                        }
                    } else if (rect instanceof NetworkedCharacter) {
                        const character = rect as NetworkedCharacter;
                        if (bullet.owner.id !== character.id) {
                            if (data.onNetCharacterBulletHit && data.onNetCharacterBulletHit(controller, character, bullet)) {
                                controller.grid.unregisterDot(bullet.id);
                                return true;
                            } 
                        }
                    } else if (rect instanceof Thing) {
                        const thing = rect as Thing;
                        if (thing.solidType === SolidType.BlockAll) {
                            controller.grid.unregisterDot(bullet.id);
                            return true;
                        } 
                    }
                    return false;
                });
            }
        });

        controller.grid.forEachRect((rect: SpatialHash.Rect) => {
            if (rect instanceof Character || rect instanceof NetworkedCharacter) {
                const character = rect as DrawableCharacter;

                const spriteSheet = character.spriteSheets[character.spriteSheetIndex];
                if (spriteSheet) spriteSheet.move(diff);

                if (character instanceof NetworkedCharacter) {
                    updateNetworkedCharacter(character, diff, width, height);
                } else if (character instanceof Character) {
                    if (!character.off) updateLocalCharacter(character, diff);
                } 
            }
        });

        if (controller.isFinished) {
            if (data.onFinish) data.onFinish(controller);
            return true; // End loop
        } else {
            return false; // Keep going
        }
    };

    return {begin, draw, update, controller};
};
