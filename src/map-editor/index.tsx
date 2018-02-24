import React = require('react');
import ReactDOM = require('react-dom');
import Redux = require('redux');
import ReactRedux = require('react-redux');
import ReduxThunk_ = require('redux-thunk');
import $ = require('jquery');
import _ = require('lodash');

const ReduxThunk = ReduxThunk_.default;

import Calcs = require('../kaze/calcs');
import GameScene = require('../kaze/game-scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import Helpers = require('./helpers');
import ActionsReducers = require('./actions-reducers');
import MapFile = require('../kaze/map-file');

import Vec2d = Calcs.Vec2d;
import MarkerMap = MapFile.MarkerMap;

require('materialize-css/dist/css/materialize.min.css');
require('materialize-css/dist/js/materialize.min.js');

const floorPng: string = require('../../assets/floor.png');

const MaxBlockWidth = 100;
const MaxBlockHeight = 100;

interface IMenuBarProps {
    id: string;
    isSaveable: boolean;
    onAddSprites: (f: FileList) => void;
    onEditMap: (f: FileList) => void;
    onNewMap: (name: string, blockWidth: number, blockHeight: number) => void;
    onSaveMap: () => void;
}

interface IMenuBarState {
    newMapName: string;
    newMapBlockWidth: number;
    newMapBlockHeight: number;
}

class MenuBar extends React.Component<IMenuBarProps, IMenuBarState> {
    $editInput: JQuery | null;
    $spriteInput: JQuery | null;
    newModalId: string;

    constructor(props: IMenuBarProps) {
        super(props);
        this.newModalId = props.id + '-modal';
        this.state = {
            newMapName: 'Trump\'s America',
            newMapBlockWidth: 20,
            newMapBlockHeight: 20
        };
    }

    onNewMapNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({newMapName: e.target.value});
    }

    onNewMapBlockHeightChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const a = parseInt(e.target.value);
        if (isNaN(a) || a <= 0 || a > MaxBlockHeight) {
            e.preventDefault();
        } else {
            this.setState({newMapBlockHeight: a});
        }
    }

    onNewMapBlockWidthChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const a = parseInt(e.target.value);
        if (isNaN(a) || a <= 0 || a > MaxBlockWidth) {
            e.preventDefault();
        } else {
            this.setState({newMapBlockWidth: a});
        }
    }

    onAddSpritesShow = (e: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.$spriteInput === null) throw new Error('unexpected null sprite input');
        this.$spriteInput.click();
    }

    onEditMapShow = (e: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.$editInput === null) throw new Error('unexpected null edit input');
        this.$editInput.click();
    }

    onAddSprites = (e: JQuery.Event): void => {
        if (this.$spriteInput === null) throw new Error('unexpected null sprite input');

        const asInput = this.$spriteInput[0] as HTMLInputElement;
        if (asInput.files === null) throw new Error('null input files');
        this.props.onAddSprites(asInput.files);
    }

    onNewMap = (e: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.$editInput === null) throw new Error('unexpected null edit input');
        if (this.$spriteInput === null) throw new Error('unexpected null sprite input');

        const _spriteInput = this.$spriteInput[0] as HTMLInputElement;
        const _editInput = this.$editInput[0] as HTMLInputElement;

        _spriteInput.value = ''; // Old opened sprites or maps should be able to be opened again
        _editInput.value = '';

        this.props.onNewMap(this.state.newMapName, this.state.newMapBlockWidth, this.state.newMapBlockHeight);
    }

    onEditMap = (e: JQuery.Event): void => {
        if (this.$editInput === null) throw new Error('unexpected null edit input');

        // All files including map data and images
        const asEdit = this.$editInput[0] as HTMLInputElement;
        if (asEdit.files === null) throw new Error('null edit files');
        this.props.onEditMap(asEdit.files);
    }

    onSaveMap = (e: React.MouseEvent<HTMLButtonElement>): void => {
        this.props.onSaveMap();
    }

    componentDidMount(): void {
        if (this.$editInput === null || this.$spriteInput === null) {
            console.log('warning: componentDidMount null refs');
            return;
        }

        $('#' + this.newModalId).modal(); // Set up modals
        this.$spriteInput.change(this.onAddSprites);
        this.$editInput.change(this.onEditMap);
    }

    render(): JSX.Element {
        return (
            <div style={{background: '#a9bbb2'}}>  
                <button data-target={this.newModalId} className='btn modal-trigger'>New</button>
                <button className='btn' onClick={this.onEditMapShow}>Edit</button>
                <button style={{display: this.props.isSaveable ? 'inline-block' : 'none'}} className='btn' onClick={this.onSaveMap}>Save</button>
                <button className='btn' onClick={this.onAddSpritesShow}>Sprite</button>

                <input 
                    style={{display: 'none'}} type='file' 
                    accept='.jpg, .jpeg, .png, .json' multiple={true} 
                    ref={(input) => this.$editInput = input === null ? null : $(input)} />
                <input 
                    style={{display: 'none'}} type='file' 
                    accept='.jpg, .jpeg, .png' multiple={true} 
                    ref={(input) => this.$spriteInput = input === null ? null : $(input)} />

                <div id={this.newModalId} className='modal'>
                    <div className='modal-content'>
                        <h4>New Map</h4>
                        <label>Name</label>
                        <input onChange={this.onNewMapNameChange} value={this.state.newMapName} />
                        <label>Block width</label>
                        <input onChange={this.onNewMapBlockWidthChange} value={this.state.newMapBlockWidth} />
                        <label>Block height</label>
                        <input onChange={this.onNewMapBlockHeightChange} value={this.state.newMapBlockHeight} />
                    </div>
                    <div className='modal-footer'>
                        <button className='btn modal-close' onClick={this.onNewMap}>Create</button>
                        <button className='btn modal-close'>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }
}

