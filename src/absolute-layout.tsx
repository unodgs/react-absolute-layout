/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

interface AbsoluteLayoutProps extends React.Props<AbsoluteLayoutProps> {
	children?: Array<React.ReactChild>;
	columns: number;
	rows: number;
	width: number;
	height: number;
}

interface GridCell {
	x: number;
	y: number;
	w: number;
	h: number;
	element: React.ReactChild;
};

type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, { grid: GridLayout }> {

	constructor(props: AbsoluteLayoutProps) {
		super(props);
		this.state = {
			grid: this.props.children.map((el, idx: number) => ({
				x: idx * 3,
				y: 2,
				w: 2,
				h: 2,
				element: el
			} as GridCell))
		}
	}
//			{this.props.children.map(el => )}
	render() {
		let colLines = [];
		for (let c = 1; c < this.props.columns; c++) {
			colLines.push(<div key={`column-line/${c}`} style={{
				width: 1,
				backgroundColor: '#eeeeee',
				position: 'absolute',
				height: '100%',
				top: 0,
				left: `${c * 100 / this.props.columns}%`,
			}} />);
		}

		let rowLines = [];
		for (let r = 1; r < this.props.rows; r++) {
			rowLines.push(<div key={`row-line/${r}`} style={{
				height: 1,
				backgroundColor: '#eeeeee',
				position: 'absolute',
				width: '100%',
				top: `${r * 100.0 / this.props.rows}%`,
				left: 0
			}} />);
		}

		return <div ref="grid" style={{width: '100%', height: this.props.height, border: '1px solid black', position: 'relative'}}>
			{colLines}
			{rowLines}
			{this.state.grid.map((cell, idx: number) => {
				const props = {
					key: `cell/${idx}`,
					style: {
						left: `${cell.x * 100 / this.props.columns}%`,
						top: `${cell.y * 100 / this.props.rows}%`,
						width: 100,
						height: 50,
						position: 'absolute',
						backgroundColor: cell.element.props.style.backgroundColor
					},
					onDragStart: (e) => {
						console.log("!!!dragStart " + idx, e);
					},
					onDrag: (e) => {
						console.log("!!!drag " + idx, e.clientX, e.clientY);						
					},
					onClick: () => {
						console.log("!!!click " + idx);
					}
				}


				const el = React.cloneElement(cell.element as React.ReactElement<any>, props);
				// el.key = `cell/${idx}`;
				// el. onDragStart = () => {
				// 	console.log("!!!");
				// }
				return el;
			})}
		</div>
	}
}