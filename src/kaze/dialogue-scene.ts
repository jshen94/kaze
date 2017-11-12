import Draw = require('./draw');
import Scene = require('./scene');

export class DialogueSceneData {
    lines: string[] = [];
    percentageSpeed = 0.0001;
    lifetime = 8000;
    fontSize = 14;
    fontColor = '#eeffff';
    onFinish: (() => void) | null = null;
    constructor() {}
}

export const createDialogueScene = (data: DialogueSceneData): Scene.Scene => {
    let y = 1;
    let lifetime = data.lifetime;

    const update = function (diff: number): boolean {
        y -= diff * data.percentageSpeed;
        lifetime -= diff;
        if (lifetime <= 0) {
            if (data.onFinish) data.onFinish();
            return true;
        } else {
            return false;
        }
    };

    const draw = function (context: CanvasRenderingContext2D, width: number, height: number): void {
        context.globalAlpha = 1;
        Draw.drawRect(context, 0, 0, width, height, 'black');
        for (let i = 0; i < data.lines.length; ++i) {
            Draw.drawText(context, 10, y * height + i * 25, data.lines[i], data.fontColor);
        }
    };

    return {begin: (a) => undefined, draw, update};
};