interface ISpriteBarProps {
    spriteUrls: string[];
    onSpriteSelect: any;
}

interface ISpriteBarState {
    selectedIndex: number;
}

class SpriteBar extends React.Component<ISpriteBarProps, ISpriteBarState> {
    constructor(props: ISpriteBarProps) {
        super(props);
        this.state = {
            // Note: selectedIndex includes the default sprite, which is not included in spriteUrls
            selectedIndex: 0
        };
    }

    onImageClick = (e: React.MouseEvent<HTMLImageElement>): void => {
        const index = parseInt($(e.target).data('index'));
        console.assert(!isNaN(index));
        this.setState({selectedIndex: index});
        this.props.onSpriteSelect(index - 1); // Default sprite @ 0 becomes -1
    }

    render(): JSX.Element { 
        const includingDefault = [floorPng].concat(this.props.spriteUrls);
        const imgs = includingDefault.map((src, i) => (
            <img 
                style={{
                    borderStyle: i === this.state.selectedIndex ? 'solid' : 'none',
                    borderWidth: '2px',
                    borderColor: 'red'
                }}
                width='50px' height='50px'
                onClick={this.onImageClick}
                key={i} data-index={i}
                src={src} />
        ));
        return <div style={{background: 'rgb(107,129,120)'}}>{imgs}</div>;
    }
}

interface IGridProps {
    mapContent: MapFile.MapContent;

    selectedSpriteIndex: number;
    spriteUrls: string[];

    onSetTileMutable: (x: number, y: number, selectedSpriteIndex: number) => void;
    onSetBarrierMutable: (x: number, y: number, barrierType: FloorTileGrid.BarrierType) => void;
    onUpdateMarkerMutable: (strKey: string) => string | null | false;
}

const BarrierBorderStyle = '2px dotted white';
class Grid extends React.Component<IGridProps, {}> {
    mouseX: number | null = null;
    mouseY: number | null = null;

    constructor(props: IGridProps) {
        super(props);
        if (props.mapContent.rows.length !== props.mapContent.blockHeight) {
            throw new Error('invalid map content rows height');
        }
        if (props.mapContent.rows.length !== 0 && props.mapContent.rows[0].length !== this.props.mapContent.blockWidth) {
            throw new Error('invalid map content rows width');
        }
    }

    shouldComponentUpdate(nextProps: IGridProps): boolean {
        const a = nextProps.mapContent;
        const b = this.props.mapContent;
        return a.rows !== b.rows || a.barrierRows !== b.barrierRows;
    }

    componentDidMount(): void {
        window.addEventListener('keyup', this.onGlobalKeyUp);
        window.addEventListener('mousemove', this.onGlobalMouseMove);
    }

    onGlobalMouseMove = (e_: Event): void => {
        const e = e_ as MouseEvent;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
    }

