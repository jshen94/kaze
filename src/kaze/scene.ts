export interface Scene {
    begin: (context: CanvasRenderingContext2D | null) => void;
    draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
    update: (diff: number) => boolean;
}

export type PlaySceneOptions = {
    fps: number;
    scene: Scene;
    canvas?: HTMLCanvasElement;
}

export const playScene = (options: PlaySceneOptions): Scene => {
    const scene = options.scene;
    const canvas = options.canvas;

    if (canvas) {
        const context = canvas.getContext('2d');
        if (context === null) throw 'failed to get canvas';
        const draw = () => {
            scene.draw(context, canvas.width, canvas.height);
            window.requestAnimationFrame(draw);
        };
        window.requestAnimationFrame(draw);
        scene.begin(context);
    } else {
        scene.begin(null);
    }

    const delay = Math.floor(1000 / options.fps);
    let lastFrame: number | null = null;
    const id = setInterval(() => {
        const now = Date.now()
        const diff = lastFrame === null ? delay : now - lastFrame;
        lastFrame = now;
        const result = scene.update(diff);
        if (result) clearInterval(id);
    }, delay);

    return scene;
};
