/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import LZString from 'lz-string';
import objectAssign from 'object-assign';
import Clipboard from 'clipboard';
import { HorzLine, VertLine } from "./utils" ;

type Point = {
	x: number;
	y: number;
}

type Size = {
	w: number;
	h: number;
}

interface AbsoluteLayoutProps extends React.Props<AbsoluteLayoutProps> {
	children?: Array<React.ReactChild>;
	columns: number;
	rows: number;
	width: number | string;
	height: number | string;
	initialLayout?: string;
}

interface AbsoluteLayoutState {
	dragging?: boolean;
	resizing?: boolean;
	mouseStartPos?: Point;
	mouseCurrPos?: Point;
	elementStartPos?: Point;
	elementEndPos?: Point;
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

const PIN_NONE = 0;
const PIN_PIXEL = 1;
const PIN_PERCENT = 2;

interface GridCell {
	// pos, pin mode, locked pos
	x0: number; xp0: number; xl0: number; 
	y0: number; yp0: number; yl0: number;
	x1: number; xp1: number; xl1: number;
	y1: number; yp1: number; yl1: number;
	element: React.ReactChild;
};

type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

	private clipboard = null;

	constructor(props: AbsoluteLayoutProps) {
		super(props);
		const colWidth = 40;
		const rowHeight = 40;
		let layout = LZString.decompressFromBase64(this.props.initialLayout);
		if (!layout) {
			layout = this.props.initialLayout;
		}
		const grid = layout
			? this.updateLayoutChildren(strToLayout(layout), props.children)
			: this.getInitialGrid(props.children, colWidth, rowHeight);

		const snapPoints = this.getSnapPoints(grid, -1);
		this.state = {
			grid: grid,
			snapPoints: snapPoints,
			dragging: false,
			mouseStartPos: null,
			mouseCurrPos: null,
			elementStartPos: null,
			elementEndPos: null,
			elementIdx: -1,
			totalWidth: 0,
			totalHeight: 0,
			colWidth: 40,
			rowHeight: 40
		}
	}
	
	updateLayoutChildren(grid: GridLayout, children: React.ReactChild[]): GridLayout {
		for (let i = 0; i < children.length; i++) {
			if (i < grid.length) {
				grid[i].element = children[i];
			} else {
				const cell = getInitialGridCell();
				cell.element = children[i];
				grid.push(cell);
			}
		}
		return grid;
	}

	getInitialGrid(children: React.ReactChild[], colWidth: number, rowHeight: number) {
		return children.map((el, idx: number) => ({
			x0: colWidth,
			y0: rowHeight + (idx * rowHeight * 2),
			x1: colWidth + colWidth * 5,
			y1: rowHeight + (idx * rowHeight * 2) + rowHeight * 2,
			xl0: -1,
			yl0: -1,
			xl1: -1,
			yl1: -1,
			xp0: PIN_NONE,
			yp0: PIN_NONE,
			xp1: PIN_NONE,
			yp1: PIN_NONE,
			element: el
		} as GridCell))
	}

	getSnapPoints(grid: GridLayout, selectedIdx: number) {
		const xs = [];
		const ys = [];

		for (let i = 0; i < grid.length; i++) {
			if (i !== selectedIdx) {
				const g = grid[i];
				xs.push(g.x0, g.x1);
				ys.push(g.y0, g.y1);
			}
		}
		return {
			horizontal: ys,
			vertical: xs
		}
	}