    onGlobalKeyUp = (e_: Event): void => {
        if (this.mouseX === null || this.mouseY === null) return;

        const element_ = document.elementFromPoint(this.mouseX, this.mouseY);
        if (!(element_ instanceof HTMLElement)) return; // ie. SVGElement

        const element = element_ as HTMLElement;
        const e = e_ as KeyboardEvent;

        if (element.className !== 'tile' || element.nodeName !== 'IMG') return;

        //////////////////////////////////////////////////
        // Mouse is over some <img> tile

        const bx = parseInt(element.dataset.x || '');
        const by = parseInt(element.dataset.y || '');
        if (isNaN(bx) || isNaN(by)) throw new Error('map tile dom indices not found');

        if (e.key === 'q') { // Toggle marker
            const strKey = bx + ',' + by;

            const $divSiblings = $(element).siblings('div');
            if ($divSiblings.length === 0) throw new Error('could not find <img> text div');

            const newKey = this.props.onUpdateMarkerMutable(strKey);
            if (newKey === false) { // Delete
                $divSiblings.text('');
            } else if (newKey !== null) { // New string
                console.assert(_.isString(newKey));
                $divSiblings.text(newKey);
            } 
        } else { // Setting barrier
            let barrierType: FloorTileGrid.BarrierType | null = null;

            if (e.key === 'w') barrierType = FloorTileGrid.BarrierType.Top;
            else if (e.key === 'a') barrierType = FloorTileGrid.BarrierType.Left;
            else if (e.key === 's') barrierType = FloorTileGrid.BarrierType.LeftTop;
            else if (e.key === 'd') barrierType = FloorTileGrid.BarrierType.None;

            if (barrierType !== null) {
                this.props.onSetBarrierMutable(bx, by, barrierType);

                const newStyle = this.getImgBorderStyle(barrierType);
                Object.assign(element.style, newStyle);
                console.log(`debug - ${bx}, ${by}, ${barrierType}`);
            }
        }
    }

    onTileClick = (e: React.MouseEvent<HTMLImageElement>): void => {
        const x = parseInt(e.currentTarget.dataset.x || '');
        const y = parseInt(e.currentTarget.dataset.y || '');

        if (isNaN(x)) throw new Error('invalid tile x');
        if (isNaN(y)) throw new Error('invalid tile y');

        this.props.onSetTileMutable(x, y, this.props.selectedSpriteIndex);
        e.currentTarget.src = this.getSelectedSrc();
        console.log(`debug - ${x}, ${y}, ${this.props.selectedSpriteIndex}`);
    }

    //////////////////////////////////////////////////

    // Sanity check - the following do not access `mutableX` fields, only the
    // original `props.mapContent`, but that is OK because they are supposed to only be used
    // in render(), which is not synced with the `mutableX` fields

    getSrc(x: number, y: number): string {
        const index = this.props.mapContent.rows[y][x];
        const src = index >= 0 ? this.props.spriteUrls[index] : floorPng;
        return src;
    }

    getMarker(x: number, y: number): string {
        const name = this.props.mapContent.markers[x + ',' + y];
        return name;
    }

    getSelectedSrc(): string {
        const index = this.props.selectedSpriteIndex; 
        const src = index >= 0 ? this.props.spriteUrls[index] : floorPng;
        return src;
    }

    render(): JSX.Element {

        // Map `mapContent` to <div> grid of <img> tiles
        const rows = new Array<JSX.Element>(this.props.mapContent.blockHeight);
        for (let i = 0; i < this.props.mapContent.blockHeight; ++i) {
            const columns = new Array<JSX.Element>(this.props.mapContent.blockWidth);

            for (let j = 0; j < this.props.mapContent.blockWidth; ++j) {
                const src = this.getSrc(j, i);
                const marker = this.getMarker(j, i);

                const imgDivChildren = ([
                    <img className='tile'
                         style={this.getImgBorderStyle(this.props.mapContent.barrierRows[i][j])}
                         key={0}
                         data-y={i} 
                         data-x={j}
                         width='50px' height='50px'
                         src={src ? src : floorPng}
                         onClick={this.onTileClick} />
                ]).concat(
                    <div style={{position: 'absolute', marginTop: '-25px'}} key={1}>
                        {marker === undefined ? '' : marker}
                    </div>
                );

                const imgDiv = <div style={{display: 'inline-block'}} key={j}>{imgDivChildren}</div>;
                columns[j] = imgDiv;
            }

            rows[i] = <div key={i}>{columns}</div>;
        }

        return <div style={{whiteSpace: 'nowrap'}}>{rows}</div>;
    }
    
    private getImgBorderStyle(barrierType: FloorTileGrid.BarrierType): object {
        const style = {borderLeft: '', borderTop: ''};
        if (barrierType === FloorTileGrid.BarrierType.Left) {
            style.borderLeft = BarrierBorderStyle;
        } else if (barrierType === FloorTileGrid.BarrierType.Top) {
            style.borderTop = BarrierBorderStyle;
        } else if (barrierType === FloorTileGrid.BarrierType.LeftTop) {
            style.borderLeft = BarrierBorderStyle;
            style.borderTop = BarrierBorderStyle;
        } 
        return style;
    }

}

interface IAppProps extends ActionsReducers.StateProps, ActionsReducers.DispatchProps {}

class App extends React.Component<IAppProps, {}> {

    // For performance,
    // child elements will directly change the DOM and the `mutableX` fields below,
    // it is synced with the store on save, edit, new, etc.
    // If the store sends props down, as a reaction to save, or if a new map is loaded,
    // then replace the mutable state if it's different

    mutableRows: number[][] = [];
    mutableBarrierRows: FloorTileGrid.BarrierType[][] = [];
    mutableMarkers: MarkerMap = {};

