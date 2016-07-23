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
	snapPoints?: {
		horizontal: number[],
		vertical: number[]
	}
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
		const colWidth = 40;
		const rowHeight = 40;
		const grid = this.getInitialGrid(this.props.children, colWidth, rowHeight);
		const snapPoints = this.getSnapPoints(grid, -1);

		this.state = {
			grid: grid,
			snapPoints: snapPoints,
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

	getInitialGrid(children: React.ReactChild[], colWidth: number, rowHeight: number) {
		return children.map((el, idx: number) => ({
			x: colWidth,
			y: rowHeight + (idx * rowHeight * 2),
			w: colWidth * 5,
			h: rowHeight * 2,
			element: el
		} as GridCell))
	}

	getSnapPoints(grid: GridLayout, selectedIdx: number) {
		const xs = [];
		const ys = [];

		for (let i = 0; i < grid.length; i++) {
			if (i !== selectedIdx) {
				const g = grid[i];
				xs.push(g.x, g.x + g.w);
				ys.push(g.y, g.y + g.h);
			}
		}
		return {
			horizontal: ys,
			vertical: xs
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
			},
			snapPoints: this.getSnapPoints(this.state.grid, idx)
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
			const gi = grid[idx];

			const snapPoints = this.getSnapPoints(grid, idx);

			const gx = this.state.elementPos.x + e.clientX - this.state.mouseStartPos.x;
			const gy = this.state.elementPos.y + e.clientY - this.state.mouseStartPos.y;  

			let x0 = snapToGrid(gx, snapPoints.vertical, this.state.colWidth);
			let fx = x0.pos;

			if (!x0.snapped) {
				let x1 = snapToGrid(gx + gi.w, snapPoints.vertical, this.state.colWidth);
				if (x1.snapped) {
					fx = fx + (x1.pos - gx - gi.w); 
				}
			}

			const y0 = snapToGrid(gy, snapPoints.horizontal, this.state.rowHeight);
			let fy = y0.pos;

			if (!y0.snapped) {
				let y1 = snapToGrid(gy + gi.h, snapPoints.horizontal, this.state.rowHeight);
				if (y1.snapped) {
					fy = fy + (y1.pos - gy - gi.h); 
				}
			}

			gi.x = fx;
			gi.y = fy;

			this.setState({
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				grid: grid,
				snapPoints: snapPoints
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
		const rows = Math.floor(this.state.totalHeight / this.state.rowHeight);
		
		const grid = this.state.grid;
		const elementIdx = this.state.elementIdx;

		let colLines = [];
		for (let c = 1; c <= cols; c++) {
			colLines.push(
				<VertLine key={`column-line/${c}`} pos={c * this.state.colWidth} color='#eeeeee'/>
			);
		}

		let rowLines = [];
		for (let r = 1; r <= rows; r++) {
			rowLines.push(
				<HorzLine key={`row-line/${r}`} pos={r * this.state.rowHeight} color='#eeeeee'/>
			);
		}

		if (this.state.dragging) {
			const g = grid[elementIdx];
			const snapPoints = this.state.snapPoints;

			const fx0 = snapToGrid(g.x, snapPoints.vertical, this.state.colWidth);
			const fx1 = snapToGrid(g.x + g.w, snapPoints.vertical, this.state.colWidth);
			const fy0 = snapToGrid(g.y, snapPoints.horizontal, this.state.rowHeight);
			const fy1 = snapToGrid(g.y + g.h, snapPoints.horizontal, this.state.rowHeight);
			
			if (fx0.snapPoint >= 0) {
				colLines.push(
					<VertLine
						key={`column-snap-vert-line-0`}
						pos={fx0.pos}
						color="rgba(255, 0, 0, 0.17)"/>
				);
			}

			if (fx1.snapPoint >= 0) {
				colLines.push(
					<VertLine
						key={`column-snap-vert-line-1`}
						pos={fx1.pos}
						color="rgba(255, 0, 0, 0.17)"/>
				);
			}

			if (fy0.snapPoint >= 0) {
				rowLines.push(
					<HorzLine
						key={`column-snap-horz-line-0`}
						pos={fy0.pos}
						color="rgba(255, 0, 0, 0.17)"/>
				);
			}

			if (fy1.snapPoint >= 0) {
				rowLines.push(
					<HorzLine
						key={`column-snap-horz-line-1`}
						pos={fy1.pos}
						color="rgba(255, 0, 0, 0.17)"/>
				);
			}
		}

		// for (let i = 0; i < grid.length; i++) {
		// 	const g = grid[i];
		// 	colLines.push(
		// 		<VertLine key={`column-el-line-0/${i}`} pos={g.x} color="rgba(255, 0, 0, 0.17)"/>
		// 	);
		// 	colLines.push(
		// 		<VertLine key={`column-el-line-1/${i}`} pos={g.x + g.w} color="rgba(255, 0, 0, 0.17)"/>
		// 	);
		// }

		// for (let i = 0; i < grid.length; i++) {
		// 	const g = grid[i];
		// 	rowLines.push(
		// 		<HorzLine key={`row-el-line-0/${i}`} pos={g.y} color="rgba(255, 0, 0, 0.17)"/>
		// 	);
		// 	rowLines.push(
		// 		<HorzLine key={`row-el-line-1/${i}`} pos={g.y + g.h} color="rgba(255, 0, 0, 0.17)"/>
		// 	);
		// }

		return <div ref="grid" style={{width: '100%', height: this.props.height, border: '1px solid black', position: 'relative', boxSizing: 'border-box'}}>
			{colLines}
			{rowLines}
			{this.state.grid.map((cell, idx: number) => {

				const posStyle = {
					left: `${cell.x}px`,
					top: `${cell.y}px`,
					width: cell.w,
					height: cell.h,
					position: 'absolute'
				};

				const props = {
					key: `cell/${idx}`,
					style: merge(posStyle, {
						boxSizing: 'border-box',
						zIndex: idx === elementIdx ? 10000 : 'auto',
						border: idx === elementIdx ? '1px solid black' : 'none',
						backgroundColor: cell.element.props.style.backgroundColor
					}),
					onMouseDown: (e: MouseEvent) => {
						const t = e.target as any;
						this.selectElement(idx, t.offsetLeft, t.offsetTop);
					},
				}

				const el = React.cloneElement(cell.element as React.ReactElement<any>, props);
				return idx === elementIdx ?
					<div key={`cellSel/${idx}`}>
						{el} 
					</div>
					: el;
			})}
		</div>
	}
}

type SnapPoint = {
	pos: number,
	snapped: boolean,
	snapPoint: number
}

function snapToGrid(pos: number, snapPoints: number[], cellSize: number): SnapPoint {
	const minDist = 3;
	let closestSnapPoint = -1;
	
	for (const sp of snapPoints) {
		const d = Math.abs(pos - sp); 
		if (d <= minDist) {
			closestSnapPoint = sp;
			break;
		}
	}

	let outPos = { pos: pos, snapPoint: -1, snapped: false };

	if (closestSnapPoint >= 0) {
		outPos.pos = Math.round(pos / closestSnapPoint) * closestSnapPoint;
		outPos.snapPoint = closestSnapPoint;
		outPos.snapped = true;
	} else {
		const cellPos = Math.round(pos / cellSize) * cellSize;
		if (Math.abs(pos - cellPos) <= minDist) {
			outPos.pos = cellPos;
			outPos.snapped = true;
		}
	}

	return outPos;
}

function merge(obj0, obj1) {
	const m = {};
	Object.assign(m, obj0, obj1);
	return m;
}