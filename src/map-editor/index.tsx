import React = require('react');
import ReactDOM = require('react-dom');
import Redux = require('redux');
import ReactRedux = require('react-redux');
import ReduxThunk_ = require('redux-thunk');
const ReduxThunk = ReduxThunk_.default;
import $ = require('jquery');

import GameScene = require('../kaze/game-scene');
import FloorTileGrid = require('../kaze/floor-tile-grid');
import Helpers = require('./helpers');
import ActionsReducers = require('./actions-reducers');
import MapFile = require('../kaze/map-file');

require('materialize-css/dist/css/materialize.min.css');
require('materialize-css/dist/js/materialize.min.js');
const floorPng: string = require('../../assets/images/floor.png');

const MaxBlockWidth = 100;
const MaxBlockHeight = 100;

interface MenuBarProps {
    id: string;
    isSaveable: boolean;
    onAddSprites: (f: FileList) => void;
    onEditMap: (f: FileList) => void;
    onNewMap: (name: string, blockWidth: number, blockHeight: number) => void;
    onSaveMap: () => void;
}

interface MenuBarState {
    newMapName: string;
    newMapBlockWidth: number;
    newMapBlockHeight: number;
}

class MenuBar extends React.Component<MenuBarProps, MenuBarState> {
    $editInput: JQuery | null;
    $spriteInput: JQuery | null;
    newModalId: string;

    constructor(props: MenuBarProps) {
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
        if (this.$spriteInput === null) throw 'unexpected null sprite input';
        this.$spriteInput.click();
    }

    onEditMapShow = (e: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.$editInput === null) throw 'unexpected null edit input';
        this.$editInput.click();
    }

    onAddSprites = (e: JQuery.Event): void => {
        if (this.$spriteInput === null) throw 'unexpected null sprite input';

        const asInput = this.$spriteInput[0] as HTMLInputElement;
        if (asInput.files === null) throw 'null input files';
        this.props.onAddSprites(asInput.files);
    }

    onNewMap = (e: React.MouseEvent<HTMLButtonElement>): void => {
        if (this.$editInput === null) throw 'unexpected null edit input';
        if (this.$spriteInput === null) throw 'unexpected null sprite input';

        const _spriteInput = this.$spriteInput[0] as HTMLInputElement;
        const _editInput = this.$editInput[0] as HTMLInputElement;

        _spriteInput.value = ''; // Old opened sprites or maps should be able to be opened again
        _editInput.value = '';

        this.props.onNewMap(this.state.newMapName, this.state.newMapBlockWidth, this.state.newMapBlockHeight);
    }

    onEditMap = (e: JQuery.Event): void => {
        if (this.$editInput === null) throw 'unexpected null edit input';

        // All files including map data and images
        const asEdit = this.$editInput[0] as HTMLInputElement;
        if (asEdit.files === null) throw 'null edit files';
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
};

interface SpriteBarProps {
    spriteUrls: string[];
    onSpriteSelect: any;
}

interface SpriteBarState {
    selectedIndex: number;
}

class SpriteBar extends React.Component<SpriteBarProps, SpriteBarState> {
    constructor(props: SpriteBarProps) {
        super(props);
        this.state = {
            // Note: _selectedIndex includes the default sprite, which is not included in spriteUrls
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
        const imgs = includingDefault.map((src, i) => {
            return <img 
                style={{
                    borderStyle: i === this.state.selectedIndex ? 'solid' : 'none',
                    borderWidth: '2px',
                    borderColor: 'red'
                }}
                width='50px' height='50px'
                onClick={this.onImageClick}
                key={i} data-index={i}
                src={src} />;
        });
        return <div style={{background: 'rgb(107,129,120)'}}>{imgs}</div>;
    }
};

interface GridProps {
    mapContent: MapFile.MapContent;
    selectedSpriteIndex: number;
    spriteUrls: string[];
    onSetTile: (x: number, y: number, selectedSpriteIndex: number) => void;
    onSetBarrier: (x: number, y: number, barrierType: FloorTileGrid.BarrierType) => void;
}

const BarrierBorderStyle = '2px dotted white';
class Grid extends React.Component<GridProps, {}> {
    mouseX: number | null = null;
    mouseY: number | null = null;

    constructor(props: GridProps) {
        super(props);
        if (props.mapContent.rows.length !== props.mapContent.blockHeight) 
            throw 'invalid map content rows height';
        if (props.mapContent.rows.length !== 0 && props.mapContent.rows[0].length !== this.props.mapContent.blockWidth)
            throw 'invalid map content rows width';
    }

    shouldComponentUpdate(nextProps: GridProps): boolean {
        const a = nextProps.mapContent;
        const b = this.props.mapContent;
        return a.rows !== b.rows || a.barrierRows != b.barrierRows;
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

        const element = element_ as HTMLElement
        const e = e_ as KeyboardEvent;

        if (element.className === 'tile' && element.nodeName === 'IMG') {
            let barrierType: FloorTileGrid.BarrierType | null = null;

            if (e.key === 'w') {
                barrierType = FloorTileGrid.BarrierType.Top;
            } else if (e.key === 'a') {
                barrierType = FloorTileGrid.BarrierType.Left;
            } else if (e.key === 's') {
                barrierType = FloorTileGrid.BarrierType.LeftTop;
            } else if (e.key === 'd') {
                barrierType = FloorTileGrid.BarrierType.None;
            }

            if (barrierType !== null) {
                const bx = parseInt(element.dataset.x || 'ur an idiot');
                const by = parseInt(element.dataset.y || 'ur an idiot');
                if (isNaN(bx) || isNaN(by)) throw 'broken map tile dom indices';
                this.props.onSetBarrier(bx, by, barrierType);
                const newStyle = this.getImgBorderStyle(barrierType);
                Object.assign(element.style, newStyle);
                console.log(`debug - ${bx}, ${by}, ${barrierType}`);
            }
        }
    }

