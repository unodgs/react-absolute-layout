import React from "react";
import { HorzLine, VertLine } from "./utils";
import "./absolute-layout.css";
import { Toolbar } from "./toolbar";

type Point = {
    x: number;
    y: number;
}

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 300;

interface AbsoluteLayoutProps {
    colWidth?: number;
    rowHeight?: number;
    showGrid?: boolean;
    snapToGrid?: boolean;
    snapToMargins?: number;
    width: number;
    height: number;
    innerWidth?: number;
    innerHeight?: number
    initialLayout?: GridLayout;
    layout?: GridLayout;
    editing?: boolean;
    toolbar?: boolean;
    name?: string;
    storage?: any;
    onUpdateLayout?: (layout: GridLayout) => void;
    onSelectElement?: (idx: number) => void;
    onDrop?: (element: GridCell) => void;
    style?: React.CSSProperties;
    innerStyle?: any;
    className?: string;
    topClassName?: string;
    elementIdx?: number;
    id?: string;
    pinning?: boolean;
    newElementSize?: {
        width: number;
        height: number;
    },
    children?: React.ReactNode
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
    moving: boolean;
    resizing: boolean;
    dragging: boolean;
    dragOffset: Point | null;
    dragElement: HTMLElement | null,
    mouseStartPos: Point | null;
    mouseCurrPos: Point | null;
    elementStartPos: Point | null;
    elementEndPos: Point | null;
    elementIdx: number;
    grid: GridLayout;
    width?: number;
    height?: number;
    colWidth: number;
    rowHeight: number;
    snapPoints: SnapPoints;
    gridBar: boolean;
    editing: boolean;
}

export const PIN_NONE = 0;
export const PIN_PIXEL = 1;
export const PIN_PERCENT = 2;

export interface GridCellPos {
    // pos, pin mode, locked pos
    x0: number;
    xp0: number;
    xl0: number;
    y0: number;
    yp0: number;
    yl0: number;
    x1: number;
    xp1: number;
    xl1: number;
    y1: number;
    yp1: number;
    yl1: number;
}

export interface GridCell extends GridCellPos {
    key: string | null;
    idx: number;
}

type GridCellKey = keyof Omit<GridCell, 'key'>;

export type GridLayout = Array<GridCell>;

export class AbsoluteLayout extends React.Component<AbsoluteLayoutProps, AbsoluteLayoutState> {

    public static defaultProps: AbsoluteLayoutProps = {
        colWidth: 40,
        rowHeight: 40,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        showGrid: true,
        snapToGrid: true,
        snapToMargins: 5,
        editing: false,
        toolbar: true,
        pinning: true,
        name: "default",
        newElementSize: {
            width: 150,
            height: 50
        }
    };
    
    private gridRef: React.RefObject<HTMLDivElement>;

    constructor(props: AbsoluteLayoutProps) {
        super(props);
        
        this.gridRef = React.createRef();
        
        const colWidth = Math.max(props.colWidth ?? 0, 5);
        const rowHeight = Math.max(props.rowHeight ?? 0, 5);
        const layout = this.props.layout || this.props.initialLayout || [];

        const grid = this.syncLayoutChildren(layout, props.children);

        if (!layout) {
            this.updateLayout(grid);
        }

        this.state = {
            grid: grid,
            moving: false,
            resizing: false,
            dragging: false,
            dragOffset: null,
            dragElement: null,
            mouseStartPos: null,
            mouseCurrPos: null,
            elementStartPos: null,
            elementEndPos: null,
            elementIdx: -1,
            colWidth: colWidth,
            rowHeight: rowHeight,
            gridBar: false,
            editing: !!this.props.editing,
            snapPoints: {
                allHorizontal: [],
                allVertical: [],
                horizontal: [],
                vertical: [],
                middleHorizontal: [],
                middleVertical: []
            }
        }
    }

