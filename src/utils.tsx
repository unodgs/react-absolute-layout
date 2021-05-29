import React, { useRef, useState } from "react";

interface LineProps {
    pos: number;
    from?: number;
    to?: number;
    highlightColor?: string;
    color?: string;
    dashed?: boolean;
    label?: string;
    onTop?: boolean;
    size?: number;
    disabled?: boolean;
    onClick?: () => void;
}

export const HorzLine = ({ color = "black", ...props }: LineProps) => {

    const [highlighted, setHighlighted] = useState(false);

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (props.onClick) {
            props.onClick();
        }
    };

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    const width = (props.from !== undefined && props.to !== undefined)
        ? Math.max(0, props.to - props.from)
        : 0;
    const left = props.from !== undefined ? props.from : 0;
    const zIndex = props.onTop ? 1000 : undefined;
    const size = props.size || 1;

    return (
        <div className="horz-line"
            style={{ pointerEvents: props.disabled ? 'none' : 'auto' }}
            onMouseDown={onMouseDown}>
            <div style={{
                width: width,
                backgroundColor: getBackgroundColor(highlighted, props.highlightColor),
                height: size,
                position: 'absolute',
                top: props.pos - size / 2,
                left: left,
                zIndex: zIndex ? zIndex + 1 : undefined
            }}
                onMouseEnter={() => setHighlighted(true)}
                onMouseLeave={() => setHighlighted(false)}
                onClick={onClick}>
                <div style={{
                    height: 1,
                    backgroundColor: color,
                    position: 'absolute',
                    width: width,
                    left: 0,
                    top: Math.floor(size / 2),
                }}/>
            </div>
            {props.label && <div style={{
                position: 'absolute',
                width: width,
                left: left,
                top: props.pos - size / 2 - 15,
                zIndex: zIndex,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>{props.label}</div>}
        </div>
    )
}

export const VertLine = ({ color = "black", ...props }: LineProps) => {

    const [highlighted, setHighlighted] = useState(false);

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (props.onClick) {
            props.onClick();
        }
    };

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    const height = (props.from !== undefined && props.to !== undefined)
        ? Math.max(0, props.to - props.from)
        : '100%';
    const top = props.from !== undefined ? props.from : 0;
    const zIndex = props.onTop ? 1000 : undefined;
    const size = props.size || 1;

    return (
        <div className="vert-line"
            style={{ pointerEvents: props.disabled ? 'none' : 'auto' }}
            onMouseDown={onMouseDown}>
            <div style={{
                width: size,
                backgroundColor: getBackgroundColor(highlighted, props.highlightColor),
                position: 'absolute',
                height: height,
                top: top,
                left: props.pos - size / 2,
                zIndex: zIndex ? zIndex + 1 : undefined
            }}
                onMouseEnter={() => setHighlighted(true)}
                onMouseLeave={() => setHighlighted(false)}
                onClick={onClick}>
                <div style={{
                    width: 1,
                    backgroundColor: color,
                    position: 'absolute',
                    height: height,
                    top: 0,
                    left: Math.floor(size / 2)
                }}/>
            </div>
            {props.label && <div style={{
                position: 'absolute',
                height: height,
                top: top,
                left: props.pos - size / 2 + 5,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>{props.label}</div>}
        </div>
    )
}

function getBackgroundColor(highlighted: boolean, color?: string): string {
    if (color) {
        return color;
    } else if (highlighted) {
        return 'rgba(0, 0, 0, 0.1)';
    } else {
        return 'rgba(0, 0, 0, 0)';
    }
}

interface SwitchProps {
    round: boolean;
    onChange?: (value: boolean) => void;
    checked: boolean;
}

export const Switch = ({ round, onChange, checked }: SwitchProps) => {
    const switchRef = useRef<HTMLDivElement>(null);

    const toggleSwitch = () => {
        if (switchRef.current) {
            const cl = switchRef.current.classList;
            if (cl.contains("on")) {
                cl.remove("on");
                cl.add("off");
                if (onChange) {
                    onChange(false);
                }
            } else {
                cl.remove("off");
                cl.add("on");
                if (onChange) {
                    onChange(true);
                }
            }
        }
    };

    const value = checked ? " on" : " off";
    return round
        ?
        <div ref={switchRef} className={"switch round" + value} onClick={toggleSwitch}>
            <div className="toggle"/>
        </div>
        :
        <div ref={switchRef} className={"switch" + value} onClick={toggleSwitch}>
            <div className="toggle"/>
            <span className="on">ON</span>
            <span className="off">OFF</span>
        </div>
        ;
}
