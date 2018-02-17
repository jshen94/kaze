import Calcs = require('../src/kaze/calcs');
import Vec2d = Calcs.Vec2d;

describe("calcs", () => {
    it("line seg intersection", () => {
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
