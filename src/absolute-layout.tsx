import * as React from "react";
import * as ReactDOM from "react-dom";
import * as LZString from 'lz-string';
import * as objectAssign from 'object-assign';
import * as Clipboard from 'clipboard';
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

const SIZE_NONE = 0;
const SIZE_STRETCH = 1;
const SIZE_EXTEND_VIEWPORT = 2;
const SIZE_EXTEND_CONTENT = 3;
const SIZE_VIEWPORT = 4;

interface AbsoluteLayoutProps extends React.Props<AbsoluteLayoutProps> {
    colWidth?: number;
    rowHeight?: number;
    showGrid?: boolean;
    snapToGrid?: boolean;
    snapToMargins?: number;
    width?: number;
    height?: number;
    initialLayout?: string | number;
    layout?: GridLayout;
    editing?: boolean;
    toolbar?: boolean;
    name?: string;
    storage?: any;
    onLayoutUpdate?: (layout: GridLayout) => void;
    onSelectElement?: (idx: number) => void;
    style?: any;
    innerStyle?: any;
    className?: string;
    topClassName?: string;
    adjustWidth?: number;
    adjustHeight?: number;
    aspectRatio?: number;
    elementIdx?: number;
    id?: string;
}

interface SnapPoints {
    horizontal: number[];
    vertical: number[];
    middleHorizontal: number[];
    middleVertical: number[];
    allHorizontal: number[];
    allVertical: number[];
}
interface AbsoluteLayoutState {
    dragging?: boolean;
    resizing?: boolean;
    layoutSync?: boolean;
    mouseStartPos?: Point;
    mouseCurrPos?: Point;
    elementStartPos?: Point;
    elementEndPos?: Point;
    elementIdx?: number;
    grid?: GridLayout;
    totalWidth?: number;
    totalHeight?: number;
    calcWidth?: number;
    calcHeight?: number;
    contentWidth?: number;
    contentHeight?: number;
    width?: number;
    height?: number;
    colWidth?: number;
    rowHeight?: number;
    snapPoints?: SnapPoints;
    gridBar?: boolean;
    editing?: boolean;
    adjustWidth?: number;
    adjustHeight?: number;
}

export const PIN_NONE = 0;
export const PIN_PIXEL = 1;
export const PIN_PERCENT = 2;

export interface GridCell {
    // pos, pin mode, locked pos
    x0: number; xp0: number; xl0: number; 
    y0: number; yp0: number; yl0: number;
    x1: number; xp1: number; xl1: number;
    y1: number; yp1: number; yl1: number;
    key: string | number;
    idx: number;
}
export type GridLayout = {
    width: number,
    height: number,
    cells: Array<GridCell>
};