	syncGridSize = (width: number, height: number) => {
		const grid = this.state.grid;

		if (width > 0 && height > 0) {
			console.log(`totalWidth ${width}, totalHeight ${height}`);
	
			grid.forEach(g => {
				if (g.xp0 == PIN_PIXEL) {
					g.x0 = g.xl0;
				} else if (g.xp0 == PIN_PERCENT) {
					const x0 = g.x0;
					g.x0 = width * g.xl0 / 100;
					if (g.xp1 == PIN_NONE) {
						g.x1 += (g.x0 - x0);
					}
				}

				if (g.yp0 == PIN_PIXEL) {
					g.y0 = g.yl0;
				} else if (g.yp0 == PIN_PERCENT) {
					const y0 = g.y0;
					g.y0 = height * g.yl0 / 100;
					if (g.yp1 == PIN_NONE) {
						g.y1 += (g.y0 - y0);
					}
				}

				if (g.xp1 == PIN_PIXEL) {
					g.x1 = width - g.xl1;
				} else if (g.xp1 == PIN_PERCENT) {
					const x1 = g.x1;
					g.x1 = width - width * g.xl1 / 100;
					if (g.xp0 == PIN_NONE) {
						g.x0 += (g.x1 - x1);
					}
				}

				if (g.yp1 == PIN_PIXEL) {
					g.y1 = height - g.yl1;
				} else if (g.yp1 == PIN_PERCENT) {
					const y1 = g.y1;
					g.y1 = height - height * g.yl1 / 100;
					if (g.yp0 == PIN_NONE) {
						g.y0 += (g.y1 - y1);
					}
				}

				if (g.x0 > g.x1) {
					g.x1 = g.x0;
				}

				if (g.y0 > g.y1) {
					g.y1 = g.y0;
				}
			});
		}
		this.setState({
			totalWidth: width,
			totalHeight: height,
			grid: grid
		});
	}
	syncCellPins = (g: GridCell, width: number, height: number) => {
		g.xl0 = this.getLockPos(g.x0, g.xp0, width);
		g.yl0 = this.getLockPos(g.y0, g.yp0, height);
		g.xl1 = this.getLockPos(width - g.x1, g.xp1, width);
		g.yl1 = this.getLockPos(height - g.y1, g.yp1, height);
	}

	syncGridPins = (grid: GridLayout, width: number, height: number) => {
		grid.forEach(g => this.syncCellPins(g, width, height));
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
		this.clipboard = new Clipboard(this.refs['copyLayout'] as Element);
	}

	componentDidUpdate = (prevProps: AbsoluteLayoutProps) => {
		if (this.props.initialLayout && prevProps.initialLayout !== this.props.initialLayout) {
			this.resize();
		}
	}

	componentWillUnmount = () => {
		document.removeEventListener('mousedown', this.onMouseDown);
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('mouseup', this.onMouseUp);
		window.removeEventListener('resize', this.resize);
		this.clipboard.destroy();
		this.clipboard = null;
	}

	selectElement = (idx: number, x: number, y: number, w: number, h: number) => {
		console.log("Selected element " + idx);
		this.setState({
			elementIdx: idx,
			elementStartPos: {
				x: x,
				y: y
			},
			elementEndPos: {
				x: x + w,
				y: y + h
			},
			snapPoints: this.getSnapPoints(this.state.grid, idx)
		});
	}

	onMouseDown = (e: MouseEvent) => {
		if (this.state.elementIdx >= 0) {
			this.setState({
				mouseStartPos: { x: e.clientX, y: e.clientY },
				mouseCurrPos: { x: e.clientX, y: e.clientY },
			});
		}
	}

