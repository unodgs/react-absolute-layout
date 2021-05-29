import { Switch } from "./utils";
import * as LZString from "lz-string";
import React, { useRef } from "react";
import { layoutToStr } from "./export";
import { GridLayout } from "./absolute-layout";
import ClipboardJS from "clipboard";

interface ToolbarProps {
    elementIdx: number;
    show: boolean;
    editing: boolean;
    width: number;
    height: number;
    showBar: () => void;
    hideBar: () => void;
    toggleEditing: (enable: boolean) => void;
    layout: GridLayout;
}

export const Toolbar = ({ elementIdx, width, height, showBar, hideBar, toggleEditing, layout, show, editing } : ToolbarProps) => {
    let info = `GRID: [${Math.round(width)}, ${Math.round(height)}]`;
    if (elementIdx >= 0) {
        const g = layout[elementIdx];
        const elementKey = g.key || 'NO-KEY';
        const x = Math.round(g.x0);
        const y = Math.round(g.y0);
        const w = Math.round(g.x1 - g.x0);
        const h = Math.round(g.y1 - g.y0);
        const elementSize = `[${x}, ${y}, ${w}, ${h}]`;
        info += ` | BOX ${elementIdx} (${elementKey}): ${elementSize}`;
    }
    
    const copyLayoutRef = useRef(null);
    const clipboard = useRef<ClipboardJS>();
    
    React.useEffect(() => {
        if (copyLayoutRef.current) {
            clipboard.current = new ClipboardJS(copyLayoutRef.current!);
        }
        return () => {
            clipboard.current?.destroy();
        };
    }, [copyLayoutRef.current]);

    return <div>
        <div className="grid-bar-toggle" style={{
            position: 'absolute',
            backgroundColor: 'transparent',
            top: 0,
            zIndex: 10002,
            height: 5,
            width: '100%'
        }} onMouseEnter={showBar}/>
        <div className="grid-bar" style={{
            backgroundColor: 'rgba(255, 0, 0, 0.5)',
            top: show ? 0 : -30,
            height: 30,
            width: '100%',
            position: 'absolute',
            overflow: 'hidden',
            zIndex: 10001,
            transition: 'all 0.15s ease-in-out'
        }} onMouseLeave={hideBar}>
            <div style={{
                position: 'absolute',
                top: 5,
                left: 3
            }}>
                <Switch round={true} onChange={toggleEditing} checked={editing}/>
            </div>
            <div style={{
                position: 'absolute',
                right: 3,
                top: 5
            }}>
                <div
                    ref={copyLayoutRef}
                    className="copy-button round"
                    data-clipboard-text={LZString.compressToBase64(layoutToStr(layout))}>
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