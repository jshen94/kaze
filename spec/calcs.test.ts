import Calcs = require('../src/kaze/calcs');
import Controls = require('../src/kaze/controls');
import GsNetwork = require('../src/kaze/game-scene-network');
import GameScene = require('../src/kaze/game-scene');
import Vec2d = Calcs.Vec2d;

describe('calcs', () => {
    it('line seg intersection', () => {
        expect(Calcs.lineSegIntersects(
            new Vec2d(-1, 5),
            new Vec2d(0, 0),
            new Vec2d(-0.5, 10),
            new Vec2d(-0.5, -10))).toEqual(true);

        expect(Calcs.lineSegIntersects(
            new Vec2d(-1, 5),
            new Vec2d(0, 0),
            new Vec2d(-0.5, 10),
            new Vec2d(-0.5, 2.35))).toEqual(true); 

        expect(Calcs.lineSegIntersects(
            new Vec2d(-1, 5),
            new Vec2d(0, 0),
            new Vec2d(-0.5, 10),
            new Vec2d(-0.5, 2.6))).toEqual(false);
    });
});

describe('game-scene-network', () => {
    it('pack unpack controls', () => {
        for (let i = 0; i < 10; ++i) {
            const controls = new Controls.Controls;
            controls.vertical = (Math.floor(Math.random() * 3) - 1) as Controls.Direction;
            controls.horizontal = (Math.floor(Math.random() * 3) - 1) as Controls.Direction;
            controls.mouse = Math.random() > 0.5;
            controls.aim = new Vec2d(Math.random() * 100, Math.random() * 100);
            controls.weaponIndex = Math.round(Math.random() * 7);

            const packed = GsNetwork.packControls(controls.mouse, controls.aim, controls.vertical, controls.horizontal, controls.weaponIndex);
            const character = new GameScene.Character(50, 50);
            for (let j = 0; j < GsNetwork.MAX_WEAPON_COUNT; ++j) character.weapons.push(new GameScene.Weapon()); // So weapon is not out of index
            GsNetwork.unpackControls(packed, character);

            const properties: (keyof Controls.Controls)[] = ['vertical', 'horizontal', 'mouse'];
            properties.forEach((property) => expect(character.controls[property]).toEqual(controls[property]));
            expect(Math.abs(
                Math.abs(character.controls.aim.atan2()) - Math.abs(controls.aim.atan2())
            )).toBeLessThan(GsNetwork.AIM_SLICE); // Loss of precision
            expect(character.getCurrentWeaponIndex()).toEqual(controls.weaponIndex);
        }
    });
});