    getSrc(x: number, y: number): string {
        const index = this.props.mapContent.rows[y][x];
        const src = index >= 0 ? this.props.spriteUrls[index] : floorPng;
        return src;
    }

    getSelectedSrc(): string {
        const index = this.props.selectedSpriteIndex; 
        const src = index >= 0 ? this.props.spriteUrls[index] : floorPng;
        return src;
    }

    onTileClick = (e: React.MouseEvent<HTMLImageElement>): void => {
        const x = parseInt(e.currentTarget.dataset.x || 'FAIL');
        const y = parseInt(e.currentTarget.dataset.y || 'FAIL');

        if (isNaN(x)) throw 'invalid tile x';
        if (isNaN(y)) throw 'invalid tile y';

        this.props.onSetTile(x, y, this.props.selectedSpriteIndex);
        e.currentTarget.src = this.getSelectedSrc();
        console.log(`debug - ${x}, ${y}, ${this.props.selectedSpriteIndex}`);
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

    render(): JSX.Element {
        const rows = new Array<JSX.Element>(this.props.mapContent.blockHeight);
        for (let i = 0; i < this.props.mapContent.blockHeight; ++i) {
            const columns = new Array<JSX.Element>(this.props.mapContent.blockWidth);
            for (let j = 0; j < this.props.mapContent.blockWidth; ++j) {
                const src = this.getSrc(j, i);
                columns[j] = <img
                    className='tile'
                    style={this.getImgBorderStyle(this.props.mapContent.barrierRows[i][j])}
                    key={j} data-y={i} data-x={j}
                    width='50px' height='50px'
                    src={src ? src : floorPng}
                    onClick={this.onTileClick} />;
            }
            rows[i] = <div key={i}>{columns}</div>;
        }
        return <div style={{whiteSpace: 'nowrap'}}>{rows}</div>;
    }
}

interface AppProps extends ActionsReducers.StateProps, ActionsReducers.DispatchProps {}

class App extends React.Component<AppProps, {}> {
    mutableRows: number[][] = [];
    mutableBarrierRows: FloorTileGrid.BarrierType[][] = [];

    constructor(props: AppProps) {
        super(props);
    }

    componentWillReceiveProps(nextProps: AppProps): void {
        // Can compare reference because Redux is pure
        if (nextProps.mapContent.rows !== this.props.mapContent.rows) {
            console.log('debug - assigning mutable rows');
            this.mutableRows = Helpers.clone2dArray(nextProps.mapContent.rows);
        }
        if (nextProps.mapContent.barrierRows !== this.props.mapContent.barrierRows) {
            console.log('debug - assigning mutable barrier rows');
            this.mutableBarrierRows = Helpers.clone2dArray(nextProps.mapContent.barrierRows);
        }
    }

    onSetTile = (x: number, y: number, selectedSpriteIndex: number): void => {
        this.mutableRows[y][x] = selectedSpriteIndex;
    }

    onSetBarrier = (x: number, y: number, barrierType: FloorTileGrid.BarrierType): void => {
        this.mutableBarrierRows[y][x] = barrierType;
    }

    onSaveMap = (): void => {
        const mapContent = new MapFile.MapContent;
        mapContent.name = this.props.mapContent.name;
        mapContent.blockWidth = this.props.mapContent.blockWidth;
        mapContent.blockHeight = this.props.mapContent.blockHeight;
        mapContent.rows = this.mutableRows;
        mapContent.barrierRows = this.mutableBarrierRows;

        const json = Helpers.mapStringify(mapContent, this.props.fileNameToUrl);
        Helpers.download(json, Helpers.makeFileName(mapContent.name));
        this.props.onSaveMap(mapContent);
    }

    render(): JSX.Element {
        return (
        <div>
            <MenuBar 
                id='my-menu-bar' 
                isSaveable={this.props.isSaveable} 
                onAddSprites={this.props.onAddSprites} 
                onEditMap={this.props.onEditMap}
                onSaveMap={this.onSaveMap}
                onNewMap={this.props.onNewMap} />
            <SpriteBar 
                spriteUrls={this.props.spriteUrls} 
                onSpriteSelect={this.props.onSpriteSelect} />
            <div style={{background: '#e5e8e8', paddingLeft: '5px'}}>
                Barrier commands: a - Left, w - Top, s - Both, d - Delete
            </div>
            <Grid 
                mapContent={this.props.mapContent}
                spriteUrls={this.props.spriteUrls}
                selectedSpriteIndex={this.props.selectedSpriteIndex}
                onSetTile={this.onSetTile} 
                onSetBarrier={this.onSetBarrier} />
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
