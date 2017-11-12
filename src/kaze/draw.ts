export class AnimatedSpriteSheet {
    image: HTMLImageElement;
    animateX: number = 0;
    animateY: number = 0;
    spriteWidth: number;
    spriteHeight: number;
    autoTick: boolean = false;
    alive: boolean = true;
    tickInterval: number = 1000;
    tickRemaining: number = 0;
    private iterator: Iterator<void>;

    constructor(relativePath: string, public animateWidth: number, public animateHeight: number) {
        this.image = new Image();
        this.image.src = relativePath;
        this.image.onload = () => { // Assume equally spaced out
            this.spriteWidth = this.image.naturalWidth / animateWidth;
            this.spriteHeight = this.image.naturalHeight / animateHeight;
        };
        this.iterator = this.tickAll();
    }

    // Moves the remaining time by *diff*, ticks if it reaches 0
    move(diff: number): void {
        this.tickRemaining -= diff; 
        if (this.tickRemaining < 0) {
            this.tickRemaining = this.tickInterval;
            this.iterator.next();
        } 
    }

    // Loops through the animation sheet
    *tickAll(): Iterator<void> {
        while (true) {
            for (this.animateX = 0; this.animateX < this.animateWidth; ++this.animateX) {
                for (this.animateY = 0; this.animateY < this.animateHeight; ++this.animateY) {
                    while (!this.alive) yield;
                    yield;
                }
            }
            this.alive = this.autoTick;
        }
    }

    draw(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
        context.drawImage(
            this.image, 
            Math.floor(this.animateX * this.spriteWidth),
            Math.floor(this.animateY * this.spriteHeight),
            Math.floor(this.spriteWidth),
            Math.floor(this.spriteHeight),
            Math.floor(x),
            Math.floor(y),
            Math.floor(width), 
            Math.floor(height));
    }
}

export const drawCircle = (
    context: CanvasRenderingContext2D, x: number, y: number,
    radius: number, fillStyle: string
): void => {
    context.fillStyle = fillStyle;
    context.beginPath();
    context.arc(Math.floor(x), Math.floor(y), Math.floor(radius), Math.floor(2 * Math.PI), 0, false);
    context.fill();
};

export const drawRect = (
    context: CanvasRenderingContext2D, x: number, y: number,
    width: number, height: number, fillStyle: string
): void => {
    context.fillStyle = fillStyle;
    context.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height));
};

export const drawLine = (
    context: CanvasRenderingContext2D, 
    x1: number, y1: number, x2: number, y2: number, 
    strokeStyle: string, lineWidth: number
): void => {
    context.lineWidth = lineWidth;
    context.strokeStyle = strokeStyle;
    context.beginPath();
    x1 = Math.floor(x1);
    x2 = Math.floor(x2);
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
};

export const drawText = (
    context: CanvasRenderingContext2D, x: number, y: number,
    text: string, fillStyle: string, textAlign: string = 'left'
): void => {
    context.fillStyle = fillStyle;
    context.textAlign = textAlign;
    context.fillText(text, x, y);
};
