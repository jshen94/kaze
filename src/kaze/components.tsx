import React = require('react');
import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;

require('materialize-css/dist/css/materialize.min.css');
require('materialize-css/dist/js/materialize.min.js');

export interface ICanvasProps {
    id: string;
    width: string;
    height: string;
    isVisible: boolean;
}

export const Canvas = (props: ICanvasProps) => (
    <canvas 
        id={props.id}
        style={{
            visibility: props.isVisible ? 'visible' : 'collapse',
            background: 'black',
            transform: 'scale(1.5)',
            display: 'block',
            margin: '25px auto',
            transformOrigin: '50% 0%'
        }} 
        width={props.width}
        height={props.height} />
);

//////////////////////////////////////////////////

export class WindowContainer extends React.Component<{}, {}> {
    private draggedElement: HTMLElement | null = null;
    private elementStartDragPos: Vec2d = new Vec2d(0, 0);

    constructor(props: {}) {
        super(props);
    }

    onMouseUp = (e: React.MouseEvent<Element>): void => {
        this.draggedElement = null;
    }

    onMouseDown = (e: React.MouseEvent<Element>): void => {
        if (e.button !== 0) return; // Left button
        if (e.target instanceof HTMLDivElement) {
            const targetElement = e.target as HTMLDivElement;
            if (targetElement.className.indexOf('kaze-drag-trigger') > -1) { // eg. Title bar
                const bounding = targetElement.getBoundingClientRect();

                let dragTargetCandidate: HTMLElement | null = targetElement;
                while (true) {
                    dragTargetCandidate = dragTargetCandidate.parentElement;
                    if (dragTargetCandidate === null) return; // Nothing to drag
                    if (dragTargetCandidate.className.indexOf('kaze-drag-target') > -1) break; // eg. Window
                }
                this.draggedElement = dragTargetCandidate;
                this.elementStartDragPos.x = e.clientX - bounding.left;
                this.elementStartDragPos.y = e.clientY - bounding.top;
            }
        }
    }

    onMouseMove = (e: React.MouseEvent<Element>): void => {
        if (this.draggedElement !== null) {
            this.draggedElement.style.margin = ''; // Initial centering -> custom positioning
            this.draggedElement.style.position = 'absolute';
            this.draggedElement.style.left = (e.clientX - this.elementStartDragPos.x).toString();
            this.draggedElement.style.top = (e.clientY - this.elementStartDragPos.y).toString();
        }
    }

    render(): JSX.Element {
        return (
            <div className='window-container'
                 onMouseMove={this.onMouseMove}
                 onMouseDown={this.onMouseDown}
                 onMouseUp={this.onMouseUp}
                 style={{
                    position: 'fixed',
                    left: '0px',
                    top: '0px',
                    width: '100%',
                    height: '100%'
                 }}>
                {this.props.children}
            </div>
        );
    }
}

//////////////////////////////////////////////////

export interface IWindowProps {
    title: string;
    width: number;
    background: string;
    isVisible: boolean;
    onCloseClick: () => void;
    initialTop: number;
}

export class Window extends React.Component<IWindowProps, {}> {
    constructor(props: IWindowProps) {
        super(props);
    }

    render(): JSX.Element {
        return (
            <div className='kaze-drag-target'
                 style={{
                     visibility: this.props.isVisible ? 'visible' : 'collapse',
                     width: this.props.width + 'px',
                     border: '2px solid #607d8b',
                     background: this.props.background,
                     top: this.props.initialTop,
                     margin: '0 auto', //** For initial centering, expect WindowContainer to destroy
                     position: 'relative' //** Expect WindowContainer to change to absolute
                 }}>

                <div className='kaze-drag-trigger' // Title bar
                     style={{
                         background: 'rgb(233,236,240)',
                         fontSize: '12pt',
                         padding: '3px',
                         userSelect: 'none',
                         display: 'flex',
                         justifyContent: 'space-between'
                     }}>
                    <div className='kaze-drag-trigger'>{this.props.title}</div>
                    <button onClick={this.props.onCloseClick}>X</button>
                </div>

                <div style={{ // Content
                         paddingLeft: '5px',
                         paddingRight: '5px',
                         paddingBottom: '5px',
                         paddingTop: '15px'
                     }}>
                    {this.props.children}
                </div>
            </div>
        );
    }
}

//////////////////////////////////////////////////

export interface IListMenuItem {
    text: string;
    onClick: () => void; 
}

export interface IListMenuProps {
    items: IListMenuItem[];
}

export class ListMenu extends React.Component<IListMenuProps, {}> {
    constructor(props: IListMenuProps) {
        super(props);
    }

    render(): JSX.Element {
        const items = this.props.items.map((item, i) => {
            return (
                <button style={{
                            display: 'block',
                            width: '100%'
                        }}
                        onClick={item.onClick}
                        key={i}>
                    {item.text}
                </button>
            );
        });

        return (
            <div>{items}</div>
        );
    }
}

export interface ILoginProps {
    onAccept: (s: string) => void;
}

export interface ILoginState {
    name: string;
}

export class Login extends React.Component<ILoginProps, ILoginState> {
    private nameInput: HTMLInputElement | null;

    constructor(props: ILoginProps) {
        super(props);
        this.state = {name: 'Henry'};
    }

    componentDidUpdate() {
        if (this.nameInput !== null) this.nameInput.focus();
    }

    componentDidMount() {
        if (this.nameInput !== null) this.nameInput.focus();
    }

    onNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({name: e.target.value});
    }

    onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.keyCode === 13) { // Enter
            this.props.onAccept(this.state.name);
        }
    }

    onFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
        e.currentTarget.selectionEnd = e.currentTarget.value.length;
        e.currentTarget.selectionStart = e.currentTarget.value.length;
    }

    render(): JSX.Element {
        return (
            <div>
                <label>Enter name:</label>
                <input value={this.state.name} 
                       ref={(e) => this.nameInput = e}
                       onChange={this.onNameChange} 
                       onFocus={this.onFocus}
                       onKeyDown={this.onKeyDown} />
                <button onClick={() => this.props.onAccept(this.state.name)}>OK</button>
            </div>
        );
    }
}
