/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import { HorzLine, VertLine } from "./utils";

type Point = {
	x: number;
	y: number;
}

interface AbsoluteLayoutProps extends React.Props<AbsoluteLayoutProps> {
	children?: Array<React.ReactChild>;
	columns: number;
	rows: number;
	width: number;
	height: number;
}

interface AbsoluteLayoutState {
	dragging?: boolean;
	mouseStartPos?: Point;
	mouseCurrPos?: Point;
	elementPos?: Point;
	elementIdx?: number;
	grid?: GridLayout;
	totalWidth?: number;
	totalHeight?: number;
	colWidth?: number;
	rowHeight?: number;
}

interface GridCell {
	// value, attached, percentage
	x: number; xa: boolean; xp: boolean;
	y: number; ya: boolean; yp: boolean;
	w: number; wa: boolean; wp: boolean; 
	h: number; ha: boolean; hp: boolean;
	element: React.ReactChild;
};

type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

	constructor(props: AbsoluteLayoutProps) {
		super(props);
		this.state = {
			grid: this.props.children.map((el, idx: number) => ({
				x: idx * 50,
				y: 0,
				w: 100,
				h: 50,
				element: el
			} as GridCell)),
			dragging: false,
			mouseStartPos: null,
			mouseCurrPos: null,
			elementPos: null,
			elementIdx: -1,
			totalWidth: 0,
			totalHeight: 0,
			colWidth: 40,
			rowHeight: 40
		}
	}

	syncGridSize = (width: number, height: number) => {
		console.log(`totalWidth ${width}, totalHeight ${height}`);
		this.setState({
			totalWidth: width,
			totalHeight: height
		});
	}

	resize = () => {
		const grid = this.refs['grid'] as Element;
		const r = grid.getBoundingClientRect();
		this.syncGridSize(r.width, r.height);
	}

	componentDidMount = () => {
		document.addEventListener('mousedown', this.onMouseDown);
		document.addEventListener('mousemove', this.onMouseMove);
		document.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('resize', this.resize);
		this.resize();
	}

	componentWillUnmount = () => {
		document.removeEventListener('mousedown', this.onMouseDown);
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('mouseup', this.onMouseUp);
		window.removeEventListener('resize', this.resize);		
	}

	selectElement = (idx: number, x: number, y: number) => {
		console.log("Selected element " + idx);
		this.setState({
			elementIdx: idx,
			elementPos: {
				x: x,
				y: y
			}
		});
	}

	onMouseDown = (e: MouseEvent) => {
		if (this.state.elementIdx >= 0) {			
			this.setState({
				mouseStartPos: { x: e.clientX, y: e.clientY },
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				dragging: true
			});
		}
	}

	onMouseMove = (e: MouseEvent) => {
		if (this.state.dragging) {
			const idx = this.state.elementIdx;
			const grid = this.state.grid;

			const xs = [];
			const ys = [];

			for (let i = 0; i < this.state.grid.length; i++) {
				if (i !== idx) {
					const g = this.state.grid[i];
					xs.push(g.x, g.x + g.w);
					ys.push(g.y, g.y + g.h);
				}
			}

			grid[idx].x = snapToGrid(
				this.state.elementPos.x + e.clientX - this.state.mouseStartPos.x,
				xs, this.state.colWidth);
			grid[idx].y = snapToGrid(
				this.state.elementPos.y + e.clientY - this.state.mouseStartPos.y,
				ys, this.state.rowHeight);

			this.setState({
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				grid: grid
			});
		}
	}

	onMouseUp = (e: MouseEvent) => {
		this.setState({
			mouseStartPos: null,
			mouseCurrPos: null,
			elementPos: null,
			dragging: false,
		});
	}
	
	render() {
		const cols = Math.floor(this.state.totalWidth / this.state.colWidth);
		const rows = Math.floor(this.state.totalHeight / this.state.rowHeight)

		let colLines = [];
		for (let c = 1; c <= cols; c++) {
			colLines.push(
				<VertLine key={`column-line/${c}`} pos={c * this.state.colWidth} color='#eeeeee'/>
			);
		}
		for (let i = 0; i < this.state.grid.length; i++) {
			const g = this.state.grid[i];
			colLines.push(
				<VertLine key={`column-el-line-0/${i}`} pos={g.x} color="rgba(255, 0, 0, 0.17)"/>
			);
			colLines.push(
				<VertLine key={`column-el-line-1/${i}`} pos={g.x + g.w} color="rgba(255, 0, 0, 0.17)"/>
			);
		}

		let rowLines = [];
		for (let r = 1; r <= rows; r++) {
			rowLines.push(
				<HorzLine key={`row-line/${r}`} pos={r * this.state.rowHeight} color='#eeeeee'/>
			);
		}

		for (let i = 0; i < this.state.grid.length; i++) {
			const g = this.state.grid[i];
			rowLines.push(
				<HorzLine key={`row-el-line-0/${i}`} pos={g.y} color="rgba(255, 0, 0, 0.17)"/>
			);
			rowLines.push(
				<HorzLine key={`row-el-line-1/${i}`} pos={g.y + g.h} color="rgba(255, 0, 0, 0.17)"/>
			);
		}

		return <div ref="grid" style={{width: '100%', height: this.props.height, border: '1px solid black', position: 'relative'}}>
			{colLines}
			{rowLines}
			{this.state.grid.map((cell, idx: number) => {
				const props = {
					key: `cell/${idx}`,
					style: {
						left: `${cell.x}px`,
						top: `${cell.y}px`,
						width: 100,
						height: 50,
						position: 'absolute',
						border: idx === this.state.elementIdx ? '1px solid black' : 'none',
						backgroundColor: cell.element.props.style.backgroundColor
					},
					onMouseDown: (e: MouseEvent) => {
						const t = e.target as any;
						// console.log(e.clientX, e.clientY, e.pageX, e.pageY, t.left, t.top, t.style, t);
						// console.log(t);
						this.selectElement(idx, t.offsetLeft, t.offsetTop);
					},
				}

				const el = React.cloneElement(cell.element as React.ReactElement<any>, props);
				return idx === this.state.elementIdx ?
					<div key={`cellSel/${idx}`}>
						{el}
					</div>
					: el;
			})}
		</div>
	}
}

// class GridItem 
// dodac przyciaganie przeciwnej strony prostokata
function snapToGrid(pos: number, snapPoints: number[], cellSize: number) {
	let minDist = 3;
	let closestSnapPoint = -1;
	
	for (const sp of snapPoints) {
		const d = Math.abs(pos - sp); 
		if (d <= minDist) {
			closestSnapPoint = sp;
			break;
		}
	}

	const cellPos = Math.round(pos / cellSize) * cellSize;

	return closestSnapPoint >= 0
		? Math.round(pos / closestSnapPoint) * closestSnapPoint
		: (Math.abs(pos - cellPos) <= minDist ? cellPos: pos);
}