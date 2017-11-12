import _ = require('lodash');
import Redux = require('redux');
import ReactRedux = require('react-redux');
import Reselect = require('reselect');

import GameScene = require('../kaze/game-scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import MapFile = require('../kaze/map-file');
import MapContent = MapFile.MapContent;
import Helpers = require('./helpers');

const Materialize = require('materialize-css/dist/js/materialize.min.js');

//////////////////////////////////////////////////

export enum SpriteActionKeys {
    LoadSprites = 'LOAD_SPRITES',
    PickSprite = 'PICK_SPRITE',
    DeleteSprite = 'DELETE_SPRITE',
    ClearSprites = 'CLEAR_SPRITES'
}

export interface LoadSpritesAction {
    type: SpriteActionKeys.LoadSprites;
    fileNameToUrl: Map<string, string>;
}
export interface PickSpriteAction {
    type: SpriteActionKeys.PickSprite;
    index: number;
}
export interface DeleteSpriteAction {
    type: SpriteActionKeys.DeleteSprite;
    fileName: string;
}
export interface ClearSpritesAction {
    type: SpriteActionKeys.ClearSprites;
}

export type SpriteAction = 
    LoadSpritesAction | PickSpriteAction | DeleteSpriteAction | ClearSpritesAction;

export const loadSprites = (fileNameToUrl: Map<string, string>)
    : LoadSpritesAction => ({type: SpriteActionKeys.LoadSprites, fileNameToUrl});
export const pickSprite = (index: number)
    : PickSpriteAction => ({type: SpriteActionKeys.PickSprite, index});
export const deleteSprite = (fileName: string)
    : DeleteSpriteAction => ({type: SpriteActionKeys.DeleteSprite, fileName});
export const clearSprites = () 
    : ClearSpritesAction => ({type: SpriteActionKeys.ClearSprites});

export class SpriteMode {
    fileNameToUrl = new Map<string, string>();
    index = -1;

    deleteClone = (fileName: string): SpriteMode => {
        const newSpriteMode = new SpriteMode;
        newSpriteMode.index = this.index;
        this.fileNameToUrl.forEach((value, key) => {
            if (key !== fileName) newSpriteMode.fileNameToUrl.set(key, value);
        });
        return newSpriteMode;
    }

    // Union of new URLs and old URLs
    unionClone = (fileNameToUrl: Map<string, string>): SpriteMode => {
        const newSpriteMode = new SpriteMode;
        newSpriteMode.index = this.index;

        // Map preserves insertion order, so add old first, then new
        this.fileNameToUrl.forEach((value, key) => {
            newSpriteMode.fileNameToUrl.set(key, value);
        });
        fileNameToUrl.forEach((value, key) => {
            newSpriteMode.fileNameToUrl.set(key, value);
        });

        return newSpriteMode;
    }
}

export const spriteMode = (state = new SpriteMode, action: SpriteAction): SpriteMode => {
    switch (action.type) {
        case SpriteActionKeys.LoadSprites:
            return state.unionClone((action as LoadSpritesAction).fileNameToUrl);
        case SpriteActionKeys.PickSprite:
            const s = new SpriteMode;
            s.index = (action as PickSpriteAction).index; // New
            s.fileNameToUrl = state.fileNameToUrl; // Old
            return s;
        case SpriteActionKeys.DeleteSprite:
            return state.deleteClone((action as DeleteSpriteAction).fileName);
        case SpriteActionKeys.ClearSprites:
            return new SpriteMode;
        default:
            return state;
    }
};

//////////////////////////////////////////////////

export enum MapActionKeys {
    NewMap = 'NEW_MAP',
    EditMap = 'EDIT_MAP',
    CloseMap = 'CLOSE_MAP'
}

export interface NewMapAction {
    type: MapActionKeys.NewMap;
    name: string;
    blockWidth: number;
    blockHeight: number;
}
export interface EditMapAction {
    type: MapActionKeys.EditMap;
    mapContent: MapContent;
}
export interface CloseMapAction {
    type: MapActionKeys.CloseMap;
}

export type MapAction = NewMapAction | EditMapAction | CloseMapAction;

export const newMap = (name: string, blockWidth: number, blockHeight: number)
    : NewMapAction => ({type: MapActionKeys.NewMap, name, blockWidth, blockHeight});
export const editMap = (mapContent: MapContent)
    : EditMapAction => ({type: MapActionKeys.EditMap, mapContent});
export const closeMap = ()
    : CloseMapAction => ({type: MapActionKeys.CloseMap});

export const mapContent = (state = new MapContent, action: MapAction): MapContent => {
    switch (action.type) {
        case MapActionKeys.CloseMap:
            return new MapContent;
        case MapActionKeys.NewMap:
            const mapContent = new MapContent;
            const newMapAction = action as NewMapAction;
            mapContent.initialize(newMapAction.name, newMapAction.blockWidth, newMapAction.blockHeight);
            return mapContent;
        case MapActionKeys.EditMap:
            const editMapAction = action as EditMapAction;
            return editMapAction.mapContent;
        default:
            return state;
    }
};

//////////////////////////////////////////////////

export type CombinedAction = MapAction | SpriteAction;

export type Combined = {
    spriteMode: SpriteMode;
    mapContent: MapContent;
}

export const combined = Redux.combineReducers<Combined>({spriteMode, mapContent});

const fileNameToUrlSelector = (state: Combined): Map<string, string> => state.spriteMode.fileNameToUrl;
const urlArraySelector = Reselect.createSelector(
    fileNameToUrlSelector,
    (fileNameToUrl: Map<string, string>): string[] => Array.from(fileNameToUrl.values())
);

export interface StateProps {
    spriteUrls: string[];
    fileNameToUrl: Map<string, string>;
    selectedSpriteIndex: number;
    isSaveable: boolean;
    mapContent: MapContent;
}

export const mapStateToProps = (state: Combined): StateProps => {
    return {
        spriteUrls: urlArraySelector(state),
        fileNameToUrl: state.spriteMode.fileNameToUrl,
        selectedSpriteIndex: state.spriteMode.index,
        isSaveable: state.mapContent.rows.length > 0,
        mapContent: state.mapContent
    };
};

export interface DispatchProps {
    onAddSprites: (f: FileList) => void;
    onSpriteSelect: (index: number) => void;
    onEditMap: (f: FileList) => void;
    onNewMap: (name: string, blockWidth: number, blockHeight: number) => void;
    onSaveMap: (mapContent: MapContent) => void; 
}

export const mapDispatchToProps = (dispatch: Redux.Dispatch<CombinedAction>): DispatchProps => {
    return {
        onAddSprites: (files: FileList): void => {
            const fileNameToUrl = new Map;
            for (let i = 0; i < files.length; ++i) {
                fileNameToUrl.set(files[i].name, URL.createObjectURL(files[i]));
            }
            dispatch(loadSprites(fileNameToUrl));
        },
        onSpriteSelect: (index: number): void => {
            dispatch(pickSprite(index));
        },
        onEditMap: (files: FileList): void => {
            const result = Helpers.readMapFile(files, (error: string) => {
                Materialize.toast(`Map load error: ${error}`, 4000);
                console.assert(false, error);
            }, (result: Helpers.ReadMapFile) => {
                dispatch(clearSprites());
                dispatch(loadSprites(result.fileNameToUrl));
                dispatch(editMap(result.mapContent));
            });
        },
        onNewMap: (name: string, blockWidth: number, blockHeight: number): void => {
            dispatch(newMap(name, blockWidth, blockHeight));
        },
        onSaveMap: (mapContent: MapContent): void => {
            // Sync the state from DOM
            dispatch(editMap(mapContent));
        }
    };
};

export const containerMaker = ReactRedux.connect<StateProps, DispatchProps>(mapStateToProps, mapDispatchToProps);
