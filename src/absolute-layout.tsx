/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import LZString from 'lz-string';
import objectAssign from 'object-assign';
import Clipboard from 'clipboard';
import { HorzLine, VertLine, Switch } from "./utils";

const RESIZE_SIZE = 20;

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
	colWidth?: number;
	rowHeight?: number;
	showGrid?: boolean;
	snapToGrid?: boolean;
	width?: number | string;
	height?: number | string;
	layout?: string | GridLayout;
	editing?: boolean;
	name: string;
	storage?: any;
	onLayoutUpdate?: (layout: GridLayout) => void;
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
		vertical: number[],
		middleHorizontal: number[],
		middleVertical: number[],
		allHorizontal: number[],
		allVertical: number[]
	};
	gridBar?: boolean;
	editing?: boolean;
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
	element: string | number;
};

type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

	private clipboard = null;
	private resizing = false;

	public static defaultProps: AbsoluteLayoutProps = {
		colWidth: 50,
		rowHeight: 50,
		width: '100%',
		height: '100%',
		showGrid: true,
		snapToGrid: true,
		editing: false,
		name: "default"
	}

	constructor(props: AbsoluteLayoutProps) {
		super(props);
		const colWidth = props.colWidth;
		const rowHeight = props.rowHeight;
		let layout: any = LZString.decompressFromBase64(props.layout);
		if (!layout) {
			layout = this.props.layout;
		}
		if (!layout) {
			layout = JSON.parse(localStorage.getItem(props.name));
		} else {
			layout = strToLayout(layout);
		}
		const grid = layout
			? this.updateLayoutChildren(layout, props.children)
			: this.getInitialGrid(props.children, colWidth, rowHeight);

		this.state = {
			grid: grid,
			dragging: false,
			mouseStartPos: null,
			mouseCurrPos: null,
			elementStartPos: null,
			elementEndPos: null,
			elementIdx: -1,
			totalWidth: 0,
			totalHeight: 0,
			colWidth: colWidth,
			rowHeight: rowHeight,
			gridBar: false,
			editing: false
		}
	}
	
	updateLayoutChildren(grid: GridLayout, children: React.ReactChild[]): GridLayout {
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (child.key) {
				const g = grid.find(g => g.element === child.key);
				if (!g) {
					if (i < grid.length) {
						grid[i].element = child.key;
					} else {
						const cell = getInitialGridCell();
						cell.element = child.key;
						grid.push(cell);
					}
				}
			} else {
				if (i < grid.length) {
					grid[i].element = i;
				} else {
					const cell = getInitialGridCell();
					cell.element = el;
					grid.push(cell);
				}

			}
			const el = children[i].key || i;
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
		const mxs = [];
		const mys = [];

		for (let i = 0; i < grid.length; i++) {
			if (i !== selectedIdx) {
				const g = grid[i];
				xs.push(g.x0, g.x1);
				ys.push(g.y0, g.y1);
				mxs.push((g.x0 + g.x1) / 2);
				mys.push((g.y0 + g.y1) / 2);
			}
		}
		
		return {
			horizontal: ys,
			vertical: xs,
			middleHorizontal: mys,
			middleVertical: mxs,
			allHorizontal: ys.concat(mys),
			allVertical: xs.concat(mxs)
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
			});
			
			const snapPoints = this.getSnapPoints(grid, -1);
			
			this.setState({
				totalWidth: width,
				totalHeight: height,
				grid: grid,
				snapPoints: snapPoints 
			});
			this.saveLayout(grid);
		}
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

	watchSize = () => {
		function frameHandler() {
			const grid = this.refs['grid'] as Element;
			const r = grid.getBoundingClientRect();
			if (this.state.totalWidth != r.width || this.state.totalHeight != r.height) {
				this.syncGridSize(r.width, r.height);
			}			
			requestAnimationFrame(frameHandler.bind(this));
		}
		requestAnimationFrame(frameHandler.bind(this));
	}

	componentDidMount = () => {
		document.addEventListener('mousedown', this.onMouseDown);
		document.addEventListener('mousemove', this.onMouseMove);
		document.addEventListener('mouseup', this.onMouseUp);
		this.watchSize();
		this.clipboard = new Clipboard(this.refs['copyLayout'] as Element);
	}

	componentDidUpdate = (prevProps: AbsoluteLayoutProps) => {
	}

	componentWillUnmount = () => {
		document.removeEventListener('mousedown', this.onMouseDown);
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('mouseup', this.onMouseUp);
		this.clipboard.destroy();
		this.clipboard = null;
	}

	selectElement = (idx: number, x: number, y: number, w: number, h: number) => {
		console.log("Selected element " + idx, x, y, w, h);
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
		const snapPoints = this.state.snapPoints;

		const colWidth = this.props.snapToGrid ? this.state.colWidth : 0;
		const rowHeight = this.props.snapToGrid ? this.state.rowHeight : 0;
		
		if (this.state.dragging) {			
			const gx0 = this.state.elementStartPos.x + dx;
			const gx1 = this.state.elementEndPos.x + dx;

			let x0 = snapToGrid(gx0, snapPoints.vertical, colWidth);
			let fx = x0.pos;

			if (!x0.snapped) {
				let x1 = snapToGrid(gx1, snapPoints.vertical, colWidth);
				if (x1.snapped) {
					fx = fx + (x1.pos - gx1);
				} else {
					let x2 = snapToGrid((gx0 + gx1) / 2, snapPoints.middleVertical);
					if (x2.snapped) {
						fx = x2.pos - Math.abs(gx1 - gx0) / 2;
					}
				}
			}

			const gy0 = this.state.elementStartPos.y + dy;
			const gy1 = this.state.elementEndPos.y + dy;

			const y0 = snapToGrid(gy0, snapPoints.horizontal, rowHeight);
			let fy = y0.pos;

			if (!y0.snapped) {
				let y1 = snapToGrid(gy1, snapPoints.horizontal, rowHeight);
				if (y1.snapped) {
					fy = fy + (y1.pos - gy1); 
				} else {
					let y2 = snapToGrid((gy0 + gy1) / 2, snapPoints.middleHorizontal);
					if (y2.snapped) {
						fy = y2.pos - Math.abs(gy1 - gy0) / 2;
					}
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

			const fx = snapToGrid(gx1, snapPoints.allVertical, colWidth);
			const fy = snapToGrid(gy1, snapPoints.allHorizontal, rowHeight);

			gi.x1 = Math.max(gi.x0, fx.pos);
			gi.y1 = Math.max(gi.y0, fy.pos);
		}

		if (this.state.resizing || this.state.dragging) {
			this.syncCellPins(gi, this.state.totalWidth, this.state.totalHeight);
			this.setState({
				mouseCurrPos: { x: e.clientX, y: e.clientY },
				grid: grid
			});
			this.saveLayout(grid);
		}
	}

	onMouseUp = (e: MouseEvent) => {
		const snapPoints = this.getSnapPoints(this.state.grid, -1);
		this.setState({
			mouseStartPos: null,
			mouseCurrPos: null,
			elementStartPos: null,
			elementEndPos: null,
			dragging: false,
			resizing: false,
			snapPoints: snapPoints
		});
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
		this.saveLayout(grid);
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

	startResizing = () => {
		this.resizing = true;
	}

	showGridBar = () => {
		this.setState({
			gridBar: true
		});
	}

	hideGridBar = () => {
		if (!this.state.editing) {
			this.setState({
				gridBar: false
			});
		}
	}
	
	toggleEditing = (e: boolean) => {
		this.setState({
			editing: e,
			elementIdx: -1
		});
	}

	saveLayout = (grid: GridLayout) => {
		const ng = grid.map(g => ({
			x0: g.x0, xl0: g.xl0, xp0: g.xp0,
			y0: g.y0, yl0: g.yl0, yp0: g.yp0,
			x1: g.x1, xl1: g.xl1, xp1: g.xp1,
			y1: g.y1, yl1: g.yl1, yp1: g.yp1
		}));
		if (this.props.onLayoutUpdate) {
			this.props.onLayoutUpdate(grid);
		}
		localStorage.setItem(this.props.name, JSON.stringify(ng));
	}

	render() {
		const totalWidth = this.state.totalWidth;
		const totalHeight = this.state.totalHeight;

		const cols = Math.floor(totalWidth / this.state.colWidth);
		const rows = Math.floor(totalHeight / this.state.rowHeight);
		
		const grid = this.state.grid;
		const elementIdx = this.state.elementIdx;
		const g = elementIdx >= 0 ? grid[elementIdx] : null;
		const axis = [];

		if (this.state.editing && g) {
			axis.push(
				<HorzLine
					key="axis-x-left"
					onClick={() => this.togglePinMode('xp0', totalWidth)}
					size={5}
					pos={(g.y0 + g.y1) / 2}
					label={this.getPosLabel(g.x0, g.xl0, g.xp0)}
					from={0}
					to={g.x0}
					highlightColor={this.getHighlightColor(g.xp0)}
					onTop={true}/>,
				<HorzLine
					key="axis-x-right"
					onClick={() => this.togglePinMode('xp1', totalWidth)}
					size={5}
					pos={(g.y0 + g.y1) / 2}
					label={this.getPosLabel(totalWidth - g.x1, g.xl1, g.xp1)}
					from={g.x1}
					to={totalWidth}
					highlightColor={this.getHighlightColor(g.xp1)}
					onTop={true}/>,
				<VertLine
					key="axis-y-top"
					onClick={() => this.togglePinMode('yp0', totalHeight)}
					size={5}
					pos={(g.x0 + g.x1) / 2}
					label={this.getPosLabel(g.y0, g.yl0, g.yp0)}
					from={0}
					to={g.y0}
					highlightColor={this.getHighlightColor(g.yp0)}
					onTop={true}/>,
				<VertLine
					key="axis-y-bottom"
					onClick={() => this.togglePinMode('yp1', totalHeight)}
					size={5}
					pos={(g.x0 + g.x1) / 2}
					label={this.getPosLabel(totalHeight - g.y1, g.yl1, g.yp1)}
					from={g.y1}
					to={totalHeight}
					highlightColor={this.getHighlightColor(g.yp1)}
					onTop={true}/>
			);
		}

		let colLines = [];
		let rowLines = [];

		if (this.props.showGrid) {
			for (let c = 1; c <= cols; c++) {
				colLines.push(
					<VertLine key={`column-line/${c}`} pos={c * this.state.colWidth} color='#eeeeee'/>
				);
			}

			for (let r = 1; r <= rows; r++) {
				rowLines.push(
					<HorzLine key={`row-line/${r}`} pos={r * this.state.rowHeight} color='#eeeeee'/>
				);
			}
		}

		let elements = null;

		if (this.state.editing) {
			elements = this.state.grid.map((g: GridCell, idx: number) => {
				const posStyle: any = {
					position: 'absolute',
					zIndex: idx === elementIdx ? 10000 : 'auto',
					left: `${g.x0}px`,
					top: `${g.y0}px`,
					width: `${g.x1 - g.x0}px`,
					height: `${g.y1 - g.y0}px`
				};
				
				const gel = g.element as React.ReactElement<any>;
				let style = merge(gel.props.style, {
					boxSizing: 'border-box',
					overflow: 'hidden',
					opacity: idx === elementIdx && (this.state.dragging || this.state.resizing) ? 0.8 : 1
				});

				style = merge(style, posStyle);

				const props = {
					key: `cell/${idx}`,
					style: style,
					onMouseDown: (e: MouseEvent) => {
						let t = e.currentTarget as HTMLElement;
						this.selectElement(idx, t.offsetLeft, t.offsetTop, t.offsetWidth, t.offsetHeight);						
						this.setState({
							dragging: !this.resizing,
							resizing: this.resizing
						});
						this.resizing = false;
					}
				}

				const el = React.cloneElement(g.element as React.ReactElement<any>, props,
					<div>
						{elementIdx == idx &&
						<div style={{
							position: 'absolute',
							left: 5, top: 5, padding: 2,
							fontSize: 12,
							backgroundColor: 'rgba(0, 0, 0, 0.3)',
							color: 'white'}}>
							{Math.round(g.x1 - g.x0)}, {Math.round(g.y1 - g.y0)}
						</div>}
						{g.xp0 !== PIN_NONE &&
						<div style={{
							position: 'absolute',
							left: 0,
							top: 'calc(50% - 10px)',
							width: 3,
							height: 20,
							backgroundColor: 'rgba(0, 0, 0, 0.2)'
						}}/>}
						{g.xp1 !== PIN_NONE &&
						<div style={{
							position: 'absolute',
							right: 0,
							top: 'calc(50% - 10px)',
							width: 3,
							height: 20,
							backgroundColor: 'rgba(0, 0, 0, 0.2)'
						}}/>}
						{g.yp0 !== PIN_NONE &&
						<div style={{
							position: 'absolute',
							top: 0,
							left: 'calc(50% - 10px)',
							width: 20,
							height: 3,
							backgroundColor: 'rgba(0, 0, 0, 0.2)'
						}}/>}
						{g.yp1 !== PIN_NONE &&
						<div style={{
							position: 'absolute',
							bottom: 0,
							left: 'calc(50% - 10px)',
							width: 20,
							height: 3,
							backgroundColor: 'rgba(0, 0, 0, 0.2)'
						}}/>}
						<div onMouseDown={this.startResizing} style={{
							position: 'absolute',
							bottom: 0,
							right: 0,
							width: 20,
							height: 20,
							cursor: 'nwse-resize'
						}}>
							<div style={{
								position: 'absolute',
								bottom: 0,
								right: 0,
								width: 8,
								height: 3,
								backgroundColor: 'rgba(0, 0, 0, 0.2)'
							}}/>
							<div style={{
								position: 'absolute',
								right: 0,
								width: 3,
								height: 5,
								bottom: 3,
								backgroundColor: 'rgba(0, 0, 0, 0.2)'
							}}/>
						</div>
					</div>
				);
				return el;
			});
		} else {
			elements = this.state.grid.map((g: GridCell, idx: number) => {
				const style = {
					position: 'absolute',
					left: `${g.x0}px`,
					top: `${g.y0}px`,
					width: `${g.x1 - g.x0}px`,
					height: `${g.y1 - g.y0}px`,
					overflow: 'hidden'
				};

				const gel = g.element as React.ReactElement<any>;
				
				const props = {
					key: `cell/${idx}`,
					style: merge(style, gel.props.style)
				}

				return React.cloneElement(g.element as React.ReactElement<any>, props);
			});
		}

		if (this.state.dragging || this.state.resizing) {
			const g = grid[elementIdx];
			const snapPoints = this.state.snapPoints;

			const fx0 = snapToGrid(g.x0, snapPoints.vertical, this.state.colWidth);
			const fx1 = snapToGrid(g.x1, snapPoints.vertical, this.state.colWidth);
			const fx2 = snapToGrid((g.x0 + g.x1) / 2, snapPoints.middleVertical, this.state.colWidth);
			const fy0 = snapToGrid(g.y0, snapPoints.horizontal, this.state.rowHeight);
			const fy1 = snapToGrid(g.y1, snapPoints.horizontal, this.state.rowHeight);
			const fy2 = snapToGrid((g.y0 + g.y1) / 2, snapPoints.middleHorizontal, this.state.rowHeight);
						
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

			if (fx2.snapPoint >= 0) {
				colLines.push(
					<VertLine
						key={`column-snap-vert-line-2`}
						pos={fx2.pos}
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

			if (fy2.snapPoint >= 0) {
				rowLines.push(
					<HorzLine
						key={`column-snap-horz-line-2`}
						pos={fy2.pos}
						color="rgba(255, 0, 0, 0.17)"/>
				);
			}
		}

		let gridBar = null;

		if (this.props.editing) {
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

			gridBar = <div>
				<div className="grid-bar-toggle" style={{
					position: 'absolute',
					backgroundColor: 'transparent',
					top: 0,
					zIndex: 10002,
					height: 5,
					width: '100%'
				}} onMouseEnter={this.showGridBar}/>
				<div className="grid-bar" style={{
					backgroundColor: 'rgba(255, 0, 0, 0.5)',
					top: this.state.gridBar ? 0 : -30,
					height: 30,
					width: '100%',
					position: 'absolute',
					overflow: 'hidden',
					zIndex: 10001,
					transition: 'all 0.15s ease-in-out'
					}} onMouseLeave={this.hideGridBar}>
					<div style={{
						position: 'absolute',
						top: 5,
						left: 3
						}}>
						<Switch round={true} onChange={this.toggleEditing}/>
					</div>
					<div style={{
						position: 'absolute',
						right: 3,
						top: 5
						}}>
						<div
							ref="copyLayout"
							className="copy-button round" 
							data-clipboard-text={LZString.compressToBase64(layoutToStr(this.state.grid))}>
							<span>COPY</span>
						</div>
					</div>
					<span style={{
						position: 'absolute',
						fontSize: 12,
						top: 8,
						left: 50,
						fontFamily: 'monospace',
						color: 'black'
						}}>
						{info}
					</span>
				</div>
			</div>;			
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
			{elements}
			{axis}
			{gridBar}
		</div>
	}
}

type SnapPoint = {
	pos: number,
	snapped: boolean,
	snapPoint: number
}

function snapToGrid(pos: number, snapPoints: number[], cellSize: number = 0): SnapPoint {
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
	} else if (cellSize > 0) {
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
