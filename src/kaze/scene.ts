export interface IScene {
    begin: (context: CanvasRenderingContext2D | null) => void;
    draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
    update: (diff: number, width: number, height: number) => boolean;
}

export class CanvasSizeSubstitute {
    constructor(public width: number, public height: number) {}
}

export type PlaySceneOptions = {
    fps: number;
    scene: IScene;
    canvas: HTMLCanvasElement | CanvasSizeSubstitute;
}

export const playScene = (options: PlaySceneOptions): IScene => {
    const scene = options.scene;
    const canvas = options.canvas;

    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
        const context = canvas.getContext('2d');
        if (context === null) throw 'failed to get canvas';
        const draw = () => {
            scene.draw(context, canvas.width, canvas.height);
            window.requestAnimationFrame(draw);
        };
        window.requestAnimationFrame(draw);
        scene.begin(context);
    } else if (canvas instanceof CanvasSizeSubstitute) {
        scene.begin(null);
    } else {
        throw 'invalid canvas type';
    }

    const delay = Math.floor(1000 / options.fps);
    let lastFrame: number | null = null;
    const id = setInterval(() => {
        const now = Date.now()
        const diff = lastFrame === null ? delay : now - lastFrame;
        lastFrame = now;
        const result = scene.update(diff, canvas.width, canvas.height);
        if (result) clearInterval(id);
    }, delay);

    return scene;
};