	onMouseMove = (e: MouseEvent) => {
		const idx = this.state.elementIdx;
		const grid = this.state.grid;
		const gi = grid[idx];
		const dx = this.state.mouseStartPos ? e.clientX - this.state.mouseStartPos.x : 0;
		const dy = this.state.mouseStartPos ? e.clientY - this.state.mouseStartPos.y : 0;
		const snapPoints = this.getSnapPoints(grid, idx);
		
		if (this.state.dragging) {			
			const gx0 = this.state.elementStartPos.x + dx;
			const gx1 = this.state.elementEndPos.x + dx;

			let x0 = snapToGrid(gx0, snapPoints.vertical, this.state.colWidth);
			let fx = x0.pos;

			if (!x0.snapped) {
				let x1 = snapToGrid(gx1, snapPoints.vertical, this.state.colWidth);
				if (x1.snapped) {
					fx = fx + (x1.pos - gx1);
				}
			}

			const gy0 = this.state.elementStartPos.y + dy;
			const gy1 = this.state.elementEndPos.y + dy;

			const y0 = snapToGrid(gy0, snapPoints.horizontal, this.state.rowHeight);
			let fy = y0.pos;

			if (!y0.snapped) {
				let y1 = snapToGrid(gy1, snapPoints.horizontal, this.state.rowHeight);
				if (y1.snapped) {
					fy = fy + (y1.pos - gy1); 
				}
			}

			gi.x1 = gi.x1 + (fx - gi.x0);
			gi.y1 = gi.y1 + (fy - gi.y0);
			gi.x0 = fx;
			gi.y0 = fy;
		}

		if (this.state.resizing) {
			const gx1 = this.state.elementEndPos.x + dx;
			const gy1 = this.state.elementEndPos.y + dy;  

			const fx = snapToGrid(gx1, snapPoints.vertical, this.state.colWidth);
			const fy = snapToGrid(gy1, snapPoints.horizontal, this.state.rowHeight);

			gi.x1 = fx.pos;
			gi.y1 = fy.pos;
		}

		if (this.state.resizing || this.state.dragging) {
			this.syncCellPins(gi, this.state.totalWidth, this.state.totalHeight);
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
			elementStartPos: null,
			elementEndPos: null,
			dragging: false,
			resizing: false
		});
	}

	startResizing = (e: MouseEvent) => {
		if (this.state.elementIdx >= 0) {
			this.setState({
				mouseStartPos: { x: e.clientX, y: e.clientY },
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				resizing: true			
			});
		}
	}

	togglePinMode = (key: string, totalSize: number) => {
		const grid = this.state.grid;
		const idx = this.state.elementIdx;
		const g = grid[idx];
		const lockKey = key[0] + 'l' + key[2];
		const posKey = key[0] + key[2];
		let pinMode = g[key];

		console.log(`Toggle for key ${key} of ${idx}`);

		pinMode += 1;
		if (pinMode > 2)
			pinMode = 0;

		if (pinMode === PIN_PERCENT || pinMode === PIN_PIXEL) {
			const pos = key[2] == '0' ? g[posKey] : totalSize - g[posKey];
			grid[idx][lockKey] = this.getLockPos(pos, pinMode, totalSize);
		} else if (grid[idx][key] === PIN_NONE) {
			grid[idx][lockKey] = -1;
		}

		grid[idx][key] = pinMode;

		this.setState({
			grid: grid
		});
	}

	getHighlightColor(pinMode: number): string {
		if (pinMode === PIN_PIXEL) {
			return "rgba(255, 0, 0, 0.3)";
		} else if (pinMode === PIN_PERCENT) {
			return "rgba(0, 255, 0, 0.3)"
		} else {
			return undefined;
		}
	}

	getPosLabel(pos: number, lockPos: number, pinMode: number): string {
		if (pinMode === PIN_PERCENT) {
			return `${Math.round(lockPos)}%`;
		} else if (pinMode === PIN_PIXEL) {
			return `${Math.round(lockPos)}px`
		} else {
			return `${Math.round(pos)}px`;
		}
	}

	getLockPos(pos: number, pinMode: number, totalSize: number): number {
		if (pinMode === PIN_PERCENT) {
			return pos * 100 / totalSize;
		} else {
			return pos;
		}
	}

	render() {
		const totalWidth = this.state.totalWidth;
		const totalHeight = this.state.totalHeight;

		const cols = Math.floor(totalWidth / this.state.colWidth);
		const rows = Math.floor(totalHeight / this.state.rowHeight);
		
		const grid = this.state.grid;
		const elementIdx = this.state.elementIdx;
		const g = elementIdx >= 0 ? grid[elementIdx] : null;

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

		if (this.state.dragging || this.state.resizing) {
			const g = grid[elementIdx];
			const snapPoints = this.state.snapPoints;

			const fx0 = snapToGrid(g.x0, snapPoints.vertical, this.state.colWidth);
			const fx1 = snapToGrid(g.x1, snapPoints.vertical, this.state.colWidth);
			const fy0 = snapToGrid(g.y0, snapPoints.horizontal, this.state.rowHeight);
			const fy1 = snapToGrid(g.y1, snapPoints.horizontal, this.state.rowHeight);
			
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
		let info = `GRID: [${Math.round(totalWidth)}, ${Math.round(totalHeight)}]`;
		if (elementIdx >= 0) {
			const elementKey = (g.element as React.ReactElement<any>).key || 'NO-KEY';
			const x = Math.round(g.x0);
			const y = Math.round(g.y0);
			const w = Math.round(g.x1 - g.x0);
			const h = Math.round(g.y1 - g.y0);
			const elementSize = `[${x}, ${y}, ${w}, ${h}]`;
			info += ` | BOX ${elementIdx} (${elementKey}): ${elementSize}`;
		}

		return <div ref="grid" style={{
				width: this.props.width,
				height: this.props.height,
				border: '1px solid black',
				position: 'relative',
				boxSizing: 'border-box',
				overflow: 'hidden'
			}}>
			{colLines}
			{rowLines}
			{this.state.grid.map((g: GridCell, idx: number) => {
				const posStyle: any = {
					position: 'absolute',
					zIndex: idx === elementIdx ? 10000 : 'auto',
					left: `${g.x0}px`,
					top: `${g.y0}px`,
					width: `${g.x1 - g.x0}px`,
					height: `${g.y1 - g.y0}px`
				};
				
				const gel: any = g.element;
				let style = merge(gel.props.style, {
					boxSizing: 'border-box',
					// border: idx === elementIdx ? '2px dashed black' : 'none',
					opacity: this.state.dragging ? 0.8 : 1
				});

				if (idx === elementIdx) {
					style = merge(style, {
						width: '100%',
						height: '100%'
					});
				} else {
					style = merge(style, posStyle);
				}

				const props = {
					key: `cell/${idx}`,
					style: style,
					onMouseDown: (e: MouseEvent) => {
						let t = e.target as HTMLElement;
						if (this.state.elementIdx === idx) {
							t = t.parentNode as HTMLElement;
						}

						const mx = e.clientX - t.offsetLeft + document.documentElement.scrollLeft;
						const my = e.clientY - t.offsetTop + document.documentElement.scrollTop;

						const resizing = mx > t.offsetWidth - 5 && my > t.offsetHeight - 5;

						this.selectElement(idx, t.offsetLeft, t.offsetTop, t.offsetWidth, t.offsetHeight);
						this.setState({
							dragging: !resizing,
							resizing: resizing
						});
					}
				}

				const el = React.cloneElement(g.element as React.ReactElement<any>, props,
					 <span>{Math.round(g.x1 - g.x0)}, {Math.round(g.y1 - g.y0)}</span>);
				return idx === elementIdx ?
					<div key={`cellSel/${idx}`} style={posStyle}>
						{el}
					</div>
					: el;
			})}
			{g && <HorzLine
				onClick={() => this.togglePinMode('xp0', totalWidth)}
				size={5}
				pos={(g.y0 + g.y1) / 2}
				label={this.getPosLabel(g.x0, g.xl0, g.xp0)}
				from={0}
				to={g.x0}
				highlightColor={this.getHighlightColor(g.xp0)}
				onTop={true}/>}
			{g && <HorzLine
				onClick={() => this.togglePinMode('xp1', totalWidth)}
				size={5}
				pos={(g.y0 + g.y1) / 2}
				label={this.getPosLabel(totalWidth - g.x1, g.xl1, g.xp1)}
				from={g.x1}
				to={totalWidth}
				highlightColor={this.getHighlightColor(g.xp1)}
				onTop={true}/>}
			{g && <VertLine
				onClick={() => this.togglePinMode('yp0', totalHeight)}
				size={5}
				pos={(g.x0 + g.x1) / 2}
				label={this.getPosLabel(g.y0, g.yl0, g.yp0)}
				from={0}
				to={g.y0}
				highlightColor={this.getHighlightColor(g.yp0)}
				onTop={true}/>}
			{g && <VertLine
				onClick={() => this.togglePinMode('yp1', totalHeight)}
				size={5}
				pos={(g.x0 + g.x1) / 2}
				label={this.getPosLabel(totalHeight - g.y1, g.yl1, g.yp1)}
				from={g.y1}
				to={totalHeight}
				highlightColor={this.getHighlightColor(g.yp1)}
				onTop={true}/>}
			<div style={{
				backgroundColor: 'rgba(255, 0, 0, 0.5)',
				top: 0,
				height: 30,
				width: '100%',
				position: 'absolute',
				zIndex: 10001
				}}>
				<button ref="copyLayout" 
					data-clipboard-text={LZString.compressToBase64(layoutToStr(this.state.grid))}
					style={{
					border: '1px solid black',
					backgroundColor: 'rgba(255, 0, 0, 0.4)',
					color: 'white',
					height: 'calc(100% - 10px)',
					position: 'absolute',
					right: 0,
					width: 80,
					margin: 5,
					fontSize: 10
				}}>Copy layout</button>
				<span style={{
					position: 'absolute',
					fontSize: 12,
					top: 8,
					left: 5,
					fontFamily: 'monospace',
					color: 'black'
				}}>
				{info}
				</span>
			</div>
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

function merge(...objs) {
	const m = {};
	objectAssign.apply(this, [m].concat(objs));
	return m;
}

function layoutToStr(layout: GridLayout): string {
	function posToStr(pos: number, lockPos: number, pinMode: number): string {
		let s = `${Math.round(pinMode == PIN_NONE ? pos : lockPos)}`;
		if (pinMode == PIN_PIXEL) s += 'A';
		else if (pinMode == PIN_PERCENT) s += 'P';
		else if (pinMode == 0) s += "N";
		return s;
	}
	let s = '';
	layout.forEach((g: GridCell) => {
		s += 
			posToStr(g.x0, g.xl0, g.xp0) +
			posToStr(g.y0, g.yl0, g.yp0) +
			posToStr(g.x1, g.xl1, g.xp1) +
			posToStr(g.y1, g.yl1, g.yp1) +
			"+";
	});

	return s;
}

function getInitialGridCell(): GridCell {
	return {
		x0: 0, xp0: PIN_NONE, xl0: -1,
		y0: 0, yp0: PIN_NONE, yl0: -1,
		x1: 0, xp1: PIN_NONE, xl1: -1,
		y1: 0, yp1: PIN_NONE, yl1: -1,
		element: null
	}
}

function strToLayout(s: string): GridLayout {
	let num = '';
	let numIdx = 0;
	let pinMode = PIN_NONE;
	let numEnd = false;
	let blockEnd = false;

	const grid: GridLayout = [];
	let cell: GridCell = getInitialGridCell();

	for (let i = 0; i < s.length; i++) {
		if (s[i] >= '0' && s[i] <= '9') {
			num += s[i];
		} else if (s[i] === 'A') {
			pinMode = PIN_PIXEL;
		} else if (s[i] === 'P') {
			pinMode = PIN_PERCENT;
		} else if (s[i] === 'N') {
			numEnd = true;
		} else if (s[i] === '+') {
			blockEnd = true;
		}

		if (pinMode != PIN_NONE || numEnd) {
			const v = parseInt(num) || 0;
			if (numIdx === 0) {
				if (pinMode === PIN_NONE) {
					cell.x0 = v;
				} else {
					cell.xl0 = v;
				}
				cell.xp0 = pinMode;
			} else if (numIdx === 1) {
				if (pinMode === PIN_NONE) {
					cell.y0 = v;
				} else {
					cell.yl0 = v;
				}
				cell.yp0 = pinMode;
			} else if (numIdx === 2) {
				if (pinMode === PIN_NONE) {
					cell.x1 = v;
				} else {
					cell.xl1 = v;
				}
				cell.xp1 = pinMode;
			} else if (numIdx === 3) {
				if (pinMode === PIN_NONE) {
					cell.y1 = v;
				} else {
					cell.yl1 = v;
				}
				cell.yp1 = pinMode;
			}
			numIdx += 1;
			num = '';
			numEnd = false;
			pinMode = 0;
		} else if (blockEnd) {
			grid.push(cell);
			cell = getInitialGridCell();
			numIdx = 0;
			blockEnd = false;
		}
	}
	return grid;
}

const resizeHandle = {
    position: 'absolute',
    width: 20,
    height: 20,
    bottom: 0,
    right: 0,
    background: "url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pg08IS0tIEdlbmVyYXRvcjogQWRvYmUgRmlyZXdvcmtzIENTNiwgRXhwb3J0IFNWRyBFeHRlbnNpb24gYnkgQWFyb24gQmVhbGwgKGh0dHA6Ly9maXJld29ya3MuYWJlYWxsLmNvbSkgLiBWZXJzaW9uOiAwLjYuMSAgLS0+DTwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DTxzdmcgaWQ9IlVudGl0bGVkLVBhZ2UlMjAxIiB2aWV3Qm94PSIwIDAgNiA2IiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjojZmZmZmZmMDAiIHZlcnNpb249IjEuMSINCXhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiDQl4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjZweCIgaGVpZ2h0PSI2cHgiDT4NCTxnIG9wYWNpdHk9IjAuMzAyIj4NCQk8cGF0aCBkPSJNIDYgNiBMIDAgNiBMIDAgNC4yIEwgNCA0LjIgTCA0LjIgNC4yIEwgNC4yIDAgTCA2IDAgTCA2IDYgTCA2IDYgWiIgZmlsbD0iIzAwMDAwMCIvPg0JPC9nPg08L3N2Zz4=')",
    backgroundPosition: "bottom right",
    padding: "0 3px 3px 0",
    backgroundRepeat: "no-repeat",
    backgroundOrigin: "content-box",
    boxSizing: "border-box",
    cursor: "se-resize"
}