    syncLayoutChildren = (grid: GridLayout, children: React.ReactNode): GridLayout => {
        const newGrid: GridLayout = []
        React.Children.forEach(children, (child: any, i) => {
            const key = (child && child.key ? child.key : i).toString();
            const g = grid.find(g => g.key === key);
            const ng = getInitialGridCell(0, 0, 100, 100);
            if (g) {
                ng.x0 = g.x0;
                ng.xp0 = g.xp0;
                ng.xl0 = g.xl0;
                ng.y0 = g.y0;
                ng.yp0 = g.yp0;
                ng.yl0 = g.yl0;
                ng.x1 = g.x1;
                ng.xp1 = g.xp1;
                ng.xl1 = g.xl1;
                ng.y1 = g.y1;
                ng.yp1 = g.yp1;
                ng.yl1 = g.yl1;
            }
            ng.key = key;
            ng.idx = i;
            newGrid.push(ng);
        });
        return newGrid;
    };

    syncGridLayout = (layout: GridLayout | null, width: number, height: number) => {
        if (layout) {
            const {grid, snapPoints} = recalculateLayout(layout, width, height, this.props.snapToMargins!);
            this.setState({
                grid, snapPoints
            }, () => this.updateLayout(grid));
        }
    };

    componentDidMount() {
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove, { capture: true });
        document.addEventListener('mouseup', this.onMouseUp);
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
    
    componentWillReceiveProps(props: AbsoluteLayoutProps) {
        let grid = props.layout;
        if (!this.state.dragging) {
            if (!equalChildren(props.children as any, this.props.children as any)) {
                console.log("!equal children");
                if (this.state.elementIdx > grid!.length - 1) {
                    this.clearSelectedElement();
                }
                grid = this.syncLayoutChildren(grid!, props.children as React.ReactChild[]);
            }

            if (!equalLayout(grid!, this.state.grid)) {
                console.log("!equal layout")
                this.syncGridLayout(grid!, this.getWidth(), this.getHeight());
            }
        }
    }

