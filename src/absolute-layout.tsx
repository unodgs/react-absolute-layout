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
	elementPos?: Point;
	elementSize?: Size;
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

const PIN_PIXEL = 1;
const PIN_PERCENT = 2;

interface GridCell {
	// pos, pin mode, locked pos
	x: number; xp: number; xl: number; 
	y: number; yp: number; yl: number;
	w: number; wp: number; wl: number;
	h: number; hp: number; hl: number;
	element: React.ReactChild;
};

type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

	private clipboard = null;

	constructor(props: AbsoluteLayoutProps) {
		super(props);
		const colWidth = 40;
		const rowHeight = 40;
		let layout = LZString.decompressFromUTF16(this.props.initialLayout);
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
			elementPos: null,
			elementSize: null,
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

	layoutToClipboard = (text: string) => {
	}

	syncGridSize = (width: number, height: number) => {
		console.log(`totalWidth ${width}, totalHeight ${height}`);
		const grid = this.state.grid;
		if (this.state.totalWidth > 0 && this.state.totalHeight > 0) {
			const dx = width - this.state.totalWidth;
			const dy = height - this.state.totalHeight;
			grid.forEach(g => {
				if (g.xp == 0 && g.wp == PIN_PIXEL) {
					g.x += dx;
				} else if (g.wp == PIN_PIXEL) {
					g.w += dx;
				}
				if (g.yp == 0 && g.hp == PIN_PIXEL) {
					g.y += dy;
				} else if (g.hp == PIN_PIXEL) {
					g.h += dy;
				}

				if (g.xp == PIN_PERCENT) {
					g.x = this.getPos(g.x + dx, g.xp, this.state.totalWidth);
				}
			});
		}
		this.setState({
			totalWidth: width,
			totalHeight: height,
			grid: grid
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
		this.clipboard = new Clipboard(this.refs['copyLayout'] as Element);
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
			elementPos: {
				x: x,
				y: y
			},
			elementSize: {
				w: w,
				h: h
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

			if (gi.xl >= 0) {
				gi.xl = this.getPos(gi.x, gi.xp, this.state.totalWidth);
			}

			if (gi.yl >= 0) {
				gi.yl = this.getPos(gi.y, gi.yp, this.state.totalHeight);
			}

			if (gi.wl >= 0) {
				gi.xl = this.getPos(gi.x, gi.xp, this.state.totalWidth);
			}


			this.setState({
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				grid: grid,
				snapPoints: snapPoints
			});
		}

		if (this.state.resizing) {
			const idx = this.state.elementIdx;
			const grid = this.state.grid;
			const gi = grid[idx];

			const snapPoints = this.getSnapPoints(grid, idx);

			const gx = this.state.elementPos.x + this.state.elementSize.w + e.clientX - this.state.mouseStartPos.x;
			const gy = this.state.elementPos.y + this.state.elementSize.h + e.clientY - this.state.mouseStartPos.y;  

			const fx = snapToGrid(gx, snapPoints.vertical, this.state.colWidth);
			const fy = snapToGrid(gy, snapPoints.horizontal, this.state.rowHeight);

			gi.w = fx.pos - gi.x;
			gi.h = fy.pos - gi.y;

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
			elementSize: null,
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

	togglePinMode = (key: string) => {
		const grid = this.state.grid;
		const idx = this.state.elementIdx;
		grid[idx][key] += 1;
		if (grid[idx][key] > 2)
			grid[idx][key] = 0;

		if (grid[idx][key] === PIN_PERCENT) {
			grid[idx][key[0] + 'l'] = this.getPos(grid[idx][key[0]], grid[idx][key], this.state.totalWidth);
		}
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

	getSizeLabel(size: number, pinMode: number, totalSize: number): string {
		if (pinMode === PIN_PERCENT) {
			//return `${Math.round(size * 100 / totalSize)}%`;
			return `${size}%`;
		} else {
			return `${size}px`;
		}
	}

	getPos(pos: number, pinMode: number, totalSize: number): number {
		if (pinMode === PIN_PERCENT) {
			const p = pos * 100 / totalSize;
			return Math.round(p);
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
		let info = `GRID: [${totalWidth}, ${totalHeight}]`;
		if (elementIdx >= 0) {
			const elementKey = (g.element as React.ReactElement<any>).key || 'NO-KEY';
			const elementSize = `[${g.x}, ${g.y}, ${g.w}, ${g.h}]`;
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
				const x = this.getPos(g.x, g.xp, totalWidth);
				const y = this.getPos(g.y, g.yp, totalHeight);
				const w = this.getPos(g.x + g.w, g.wp, totalWidth);
				const h = this.getPos(g.y + g.h, g.hp, totalHeight);

				const posStyle = {
					position: 'absolute',
					zIndex: idx === elementIdx ? 10000 : 'auto'
				};
				
				// const left = g.xp === PIN_PIXEL
				// 	? g.x
				// 	: Math.ceil(g.x )

				// posStyle.left = `${x}px`;
				// posStyle.top = `${y}px`;  
				// posStyle.width = w - x;
				// posStyle.height = h - y;
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

						const resizing = mx > t.offsetWidth - 20 && my > t.offsetHeight - 20;

						this.selectElement(idx, t.offsetLeft, t.offsetTop, t.offsetWidth, t.offsetHeight);
						this.setState({
							dragging: !resizing,
							resizing: resizing
						});
					}
				}

				const el = React.cloneElement(g.element as React.ReactElement<any>, props);
				return idx === elementIdx ?
					<div key={`cellSel/${idx}`} style={posStyle}>
						{el}
					</div>
					: el;
			})}
			{g && <HorzLine
				onClick={() => this.togglePinMode('xp')}
				size={5}
				pos={g.y + g.h / 2}
				label={this.getSizeLabel(g.x, g.xp, totalWidth)}
				from={0}
				to={g.x}
				highlightColor={this.getHighlightColor(g.xp)}
				onTop={true}/>}
			{g && <HorzLine
				onClick={() => this.togglePinMode('wp')}
				size={5}
				pos={g.y + g.h / 2}
				label={this.getSizeLabel(totalWidth - g.x - g.w, g.wp, totalWidth)}
				from={g.x + g.w}
				to={totalWidth}
				highlightColor={this.getHighlightColor(g.wp)}
				onTop={true}/>}
			{g && <VertLine
				onClick={() => this.togglePinMode('yp')}
				size={5}
				pos={g.x + g.w / 2}
				label={this.getSizeLabel(g.y, g.yp, totalHeight)}
				from={0}
				to={g.y}
				highlightColor={this.getHighlightColor(g.yp)}
				onTop={true}/>}
			{g && <VertLine
				onClick={() => this.togglePinMode('hp')}
				size={5}
				pos={g.x + g.w / 2}
				label={this.getSizeLabel(totalHeight - g.y - g.h, g.hp, totalHeight)}
				from={g.y + g.h}
				to={totalHeight}
				highlightColor={this.getHighlightColor(g.hp)}
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
					data-clipboard-text={LZString.compressToUTF16(layoutToStr(this.state.grid))}
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
	function posToStr(p: number, pinMode: number): string {
		let s = `${p}`;
		if (pinMode == PIN_PIXEL) s += 'A';
		else if (pinMode == PIN_PERCENT) s += 'P';
		else if (pinMode == 0) s += "|";
		return s;
	}
	let s = '';
	layout.forEach((g: GridCell, idx: number) => {
		s += 
			posToStr(g.x, g.xp) +
			posToStr(g.y, g.yp) +
			posToStr(g.w, g.wp) +
			posToStr(g.h, g.hp) +
			";";
	});
	return s;
}

function getInitialGridCell(): GridCell {
	return {
		x: 0, xp: PIN_PIXEL, xl: -1,
		y: 0, yp: PIN_PIXEL, yl: -1,
		w: 0, wp: PIN_PIXEL, wl: -1,
		h: 0, hp: PIN_PIXEL, hl: -1,
		element: null
	}
}

function strToLayout(s: string): GridLayout {
	let num = '';
	let numIdx = 0;
	let pinMode = 0;
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
		} else if (s[i] === '|') {
			numEnd = true;
		} else if (s[i] === ';') {
			blockEnd = true;
		}

		if (pinMode != 0 || numEnd) {
			const v = parseInt(num) || 0;
			if (numIdx === 0) {
				cell.x = v;
				cell.xp = pinMode;
			} else if (numIdx === 1) {
				cell.y = v;
				cell.yp = pinMode;
			} else if (numIdx === 2) {
				cell.w = v;
				cell.wp = pinMode;
			} else if (numIdx === 3) {
				cell.h = v;
				cell.hp = pinMode;
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