    constructor(props: IAppProps) {
        super(props);
    }

    componentWillReceiveProps(nextProps: IAppProps): void {
        // Can compare reference because Redux is pure
        if (nextProps.mapContent.rows !== this.props.mapContent.rows) {
            console.log('debug - assigning mutable rows');
            this.mutableRows = Helpers.clone2dArray(nextProps.mapContent.rows);
        }
        if (nextProps.mapContent.barrierRows !== this.props.mapContent.barrierRows) {
            console.log('debug - assigning mutable barrier rows');
            this.mutableBarrierRows = Helpers.clone2dArray(nextProps.mapContent.barrierRows);
        }
        if (nextProps.mapContent.markers !== this.props.mapContent.markers) {
            console.log('debug - assigning mutable markers');
            this.mutableMarkers = Object.assign({}, nextProps.mapContent.markers);
        }
    }

    //////////////////////////////////////////////////

    onSetTileMutable = (x: number, y: number, selectedSpriteIndex: number): void => {
        this.mutableRows[y][x] = selectedSpriteIndex;
    }

    onSetBarrierMutable = (x: number, y: number, barrierType: FloorTileGrid.BarrierType): void => {
        this.mutableBarrierRows[y][x] = barrierType;
    }

    onUpdateMarkerMutable = (strKey: string): string | null | false => {
        const marker = this.mutableMarkers[strKey];

        if (marker === undefined) { // New marker
            const name = prompt('Enter marker name:');
            if (name) {
                this.mutableMarkers[strKey] = name;
                return name;
            } else { // Do nothing
                return null;
            }
        } else { // Remove old marker
            delete this.mutableMarkers[strKey];
            return false;
        }
    }

    onDeleteMarker = (strKey: string): void => {
        delete this.mutableMarkers[strKey];
    }

    //////////////////////////////////////////////////

    onSyncMap = (): MapFile.MapContent => {
        const mapContent = new MapFile.MapContent;
        mapContent.name = this.props.mapContent.name;
        mapContent.blockWidth = this.props.mapContent.blockWidth;
        mapContent.blockHeight = this.props.mapContent.blockHeight;
        mapContent.rows = this.mutableRows;
        mapContent.barrierRows = this.mutableBarrierRows;
        mapContent.markers = this.mutableMarkers;

        // Sync with store on save, it is not synced immediately when changing tiles
        this.props.onSyncMap(mapContent);

        return mapContent;
    }

    onEditMap = (f: FileList): void => {
        this.onSyncMap(); // Commit dirty changes to store
        requestAnimationFrame(() => this.props.onEditMap(f)); // Let Redux call React to process the dirty change commit
    }

    onNewMap = (name: string, blockWidth: number, blockHeight: number): void => {
        this.onSyncMap(); // Commit dirty changes to store
        requestAnimationFrame(() => this.props.onNewMap(name, blockWidth, blockHeight)); // Let Redux call React to process the dirty change commit
    }

    onSaveMap = (): void => {
        const mapContent = this.onSyncMap();
        const json = Helpers.mapStringify(mapContent, this.props.fileNameToUrl);
        Helpers.download(json, Helpers.makeFileName(mapContent.name));
    }

    render(): JSX.Element {
        return (
            <div>
                <MenuBar 
                    id='my-menu-bar' 
                    isSaveable={this.props.isSaveable} 
                    onAddSprites={this.props.onAddSprites} 
                    onEditMap={this.onEditMap}
                    onSaveMap={this.onSaveMap}
                    onNewMap={this.onNewMap} />

                <SpriteBar 
                    spriteUrls={this.props.spriteUrls} 
                    onSpriteSelect={this.props.onSpriteSelect} />

                <div style={{background: '#e5e8e8', paddingLeft: '5px'}}>
                    Barrier commands: a - Left, w - Top, s - Both, d - Delete, q - Marker
                </div>

                <Grid 
                    mapContent={this.props.mapContent}
                    spriteUrls={this.props.spriteUrls}
                    selectedSpriteIndex={this.props.selectedSpriteIndex}

                    onSetTileMutable={this.onSetTileMutable} 
                    onSetBarrierMutable={this.onSetBarrierMutable}
                    onUpdateMarkerMutable={this.onUpdateMarkerMutable} />
            </div>
        );
    }
}

const store = Redux.createStore(ActionsReducers.combined, Redux.applyMiddleware(ReduxThunk));
const AppContainer = ActionsReducers.containerMaker(App);

const $root = $('<div />').attr('id', 'root');
$(document.body).append($root);
$(document.body).css('background', 'black');

ReactDOM.render(
    <ReactRedux.Provider store={store}>
        <AppContainer />
    </ReactRedux.Provider>,
    $root[0]
);

store.dispatch(ActionsReducers.closeMap());