export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

    private clipboard = null;
    private resizing = false;
    private dragging = false;
    private animationFrameId = null;

    public static defaultProps: AbsoluteLayoutProps = {
        colWidth: 50,
        rowHeight: 50,
        showGrid: true,
        snapToGrid: true,
        snapToMargins: 5,
        editing: false,
        toolbar: true,
        name: "default",
        adjustWidth: 1,
        adjustHeight: 1,
        aspectRatio: 1.0
    };

    constructor(props: AbsoluteLayoutProps) {
        super(props);
        const colWidth = Math.max(props.colWidth, 5);
        const rowHeight = Math.max(props.rowHeight, 5);
        let layout: any = LZString.decompressFromBase64(props.initialLayout as string);
        if (!layout) {
            layout = this.props.layout || this.props.initialLayout;
        }
        if (!layout) {
            layout = JSON.parse(localStorage.getItem(props.name));
        } else {
            layout = strToLayout(layout);
        }
        const grid = layout
            ? this.syncLayoutChildren(layout, props.children as React.ReactChild[])
            : this.getInitialGrid(props.children as React.ReactChild[], colWidth, rowHeight);

        if (!layout) {
            this.saveLayout(grid);
        }

        this.state = {
            grid: grid,
            dragging: false,
            resizing: false,
            mouseStartPos: null,
            mouseCurrPos: null,
            elementStartPos: null,
            elementEndPos: null,
            elementIdx: -1,
            totalWidth: 0,
            totalHeight: 0,
            calcWidth: 0,
            calcHeight: 0,
            contentWidth: 0,
            contentHeight: 0,
            colWidth: colWidth,
            rowHeight: rowHeight,
            gridBar: false,
            editing: this.props.editing,
            adjustWidth: SIZE_NONE,
            adjustHeight: SIZE_NONE
        }
    }
    
    syncLayoutChildren = (grid: GridLayout, children: React.ReactChild[]): GridLayout => {
        const newGrid: GridLayout = {
            width: 0,
            height: 0,
            cells: []
        };

        for (let i = 0; i < children.length; i++) {
            const child = children[i] as React.ReactElement<any>;
            if (child) {
            const key = child.key ? child.key : i;
                const g: GridCell = grid.cells.find(g => g.key === key);
                const ng: GridCell = getInitialGridCell(100, 100, g ? null : grid, this.state ? this.state.elementIdx : -1);
                if (g) {
                    ng.x0 = g.x0; ng.xp0 = g.xp0; ng.xl0 = g.xl0;
                    ng.y0 = g.y0; ng.yp0 = g.yp0; ng.yl0 = g.yl0;
                    ng.x1 = g.x1; ng.xp1 = g.xp1; ng.xl1 = g.xl1;
                    ng.y1 = g.y1; ng.yp1 = g.yp1; ng.yl1 = g.yl1;
                }
            ng.key = key; 
            ng.idx = i;
                newGrid.cells.push(ng);
        }
        }
        return newGrid;
    };

    getTotalSize = () => {
        return {
            w: this.state.totalWidth,
            h: this.state.totalHeight
        };
    };
    getCalcSize = () => {
        return {
            w: this.state.calcWidth,
            h: this.state.calcHeight
        };
    };
    getInitialGrid(children: React.ReactChild[], colWidth: number, rowHeight: number): GridLayout {
        const cells =  children.map((el: React.ReactElement<any>, idx: number) => {
            const x0 = colWidth;
            const y0 = rowHeight + (idx * rowHeight * 2);
            const x1 = colWidth + colWidth * 5;
            const y1 = rowHeight + (idx * rowHeight * 2) + rowHeight * 2;
            return {
                x0: x0,
                y0: y0,
                x1: x1,
                y1: y1,
                xl0: x0,
                yl0: y0,
                xl1: x1,
                yl1: y1,
            xp0: PIN_NONE,
            yp0: PIN_NONE,
            xp1: PIN_NONE,
            yp1: PIN_NONE,
            key: el.key ? el.key : idx,
            idx: idx
            } as GridCell;
        });
        return {
            width: 0,
            height: 0,
            cells: cells
    }
    }

    syncGridSize = (layout: GridLayout, totalWidth: number, calcWidth: number, contentWidth: number, totalHeight: number, calcHeight: number, contentHeight: number, adjustWidth: number, adjustHeight: number, cb?) => {
        const state = {
            totalWidth: totalWidth,
            totalHeight: totalHeight,
            calcWidth: calcWidth,
            calcHeight: calcHeight,
            adjustWidth: adjustWidth,
            adjustHeight: adjustHeight,
            contentWidth: contentWidth,
            contentHeight: contentHeight
        };

        if (layout) {
            const { grid, snapPoints } = recalculateLayout(layout, calcWidth, calcHeight, this.props.snapToMargins);
            layout = grid;
            state['grid'] = grid;
            state['snapPoints'] = snapPoints;
            }
        this.setState(state, () => {
            if (layout) {
                this.saveLayout(layout);
        }
            if (cb) {
                cb();
        }
        });
    };

    updateLayout = (layout: GridLayout, forceLayoutRecalculation = true) => {
        if (forceLayoutRecalculation) {
            this.suspendLayoutUpdate = true;
        }

        let outerWidth = !this.props.editing;
        let outerHeight = !this.props.editing;

        const grid = this.refs['grid'] as Element;
        const r = grid.getBoundingClientRect();
        let w = r.width;
        let h = r.height;

        if (w === 0 || h === 0 || outerWidth || outerHeight) {
            let el = grid.parentElement;
            let stopWalking = false;

            while (el) {
                if (!stopWalking) {
                    stopWalking = this.props.topClassName
                        ? el.classList.contains(this.props.topClassName)
                        : false;
                }

                const r = el.getBoundingClientRect();
                if ((w === 0 || outerWidth) && r.width > 0) {
                    w = r.width;
                    if (stopWalking) {
                        outerWidth = false;
                    }
                }
                if ((h === 0 || outerHeight) && r.height > 0) {
                    h = r.height;
                    if (stopWalking) {
                        outerHeight = false;
                    }
                }

                el = el.parentElement;
            }

            if (w === 0 || outerWidth) {
                w = window.innerWidth;
            }

            if (h === 0 || outerHeight) {
                h = window.innerHeight;
            }
        }

        let contentWidth = forceLayoutRecalculation ? 0 : this.state.contentWidth;
        let contentHeight = forceLayoutRecalculation ? 0 : this.state.contentHeight;
            
        const contentGrid = this.refs['content-grid'] as Element;
        if (contentGrid && forceLayoutRecalculation) {
            for (let i = 0; i < contentGrid.childNodes.length; i++) {
                const el = contentGrid.childNodes[i] as HTMLElement;
                if (el.classList.contains("al-grid-item")) {
                    const size = getMaxElementSize(el);
                    if (size[0] > contentWidth) {
                        contentWidth = size[0];
                    }
                }
            }

            var [top, bottom] = findTopAndBottomCoords(this.refs['content-grid'] as HTMLElement);
            let maxHeight = Math.abs(top - bottom);
            if (maxHeight > contentHeight) {
                contentHeight = maxHeight;
            }
        }

        let calcWidth = this.props.width || w;
        if (this.props.adjustWidth === SIZE_EXTEND_VIEWPORT) {
            calcWidth = Math.max(calcWidth, w);
        } else if (this.props.adjustWidth === SIZE_EXTEND_CONTENT) {
            calcWidth = Math.max(w, contentWidth);
        } else if (this.props.adjustWidth !== SIZE_NONE) {
            calcWidth = w;
        }

        let calcHeight = this.props.height || h;
        if (this.props.adjustHeight === SIZE_EXTEND_VIEWPORT) {
            calcHeight = Math.max(calcHeight, h);
        } else if (this.props.adjustHeight === SIZE_EXTEND_CONTENT) {
            calcHeight = Math.max(h, contentHeight);
        } else if (this.props.adjustHeight !== SIZE_NONE) {
            calcHeight = h;
        }

        const layoutRecalculation = forceLayoutRecalculation ||
            this.state.adjustWidth !== this.props.adjustWidth ||
            this.state.adjustHeight !== this.props.adjustHeight ||
            this.state.totalWidth != w || this.state.totalHeight != h;
        
        if (layoutRecalculation) {
            console.log(this.props.className, "SYNC",
                this.state.totalWidth, '=>', w, ', ',
                this.state.totalHeight, '=>', h, ' |',
                this.state.calcWidth, '=>', calcWidth, ', ',
                this.state.calcHeight, '=>', calcHeight, ' |',
                this.state.contentWidth, '=>', contentWidth, ', ',
                this.state.contentHeight, '=>', contentHeight, ' |',
                forceLayoutRecalculation);
            this.syncGridSize(
                layoutRecalculation ? layout : null,
                w, calcWidth, contentWidth,
                h, calcHeight, contentHeight,
                this.props.adjustWidth, this.props.adjustHeight, () => {
                    this.suspendLayoutUpdate = false;
                });
            }			

        if (forceLayoutRecalculation && !layoutRecalculation) {
            this.suspendLayoutUpdate = false;
        }
    };

    private suspendLayoutUpdate = false;
    private initialFrame = true;
    watchSizeFrameHandler = () => {
        if (!this.suspendLayoutUpdate) {
            this.updateLayout(this.state.grid, this.initialFrame);
            this.initialFrame = false;
    }
        this.animationFrameId = requestAnimationFrame(this.watchSizeFrameHandler);
    };

    componentDidMount() {
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        this.animationFrameId = requestAnimationFrame(this.watchSizeFrameHandler);
        this.clipboard = new Clipboard(this.refs['copyLayout'] as Element);
    }

    componentWillReceiveProps(props: AbsoluteLayoutProps) {
        let grid = props.layout;
        if (!equalChildren(props.children as any, this.props.children as any)) {
            grid = this.syncLayoutChildren(grid, props.children as React.ReactChild[]);
        }

        if (!equalLayout(grid, this.state.grid)) {
            this.updateLayout(grid);
        }
        if (props.elementIdx !== this.state.elementIdx) {
                this.setState({
                elementIdx: props.elementIdx
                });
            }
    }

    componentWillUnmount() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.clipboard.destroy();
        this.clipboard = null;
    }

    clearSelectedElement = () => {
        this.setState({
            elementIdx: -1,
            elementStartPos: null,
            elementEndPos: null
        });
    };

    selectElement = (idx: number, x: number, y: number, w: number, h: number) => {
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
            snapPoints: getSnapPoints(this.state.grid, idx, this.props.snapToMargins)
        }, () => this.onSelectElement(idx));
    };

    onSelectElement = (idx: number) => {
        if (this.props.onSelectElement) {
            this.props.onSelectElement(idx);
    }
    };

    onMouseDown = (e: MouseEvent) => {
        if (this.state.elementIdx >= 0) {
            this.setState({
                mouseStartPos: { x: e.clientX, y: e.clientY },
                mouseCurrPos: { x: e.clientX, y: e.clientY },
            });
        }
    };

    onMouseMove = (e: MouseEvent) => {
        // e.stopPropagation();
        const idx = this.state.elementIdx;
        const grid = this.state.grid;
        const gi = grid.cells[idx];
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
            syncCellPins(gi, this.state.calcWidth, this.state.calcHeight);
            this.setState({
                mouseCurrPos: { x: e.clientX, y: e.clientY },
                grid: grid
            }, () => this.saveLayout(grid));
        }
    };

    onMouseUp = (e: MouseEvent) => {
        const snapPoints = getSnapPoints(this.state.grid, -1, this.props.snapToMargins);
        this.setState({
            mouseStartPos: null,
            mouseCurrPos: null,
            elementStartPos: null,
            elementEndPos: null,
            dragging: false,
            resizing: false,
            snapPoints: snapPoints
        });
        this.resizing = false;
        this.dragging = false;
    };

    togglePinMode = (key: string, totalSize: number) => {
        // const grid = clone(this.state.grid);
        const grid = this.state.grid;
        const idx = this.state.elementIdx;
        const g = grid.cells[idx];
        const lockKey = key[0] + 'l' + key[2];
        const posKey = key[0] + key[2];
        let pinMode = g[key];

        pinMode += 1;
        if (pinMode > 2)
            pinMode = 0;

        if (pinMode === PIN_PERCENT || pinMode === PIN_PIXEL) {
            const pos = key[2] == '0' ? g[posKey] : totalSize - g[posKey];
            grid.cells[idx][lockKey] = getLockPos(pos, pinMode, totalSize);
        } else if (pinMode === PIN_NONE) {
            grid.cells[idx][lockKey] = g[posKey];
        }

        grid.cells[idx][key] = pinMode;

        this.updateLayout(grid);
    };

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

    startResizing = () => {
        this.onSelectElement(this.state.elementIdx);
        this.resizing = true;

    };

    showGridBar = () => {
        if (this.props.editing) {
            this.setState({
                gridBar: true
            });
        }
    }

    hideGridBar = () => {
        if (this.props.editing) {
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

    saveLayout = (grid: GridLayout, width?, height?) => {
        if (this.props.onLayoutUpdate) {
            grid.width = width || this.props.width || this.state.calcWidth;
            grid.height = height || this.props.height || this.state.calcHeight;
            this.props.onLayoutUpdate(grid);
        }
    };

    render() {
        const calcWidth = this.state.calcWidth;
        const calcHeight = this.state.calcHeight;

        const contentWidth = this.state.contentWidth;
        const contentHeight = this.state.contentHeight;

        const cols = Math.floor(calcWidth / this.state.colWidth);
        const rows = Math.floor(calcHeight / this.state.rowHeight);
        
        const grid = this.state.grid;
        const elementIdx = this.state.elementIdx;
        const g = elementIdx >= 0 ? grid.cells[elementIdx] : null;
        const axis = [];

        if (this.state.editing && g) {
            axis.push(
                <HorzLine
                    key="axis-x-left"
                    onClick={() => this.togglePinMode('xp0', calcWidth)}
                    size={5}
                    pos={(g.y0 + g.y1) / 2}
                    label={this.getPosLabel(g.x0, g.xl0, g.xp0)}
                    from={0}
                    to={g.x0}
                    highlightColor={this.getHighlightColor(g.xp0)}
                    onTop={true}/>,
                <HorzLine
                    key="axis-x-right"
                    onClick={() => this.togglePinMode('xp1', calcWidth)}
                    size={5}
                    pos={(g.y0 + g.y1) / 2}
                    label={this.getPosLabel(calcWidth - g.x1, g.xl1, g.xp1)}
                    from={g.x1}
                    to={calcWidth}
                    highlightColor={this.getHighlightColor(g.xp1)}
                    onTop={true}/>,
                <VertLine
                    key="axis-y-top"
                    onClick={() => this.togglePinMode('yp0', calcHeight)}
                    size={5}
                    pos={(g.x0 + g.x1) / 2}
                    label={this.getPosLabel(g.y0, g.yl0, g.yp0)}
                    from={0}
                    to={g.y0}
                    highlightColor={this.getHighlightColor(g.yp0)}
                    onTop={true}/>,
                <VertLine
                    key="axis-y-bottom"
                    onClick={() => this.togglePinMode('yp1', calcHeight)}
                    size={5}
                    pos={(g.x0 + g.x1) / 2}
                    label={this.getPosLabel(calcHeight - g.y1, g.yl1, g.yp1)}
                    from={g.y1}
                    to={calcHeight}
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
            elements = this.state.grid.cells.map((g: GridCell, idx: number) => {
                const zIndex = idx === elementIdx ? 10000 : 'auto';

                const posStyle: any = {
                    position: 'absolute',
                    zIndex: zIndex,
                    left: `${g.x0}px`,
                    top: `${g.y0}px`,
                    width: `${g.x1 - g.x0}px`,
                    height: `${g.y1 - g.y0}px`
                };
                
                const gel = this.props.children[g.idx] as React.ReactElement<any>;

                if (gel) {
                    const gelProps = gel.props as any;
                    let style = merge(posStyle, {
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        opacity: idx === elementIdx && (this.state.dragging || this.state.resizing) ? 0.8 : 1
                    });

                    const props = {
                        key: `cell/${g.key}`,
                        style: style,
                        className: gelProps.className + ' al-grid-item',
                        onMouseDown: (e: React.MouseEvent<any>) => {
                            e.stopPropagation();
                            let t = e.currentTarget as HTMLElement;
                            this.selectElement(idx, t.offsetLeft, t.offsetTop, t.offsetWidth, t.offsetHeight);						
                            this.setState({
                                dragging: !this.resizing,
                                resizing: this.resizing
                            });
                            this.dragging = !this.resizing;
                            this.resizing = false;
                        }
                    };

                    const elPosStyle = {
                        position: 'absolute',
                        boxSizing: 'border-box',
                        left: 0,
                        top: 0,
                        width: `${g.x1 - g.x0}px`,
                        height: `${g.y1 - g.y0}px`
                    };
                    
                    const el = React.cloneElement(gel, merge(gelProps, {
                        key: `cell-content/${g.key}`,
                        style: merge(gelProps.style, elPosStyle)
                    }), null);
                        
                    const grabRect = 
                    <div style={...posStyle} {...props}>
                        {elementIdx == idx &&
                        <div style={{
                            position: 'absolute',
                            left: 5, top: 5, padding: 2,
                            fontSize: 12,
                            zIndex: zIndex,
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
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>}
                        {g.xp1 !== PIN_NONE &&
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(50% - 10px)',
                            width: 3,
                            height: 20,
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>}
                        {g.yp0 !== PIN_NONE &&
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 'calc(50% - 10px)',
                            width: 20,
                            height: 3,
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>}
                        {g.yp1 !== PIN_NONE &&
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 'calc(50% - 10px)',
                            width: 20,
                            height: 3,
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>}
                        <div onMouseDown={this.startResizing.bind(this)} style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 20,
                            height: 20,
                            zIndex: zIndex,
                            cursor: 'nwse-resize'
                        }}>
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 8,
                            height: 3,
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            width: 3,
                            height: 5,
                            bottom: 3,
                            zIndex: zIndex,
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }}/>
                        </div>
                        {el}
                    </div>
                    ;
                    return grabRect;
                } else {
                    return null;
                }
            });
        } else {
            elements = this.state.grid.cells.map((g: GridCell, idx: number) => {
                const style = {
                    position: 'absolute',
                    left: `${g.x0}px`,
                    top: `${g.y0}px`,
                    width: `${g.x1 - g.x0}px`,
                    height: `${g.y1 - g.y0}px`,
                    overflow: 'hidden'
                };

                const gel = this.props.children[g.idx] as React.ReactElement<any>;
                if (gel) {
                    const gelProps = gel.props as any;
                const props = {
                    key: `cell/${idx}`,
                        className: gelProps.className + ' al-grid-item',
                        style: merge(style, gelProps ? gelProps.style : {})
                    };
                    return React.cloneElement(gel, props, gel.props.children);
                } else {
                    return null;
                }
            });
        }

        if (this.state.dragging || this.state.resizing) {
            const g = grid.cells[elementIdx];
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

        if (this.props.editing && this.props.toolbar) {
            let info = `GRID: [${Math.round(calcWidth)}, ${Math.round(calcHeight)}]`;
            if (elementIdx >= 0) {
                const elementKey = (this.props.children[g.idx] as React.ReactElement<any>).key || 'NO-KEY';
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
                        <Switch round={true} onChange={this.toggleEditing} value={this.state.editing}/>
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

        const aw = this.props.adjustWidth;
        const ah = this.props.adjustHeight;

        const w: number = this.props.width;
        const h: number = this.props.height;

        let iw = w;
        if (aw === SIZE_EXTEND_VIEWPORT) {
            iw = Math.max(w, this.state.totalWidth);
        } else if (aw === SIZE_EXTEND_CONTENT) {
            iw = Math.max(this.state.totalWidth, contentWidth);
        } else if (aw !== SIZE_NONE) {
            iw = this.state.totalWidth;
        }

        let ih = h;
        if (ah === SIZE_EXTEND_VIEWPORT) {
            ih = Math.max(h, this.state.totalHeight);
        } else if (ah === SIZE_EXTEND_CONTENT) {
            ih = Math.max(this.state.totalHeight, contentHeight);
        } else if (ah !== SIZE_NONE) {
            ih = this.state.totalHeight;
        }

        let cw = w;
        if (aw === SIZE_EXTEND_VIEWPORT) {
            cw = Math.max(w, calcWidth);
        } else if (aw === SIZE_EXTEND_CONTENT) {
            cw = Math.max(calcWidth, contentWidth);
        } else if (aw === SIZE_VIEWPORT) {
            cw = calcWidth;
        }

        let ch = h;
        if (ah === SIZE_EXTEND_VIEWPORT) {
            ch = Math.max(h, calcHeight);
        } else if (ah === SIZE_EXTEND_CONTENT) {
            ch = Math.max(calcHeight, contentHeight);
        } else if (ah === SIZE_VIEWPORT) {
            ch = calcHeight;
        }

        const horzScale = !this.props.editing && aw === SIZE_STRETCH ? makeScale(calcWidth, w) : 1;
        const vertScale = !this.props.editing && ah === SIZE_STRETCH ? makeScale(calcHeight, h) : 1;

        // console.log(this.props.className, this.props.id, w, calcWidth, this.state.totalWidth, h, calcHeight, this.state.totalHeight);

        return <div ref="grid" className={this.props.className} style={{
                width: this.props.width ? this.props.width : '100%',
                height: this.props.height ? this.props.height : '100%',
                position: 'relative',
                boxSizing: 'border-box',
                overflow: 'auto',
                border: this.props.editing ? '1px solid #eeeeee' : 'none'
            }} onMouseDown={this.clearSelectedElement}>
            <div className="inner-grid" ref='inner-grid' style={merge({
                width: iw,
                height: ih
            }, this.props.style)}>
                <div className="content-grid" ref="content-grid" style={merge({
                    width: cw,
                    height: ch,
                    backgroundSize: `cover`,
                    backgroundRepeat: 'no-repeat',
                    transform: `scale(${horzScale}, ${vertScale})`,
                    transformOrigin: 'top left',
                    overflow: 'hidden'
                    }, this.props.innerStyle)}>
                    {colLines}
                    {rowLines}
                    {elements}
                    {axis}
                    {gridBar}
                </div>
            </div>
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
        outPos.pos = closestSnapPoint > 0
            ? Math.round(pos / closestSnapPoint) * closestSnapPoint
            : 0;
        outPos.snapPoint = closestSnapPoint;
        outPos.snapped = true;
    } else if (cellSize > 0) {
        const cellPos = cellSize > 0
            ? Math.round(pos / cellSize) * cellSize
            : 0;
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

function getInitialGridCell(w: number = 0, h: number = 0, grid: GridLayout = null, elementIdx = -1): GridCell {
    let x0 = 1000000;
    let y0 = 0;

    if (w > 0 && h > 0 && grid && grid.cells) {
        if (elementIdx >= 0) {
            const eg = grid.cells[elementIdx];
            x0 = eg.x0 + 15;
            y0 = eg.y0 + 15;
        } else {
            x0 = 15;
            y0 = 15;
        }
    }

    return {
        x0: x0, xp0: PIN_NONE, xl0: x0,
        y0: y0, yp0: PIN_NONE, yl0: y0,
        x1: x0 + w, xp1: PIN_NONE, xl1: x0 + w,
        y1: y0 + h, yp1: PIN_NONE, yl1: y0 + h,
        key: null,
        idx: -1
    }
}

export function equalLayout(grid0: GridLayout, grid1: GridLayout) {
    if (!grid0.cells)
        return false;

    if (!grid1.cells)
        return false;

    if (grid0.cells.length !== grid1.cells.length) {
        return false;
    }

    if (grid0.width !== grid1.width || grid0.height !== grid1.height) {
        return false;
    }

    for (let i = 0; i < grid0.cells.length; i++) {
        const g0 = grid0.cells[i];
        const g1 = grid1.cells[i];

        if (
            // g0.x0 !== g1.x0 || g0.xl0 !== g1.xl0 || g0.xp0 !== g1.xp0 ||
            // g0.x1 !== g1.x1 || g0.xl1 !== g1.xl1 || g0.xp1 !== g1.xp1 ||
            // g0.y0 !== g1.y0 || g0.yl0 !== g1.yl0 || g0.yp0 !== g1.yp0 ||
            // g0.y1 !== g1.y1 || g0.yl1 !== g1.yl1 || g0.yp1 !== g1.yp1 ||
            Math.round(g0.x0 + g0.xl0) != Math.round(g1.x0 + g1.xl0) || g0.xp0 !== g1.xp0 ||
            Math.round(g0.x1 + g0.xl1) != Math.round(g1.x1 + g1.xl1) || g0.xp1 !== g1.xp1 ||
            Math.round(g0.y0 + g0.yl0) != Math.round(g1.y0 + g1.yl0) || g0.yp0 !== g1.yp0 ||
            Math.round(g0.y1 + g0.yl1) != Math.round(g1.y1 + g1.yl1) || g0.yp1 !== g1.yp1 ||
            g0.key !== g1.key
        ) {
            return false;
        }
    }

    return true;
}

export function getLockPos(pos: number, pinMode: number, size: number): number {
    if (pinMode === PIN_PERCENT) {
        return pos * 100 / size;
    } else {
        return pos;
    }
}

export function syncHorzCellPins(g: GridCell, width: number) {
    g.xl0 = getLockPos(g.x0, g.xp0, width);
    g.xl1 = getLockPos(g.xp1 == PIN_NONE ? g.x1 : width - g.x1, g.xp1, width);
}

export function syncVertCellPins(g: GridCell, height: number) {
    g.yl0 = getLockPos(g.y0, g.yp0, height);
    g.yl1 = getLockPos(g.yp1 == PIN_NONE ? g.y1 : height - g.y1, g.yp1, height);
}

export function syncCellPins(g: GridCell, width: number, height: number) {
    syncHorzCellPins(g, width);
    syncVertCellPins(g, height);
}

export function syncGridPins(grid: GridLayout, width: number, height: number) {
    grid.cells.forEach(g => this.syncCellPins(g, width, height));
}

function getSnapPoints(grid: GridLayout, selectedIdx: number, snapToMargins: number): SnapPoints {
    const xs = [];
    const ys = [];
    const mxs = [];
    const mys = [];

    for (let i = 0; i < grid.cells.length; i++) {
        if (i !== selectedIdx) {
            const g = grid.cells[i];
            xs.push(g.x0, g.x1);
            if (snapToMargins > 0) {
                xs.push(g.x0 - 5, g.x1);
                xs.push(g.x0, g.x1 + 5);
            }
            ys.push(g.y0, g.y1);
            if (snapToMargins > 0) {
                ys.push(g.y0 - 5, g.y1);
                ys.push(g.y0, g.y1 + 5);
            }
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

export function recalculateLayoutCell(cell: GridCell, width: number, height: number): GridCell {
    const g = {
        x0: cell.x0, xl0: cell.xl0, xp0: cell.xp0,
        y0: cell.y0, yl0: cell.yl0, yp0: cell.yp0,
        x1: cell.x1, xl1: cell.xl1, xp1: cell.xp1,
        y1: cell.y1, yl1: cell.yl1, yp1: cell.yp1,
        key: cell.key, idx: cell.idx
    };

    if (g.xp0 == PIN_PIXEL) {
        const x0 = g.x0;
        g.x0 = g.xl0;
        if (g.xp1 == PIN_NONE) {
            g.x1 += (g.x0 - x0);
            g.xl1 = g.x1;
        }
    } else if (g.xp0 == PIN_PERCENT) {
        const x0 = g.x0;
        g.x0 = width * g.xl0 / 100;
        if (g.xp1 == PIN_NONE) {
            g.x1 += (g.x0 - x0);
            g.xl1 = g.x1;
        }
    }

    if (g.yp0 == PIN_PIXEL) {
        const y0 = g.y0;
        g.y0 = g.yl0;
        if (g.yp1 == PIN_NONE) {
            g.y1 += (g.y0 - y0);
            g.yl1 = g.y1;
        }
    } else if (g.yp0 == PIN_PERCENT) {
        const y0 = g.y0;
        g.y0 = height * g.yl0 / 100;
        if (g.yp1 == PIN_NONE) {
            g.y1 += (g.y0 - y0);
            g.yl1 = g.y1;
        }
    }

    if (g.xp1 == PIN_PIXEL) {
        const x1 = g.x1;
        g.x1 = width - g.xl1;
        if (g.xp0 == PIN_NONE) {
            g.x0 += (g.x1 - x1);
            g.xl0 = g.x0;
        }
    } else if (g.xp1 == PIN_PERCENT) {
        const x1 = g.x1;
        g.x1 = width - width * g.xl1 / 100;
        if (g.xp0 == PIN_NONE) {
            g.x0 += (g.x1 - x1);
            g.xl0 = g.x0;
        }
    }

    if (g.yp1 == PIN_PIXEL) {
        const y1 = g.y1;
        g.y1 = height - g.yl1;
        if (g.yp0 == PIN_NONE) {
            g.y0 += (g.y1 - y1);
            g.yl0 = g.y0;
        }
    } else if (g.yp1 == PIN_PERCENT) {
        const y1 = g.y1;
        g.y1 = height - height * g.yl1 / 100;
        if (g.yp0 == PIN_NONE) {
            g.y0 += (g.y1 - y1);
            g.yl0 = g.y0;
        }
    }

    if (g.xp0 == PIN_NONE && g.xp1 == PIN_NONE) {
        g.x0 = g.xl0;
        g.x1 = g.xl1;
    }

    if (g.yp0 == PIN_NONE && g.yp1 == PIN_NONE) {
        g.y0 = g.yl0;
        g.y1 = g.yl1;
    }

    return g;
}

export function recalculateLayout(grid: GridLayout, width: number, height: number, snapToMargins: number): { grid: GridLayout, snapPoints: SnapPoints } {
    let nextGrid = grid;

    if (width > 0 && height > 0) {
        nextGrid.cells = grid.cells.map((cell: GridCell) => {
            return recalculateLayoutCell(cell, width, height);
        });
    }

    return {
        grid: nextGrid,
        snapPoints: getSnapPoints(nextGrid, -1, snapToMargins)
    };
}

export function getMaxElementRect(el: HTMLElement): number[] {
    const fw = el.style.width !== '100%';
    const fh = el.style.height !== '100%';

    let left = fw ? el.offsetLeft : 1000000;
    let right = fw ? el.offsetLeft + el.offsetWidth : 0;
    let top = fh ? el.offsetTop : 1000000;
    let bottom = fh ? el.offsetTop + el.offsetHeight : 0;

    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as HTMLElement;
        if (child.nodeType === 1) {
            const [nl, nr, nt, nb] = getMaxElementRect(child);
            top = Math.min(top, nt);
            bottom = Math.max(bottom, nb);
            left = Math.min(left, nl);
            right = Math.max(right, nr);
        }
    }

    return [left, right, top, bottom];
}

export function getMaxElementSize(el: HTMLElement): number[] {
    const r = el.getBoundingClientRect();

    let width = r.width;
    let height = r.height;

    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as HTMLElement;
        if (child.nodeType === 1) {
            const [nw, nh] = getMaxElementSize(child);
            width = Math.max(width, nw);
            height = Math.max(height, nh);
        }
    }

    return [width, height];
}

export function findTopAndBottomCoords(el: HTMLElement): number[] {
    const r = el.getBoundingClientRect();

    let {top, bottom} = r;

    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as HTMLElement;
        if (child.nodeType === 1) {
            const [ntop, nbottom] = findTopAndBottomCoords(child);
            top = Math.min(top, ntop);
            bottom = Math.max(bottom, nbottom);
        }
    }

    return [top, bottom];
}

export function equalChildren(children0: React.ReactElement<any>[], children1: React.ReactElement<any>[]) {
    if (children0.length !== children1.length) {
        return false;
    }

    for (let i = 0; i < children0.length; i++) {
        const c0 = children0[i];
        const c1 = children1[i];

        if (!c0.key || !c1.key) {
            return false;
        }

        if (c0.key !== c1.key) {
            return false;
        }
    }

    return true;
}

function makeScale(totalSize: number, size: number) {
    return totalSize / size;
    // return totalSize > size
    //     ? totalSize / size
    //     : size / totalSize;
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
    layout.cells.forEach((g: GridCell) => {
        s += 
            posToStr(g.x0, g.xl0, g.xp0) +
            posToStr(g.y0, g.yl0, g.yp0) +
            posToStr(g.x1, g.xl1, g.xp1) +
            posToStr(g.y1, g.yl1, g.yp1) +
            "+";
    });

    return s;
}

function strToLayout(s: string): GridLayout {
    let num = '';
    let numIdx = 0;
    let pinMode = PIN_NONE;
    let numEnd = false;
    let blockEnd = false;

    const grid: GridLayout = {
        cells: [],
        width: 0,
        height: 0
    };

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
            grid.cells.push(cell);
            cell = getInitialGridCell();
            numIdx = 0;
            blockEnd = false;
        }
    }
    return grid;
}
