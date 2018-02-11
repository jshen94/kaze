import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;

export enum Direction {
    Positive = 1, Negative = -1, Stationary = 0
}

export class Controls {
    mouse: boolean = false;
    vertical: Direction = Direction.Stationary;
    horizontal: Direction = Direction.Stationary;
    aim: Vec2d = new Vec2d(0, -1);
    weaponIndex: number;

    onKeyDown?: (e: KeyboardEvent) => void;
    onKeyUp?: (e: KeyboardEvent) => void;

    private left: boolean;
    private right: boolean;
    private down: boolean;
    private up: boolean;
    private registered: boolean = false;

    register(canvas: HTMLElement) {
        if (this.registered) return;
        this.registered = true;

        const keyDown = (e: KeyboardEvent): void => {
            if (e.keyCode === 87) {
                this.up = true;
                this.vertical = Direction.Positive;
            } else if (e.keyCode === 83) {
                this.down = true;
                this.vertical = Direction.Negative;
            } else if (e.keyCode === 65) {
                this.left = true;
                this.horizontal = Direction.Positive;
            } else if (e.keyCode === 68) {
                this.right = true;
                this.horizontal = Direction.Negative;
            } else if (e.keyCode >= 49 && e.keyCode <= 56) { // 1-8
                this.weaponIndex = e.keyCode - 49; // 0-7
            }

            if (this.onKeyDown) this.onKeyDown(e);
        };

        const keyUp = (e: KeyboardEvent): void => {
            if (e.keyCode === 87) {
                this.up = false;
                this.vertical = this.down ? Direction.Negative : Direction.Stationary;
            } else if (e.keyCode === 83) {
                this.down = false;
                this.vertical = this.up ? Direction.Positive : Direction.Stationary;
            } else if (e.keyCode === 65) {
                this.left = false;
                this.horizontal = this.right ? Direction.Negative : Direction.Stationary;
            } else if (e.keyCode === 68) {
                this.right = false;
                this.horizontal = this.left ? Direction.Positive : Direction.Stationary;
            }

            if (this.onKeyUp) this.onKeyUp(e);
        };

        const mouseMove = (e: MouseEvent): void => {
            const r = canvas.getBoundingClientRect();
            this.aim.x = e.clientX - r.left - r.width / 2;
            this.aim.y = e.clientY - r.top - r.height / 2;
            if (this.aim.x === 0 && this.aim.y === 0) {
                this.aim.x = 0;
                this.aim.y = -1;
            }
        };

        const mouseDown = (e: MouseEvent): void => {
            this.mouse = true;
        };

        const mouseUp = (e: MouseEvent): void => {
            this.mouse = false;
        };

        window.addEventListener('keydown', keyDown);
        window.addEventListener('keyup', keyUp);
        canvas.addEventListener('mousemove', mouseMove);
        canvas.addEventListener('mousedown', mouseDown);
        canvas.addEventListener('mouseup', mouseUp);
    }
}
