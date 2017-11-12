import React = require('react');

export interface CanvasProps {
    id: string;
    width: string;
    height: string;
    isVisible: boolean;
}

export const Canvas = (props: CanvasProps) => (
  <canvas 
    id={props.id}
    style={{
        visibility: props.isVisible ? 'visible' : 'collapse',
        background: 'black',
        transform: 'scale(1.5)',
        display: 'block',
        margin: '25px auto',
        transformOrigin: 'top 0px'
    }} 
    width={props.width} height={props.height} />
);
