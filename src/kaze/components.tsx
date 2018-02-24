import React = require('react');
import Calcs = require('./calcs');
import Vec2d = Calcs.Vec2d;

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
            if (targetElement.className.indexOf('drag-trigger') > -1) { // eg. Title bar
                const bounding = targetElement.getBoundingClientRect();

                let dragTargetCandidate: HTMLElement | null = targetElement;
                while (true) {
                    dragTargetCandidate = dragTargetCandidate.parentElement;
                    if (dragTargetCandidate === null) return; // Nothing to drag
                    if (dragTargetCandidate.className.indexOf('drag-target') > -1) break; // eg. Window
                }
                this.draggedElement = dragTargetCandidate;
                this.elementStartDragPos.x = e.clientX - bounding.left;
                this.elementStartDragPos.y = e.clientY - bounding.top;
            }
        }
    }

    onMouseMove = (e: React.MouseEvent<Element>): void => {
        if (this.draggedElement !== null) {
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
}

export class Window extends React.Component<IWindowProps, {}> {
    constructor(props: IWindowProps) {
        super(props);
    }

    render(): JSX.Element {
        return (
            <div className='drag-target'
                 style={{
                     visibility: this.props.isVisible ? 'visible' : 'collapse',
                     position: 'absolute',
                     width: this.props.width + 'px',
                     border: '2px solid #607d8b',
                     background: this.props.background,
                     left: '0px',
                     top: '0px'
                 }}>

                <div className='drag-trigger' // Title bar
                     style={{
                         background: 'white',
                         fontFamily: 'monospace',
                         fontSize: '12pt',
                         padding: '3px',
                         userSelect: 'none'
                     }}>
                    {this.props.title}
                    <button style={{float: 'right'}}
                            onClick={this.props.onCloseClick}>X</button>
                </div>

                <div style={{ // Content
                         padding: '5px'
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
                            fontFamily: 'monospace',
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