    clearSelectedElement = () => {
        this.setState({
            elementIdx: -1,
            elementStartPos: null,
            elementEndPos: null
        }, () => this.onSelectElement(-1));
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
            snapPoints: getSnapPoints(this.state.grid, idx, this.props.snapToMargins!)
        }, () => this.onSelectElement(idx));
    };

    onSelectElement = (idx: number) => {
        if (this.props.onSelectElement) {
            this.props.onSelectElement(idx);
        }
    };

    getDraggableElement(el: Node | null): HTMLElement | null {
        let n = 0;
        while (el && n < 3) {
            if ((el as HTMLElement)?.draggable) {
                return (el as HTMLElement);
            }
            el = el?.parentNode;
            n = n + 1;
        }
        return null;
    }
    
    onMouseDown = (e: MouseEvent) => {
        const el = this.getDraggableElement(e.target as Node);
        if (el) {
            const r = el.getBoundingClientRect();
            this.setState({
                dragElement: el,
                dragOffset: {
                    x: e.clientX - r.x,
                    y: e.clientY - r.y
                },
            });
        }
        this.mouseDown(e.clientX, e.clientY);
    };

    mouseDown = (clientX: number, clientY: number) => {
        if (this.state.elementIdx >= 0) {
            this.setState({
                mouseStartPos: {x: clientX, y: clientY},
                mouseCurrPos: {x: clientX, y: clientY},
            });
        }
    };

    onMouseMove = (e: MouseEvent) => {
        this.mouseMove(e.clientX, e.clientY);
    };

    mouseMove = (clientX: number, clientY: number) => {
        if (this.state.mouseCurrPos?.x === clientX &&
            this.state.mouseCurrPos?.y === clientY) {
            return;
        }
        const dx = this.state.mouseStartPos ? clientX - this.state.mouseStartPos.x : 0;
        const dy = this.state.mouseStartPos ? clientY - this.state.mouseStartPos.y : 0;

        const idx = this.state.elementIdx;
        const grid = this.state.grid;
        const gi = grid[idx];
        const snapPoints = this.state.snapPoints;

        const colWidth = this.props.snapToGrid ? this.state.colWidth : 0;
        const rowHeight = this.props.snapToGrid ? this.state.rowHeight : 0;

        if (this.state.moving && !this.state.resizing) {
            const gx0 = this.state.elementStartPos!.x + dx;
            const gx1 = this.state.elementEndPos!.x + dx;

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

            const gy0 = this.state.elementStartPos!.y + dy;
            const gy1 = this.state.elementEndPos!.y + dy;

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
            const gx1 = this.state.elementEndPos!.x + dx;
            const gy1 = this.state.elementEndPos!.y + dy;

            const fx = snapToGrid(gx1, snapPoints.allVertical, colWidth);
            const fy = snapToGrid(gy1, snapPoints.allHorizontal, rowHeight);

            gi.x1 = Math.max(gi.x0, fx.pos);
            gi.y1 = Math.max(gi.y0, fy.pos);
        }

        if (this.state.resizing || this.state.moving) {
            syncCellPins(gi, this.getWidth(), this.getHeight());
            this.setState({
                mouseCurrPos: {x: clientX, y: clientY},
                grid: grid
            });
        }
    }

    onMouseUp = (e: MouseEvent) => {
        this.mouseUp();
    };

    mouseUp = () => {
        if (this.state.moving || this.state.resizing) {
            const snapPoints = getSnapPoints(this.state.grid, -1, this.props.snapToMargins!);
            this.setState({
                mouseStartPos: null,
                mouseCurrPos: null,
                elementStartPos: null,
                elementEndPos: null,
                moving: false,
                resizing: false,
                snapPoints: snapPoints
            }, () => {
                this.updateLayout(this.state.grid);
            });
        }
    }

    onDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.state.dragging) {
            const clientX = e.clientX;
            const clientY = e.clientY;
            let cell: GridCell = getInitialGridCell(
                clientX, clientY,
                this.props.newElementSize?.width,
                this.props.newElementSize?.height
            );
            const grid = this.state.grid;
            const idx = grid.length;
            cell.idx = idx;
            cell.key = idx.toString();
            grid.push(cell);
            const gridEl = this.gridRef.current;
            if (gridEl) {
                const gr = gridEl.getBoundingClientRect();
                this.selectElement(idx,
                    clientX - gr.x + gridEl.scrollLeft - (this.state.dragOffset?.x ?? 0) + 10,
                    clientY - gr.y + gridEl.scrollTop - (this.state.dragOffset?.y ?? 0) + 10,
                    this.props.newElementSize!.width,
                    this.props.newElementSize!.height
                );
                this.setState({
                    elementIdx: idx,
                    dragging: true,
                    moving: true,
                    resizing: false,
                    grid
                }, () => {
                    this.mouseDown(clientX, clientY);
                });
            }
        }
    }

    onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }

    onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.state.dragging) {
            this.mouseMove(e.clientX, e.clientY);
        }
    }

    onDrop = (e: React.DragEvent) => {
        if (this.state.dragging) {
            this.setState({
                dragging: false
            });
            if (this.props.onDrop) {
                this.props.onDrop(this.state.grid[this.state.elementIdx]);
            }
            this.mouseUp();
        }
    }

    togglePinMode = (key: GridCellKey, totalSize: number) => {
        if (this.props.pinning) {
            const grid = this.state.grid;
            const idx = this.state.elementIdx;
            const g = grid[idx];
            const lockKey = (key[0] + 'l' + key[2]) as GridCellKey;
            const posKey = (key[0] + key[2]) as GridCellKey;
            let pinMode = g[key];

            pinMode += 1;
            if (pinMode > 2)
                pinMode = 0;

            if (pinMode === PIN_PERCENT || pinMode === PIN_PIXEL) {
                const pos = key[2] == '0' ? g[posKey] : totalSize - (g[posKey]);
                grid[idx][lockKey] = getLockPos(pos, pinMode, totalSize);
            } else if (pinMode === PIN_NONE) {
                grid[idx][lockKey] = g[posKey];
            }

            grid[idx][key] = pinMode;

            this.syncGridLayout(grid, this.getWidth(), this.getHeight());
        }
    };

    getHighlightColor(pinMode: number): string | undefined {
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

    startResizing = (e: React.MouseEvent) => {
        this.setState({
            resizing: true,
            moving: false
        });
        this.onSelectElement(this.state.elementIdx);
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

    updateLayout = (grid: GridLayout) => {
        if (this.props.onUpdateLayout) {
            this.props.onUpdateLayout(grid);
        }
    };
    
    isMoving = () => {
        return this.state.dragging || this.state.moving || this.state.resizing    
    }
    
    getWidth = () => this.props.innerWidth ?? this.props.width;
    getHeight = () => this.props.innerHeight ?? this.props.height;

    render() {
        const width = this.getWidth();
        const height = this.getHeight();
        
        const grid = this.state.grid;
        const elementIdx = this.state.elementIdx;
        const g = elementIdx >= 0 ? grid[elementIdx] : null;
        const axis = [];

        if (this.state.editing && g) {
            axis.push(
                <HorzLine
                    key="axis-x-left"
                    onClick={() => this.togglePinMode('xp0', width)}
                    size={5}
                    pos={(g.y0 + g.y1) / 2}
                    label={this.getPosLabel(g.x0, g.xl0, g.xp0)}
                    from={0}
                    to={g.x0}
                    highlightColor={this.getHighlightColor(g.xp0)}
                    disabled={this.props.pinning === false}
                    onTop={true}/>,
                <HorzLine
                    key="axis-x-right"
                    onClick={() => this.togglePinMode('xp1', width)}
                    size={5}
                    pos={(g.y0 + g.y1) / 2}
                    label={this.getPosLabel(width - g.x1, g.xl1, g.xp1)}
                    from={g.x1}
                    to={width}
                    highlightColor={this.getHighlightColor(g.xp1)}
                    disabled={this.props.pinning === false}
                    onTop={true}/>,
                <VertLine
                    key="axis-y-top"
                    onClick={() => this.togglePinMode('yp0', height)}
                    size={5}
                    pos={(g.x0 + g.x1) / 2}
                    label={this.getPosLabel(g.y0, g.yl0, g.yp0)}
                    from={0}
                    to={g.y0}
                    highlightColor={this.getHighlightColor(g.yp0)}
                    disabled={this.props.pinning === false}
                    onTop={true}/>,
                <VertLine
                    key="axis-y-bottom"
                    onClick={() => this.togglePinMode('yp1', height)}
                    size={5}
                    pos={(g.x0 + g.x1) / 2}
                    label={this.getPosLabel(height - g.y1, g.yl1, g.yp1)}
                    from={g.y1}
                    to={height}
                    highlightColor={this.getHighlightColor(g.yp1)}
                    disabled={this.props.pinning === false}
                    onTop={true}/>
            );
        }

        let colLines = [];
        let rowLines = [];
        
        let gridStyle = {} as React.CSSProperties;

        if (this.props.showGrid) {
            gridStyle.backgroundImage = "repeating-linear-gradient(#eeeeee 0 1px, transparent 1px 100%)," +
                "repeating-linear-gradient(90deg, #eeeeee 0 1px, transparent 1px 100%)";
            gridStyle.backgroundPosition = "-1px -1px";
            gridStyle.backgroundSize = `${this.state.colWidth}px ${this.state.rowHeight}px`;
        }

        let elements = null;

        const children = React.Children.toArray(this.props.children);

        if (this.state.editing) {
            elements = this.state.grid.map((g: GridCell, idx: number) => {
                const zIndex = idx === elementIdx ? 10000 : 'auto';
                
                const posStyle: React.CSSProperties = {
                    position: 'absolute',
                    zIndex: zIndex,
                    left: `${g.x0}px`,
                    top: `${g.y0}px`,
                    width: `${g.x1 - g.x0}px`,
                    height: `${g.y1 - g.y0}px`
                };

                const gel: React.ReactElement = children && children[g.idx]
                    ? children[g.idx] as React.ReactElement
                    : React.createElement("div", { style: { backgroundColor: 'lightcoral'} });

                if (gel) {
                    const gelProps = gel.props;
                    let style: React.CSSProperties = {
                        ...posStyle,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        // pointerEvents: 'none',//this.state.dragging ? 'none' : 'auto',
                        opacity: idx === elementIdx && (this.state.moving || this.state.resizing) ? 0.8 : 1
                    };

                    const props = {
                        key: `cell/${g.idx}`,
                        style: style,
                        className: (gelProps.className ?? '') + ' al-grid-item',
                        onMouseDown: (e: React.MouseEvent<any>) => {
                            e.stopPropagation();
                            let t = e.currentTarget as HTMLElement;
                            this.selectElement(idx, t.offsetLeft, t.offsetTop, t.offsetWidth, t.offsetHeight);
                            this.setState({
                                elementIdx: idx,
                                moving: true
                            }, () => {
                                this.mouseDown(e.clientX, e.clientY);
                            });
                        }
                    };

                    const elPosStyle: React.CSSProperties = {
                        position: 'absolute',
                        boxSizing: 'border-box',
                        left: 0,
                        top: 0,
                        width: `${g.x1 - g.x0}px`,
                        height: `${g.y1 - g.y0}px`,
                    };

                    const el = React.cloneElement(gel, {
                        ...gelProps,
                        key: `cell-content/${g.key}`,
                        style: { ...gelProps.style, ...elPosStyle }
                    });

                    const grabRect =
                        <div {...props}>
                            {elementIdx == idx &&
                            <div style={{
                                position: 'absolute',
                                left: 5, top: 5, padding: 2,
                                fontSize: 12,
                                zIndex: zIndex,
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                color: 'white'
                            }}>
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
                            <div onMouseDown={this.startResizing} style={{
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
                            <div style={{pointerEvents: 'none'}}>
                                {el}
                            </div>
                        </div>
                    ;
                    return grabRect;
                } else {
                    return null;
                }
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

                const gel = children ? children[g.idx] as React.ReactElement : null;
                if (gel) {
                    const gelProps = gel.props as any;
                    const props = {
                        key: `cell/${idx}`,
                        className: gelProps.className + ' al-grid-item',
                        style: {...style, ...(gelProps ? gelProps.style : {})}
                    };
                    return React.cloneElement(gel, props, gel.props.children);
                } else {
                    return null;
                }
            });
        }

        if (this.state.moving || this.state.resizing) {
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
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }

            if (fx1.snapPoint >= 0) {
                colLines.push(
                    <VertLine
                        key={`column-snap-vert-line-1`}
                        pos={fx1.pos}
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }

            if (fx2.snapPoint >= 0) {
                colLines.push(
                    <VertLine
                        key={`column-snap-vert-line-2`}
                        pos={fx2.pos}
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }

            if (fy0.snapPoint >= 0) {
                rowLines.push(
                    <HorzLine
                        key={`column-snap-horz-line-0`}
                        pos={fy0.pos}
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }

            if (fy1.snapPoint >= 0) {
                rowLines.push(
                    <HorzLine
                        key={`column-snap-horz-line-1`}
                        pos={fy1.pos}
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }

            if (fy2.snapPoint >= 0) {
                rowLines.push(
                    <HorzLine
                        key={`column-snap-horz-line-2`}
                        pos={fy2.pos}
                        color="rgba(255, 0, 0, 0.17)"
                        disabled={true}
                    />
                );
            }
        }

        return <div ref={this.gridRef} className={this.props.className} style={{
            width: this.props.width,
            height: this.props.height,
            position: 'relative',
            boxSizing: 'border-box',
            overflow: 'auto',
            border: this.props.editing ? '1px solid #eeeeee' : 'none',
            ...this.props.style
        }} onMouseDown={this.clearSelectedElement}>
            <div className={"inner-grid" + (this.isMoving() ? " inner-grid-moving" : "")} style={{
                ...gridStyle,
                ...this.props.style,
                minWidth: this.props.innerWidth ? 'auto' : 'min-content',
                minHeight: this.props.innerHeight ? 'auto' : 'min-content',
                width: this.props.innerWidth ? this.props.innerWidth : '100%',
                height: this.props.innerHeight ? this.props.innerHeight : '100%'
            }}
                onDragEnter={this.onDragEnter}
                onDragLeave={this.onDragLeave}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
            >
                {colLines}
                {rowLines}
                {elements}
                {axis}
                <Toolbar
                    width={this.getWidth()}
                    height={this.getHeight()}
                    editing={this.state.editing}
                    toggleEditing={this.toggleEditing}
                    elementIdx={this.state.elementIdx}
                    layout={this.state.grid}
                    hideBar={this.hideGridBar}
                    showBar={this.showGridBar}
                    show={!!this.props.editing && !!this.props.toolbar}
                />
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

    let outPos = {pos: pos, snapPoint: -1, snapped: false};

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

export function getInitialGridCell(x0: number, y0: number, w: number = 0, h: number = 0): GridCell {
    return {
        x0: x0, xp0: PIN_NONE, xl0: x0,
        y0: y0, yp0: PIN_NONE, yl0: y0,
        x1: x0 + w, xp1: PIN_NONE, xl1: x0 + w,
        y1: y0 + h, yp1: PIN_NONE, yl1: y0 + h,
        key: null,
        idx: -1
    }
}

export function equalCellPos(c0: GridCellPos, c1: GridCellPos): boolean {
    return (
        eqf(c0.x0, c1.x0) && eqf(c0.xl0, c1.xl0) && c0.xp0 === c1.xp0 &&
        eqf(c0.x1, c1.x1) && eqf(c0.xl1, c1.xl1) && c0.xp1 === c1.xp1 &&
        eqf(c0.y0, c1.y0) && eqf(c0.yl0, c1.yl0) && c0.yp0 === c1.yp0 &&
        eqf(c0.y1, c1.y1) && eqf(c0.yl1, c1.yl1) && c0.yp1 === c1.yp1
    )
}

export function equalLayout(grid0: GridLayout, grid1: GridLayout): boolean {
    if (!grid0)
        return false;

    if (!grid1)
        return false;

    if (grid0.length !== grid1.length) {
        return false;
    }

    for (let i = 0; i < grid0.length; i++) {
        const g0 = grid0[i];
        const g1 = grid1[i];

        if (g0.key !== g1.key || !equalCellPos(g0, g1)) {
            console.log(`Different ${g0.key} ${g1.key}`);
            return false;
        }
    }

    return true;
}

function eqf(a: number, b: number): boolean {
    return Math.abs(a - b) < 1.0e-05;
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
    grid.forEach(g => syncCellPins(g, width, height));
}

function getSnapPoints(grid: GridLayout, selectedIdx: number, snapToMargins: number): SnapPoints {
    const xs = [];
    const ys = [];
    const mxs = [];
    const mys = [];

    for (let i = 0; i < grid.length; i++) {
        if (i !== selectedIdx) {
            const g = grid[i];
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
        nextGrid = grid.map((cell: GridCell) => {
            return recalculateLayoutCell(cell, width, height);
        });
    }

    return {
        grid: nextGrid,
        snapPoints: getSnapPoints(nextGrid, -1, snapToMargins)
    };
}

export function equalChildren(children0: React.ReactElement[], children1: React.ReactElement[]) {
    if (children0.length !== children1.length) {
        return false;
    }

    for (let i = 0; i < children0.length; i++) {
        const c0 = children0[i];
        const c1 = children1[i];

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

