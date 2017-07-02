import * as React from "react";

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
	onClick?: () => void;
}

interface LineState {
	highlighted: boolean;
}

export class HorzLine extends React.Component<LineProps, LineState> {
	static defaultProps = {
		color: 'black'
    };

	constructor(props: LineProps) {
		super(props);
		this.state = {
			highlighted: false
		};
	}
	
	highlightLine(b: boolean) {
		this.setState({
			highlighted: b
		});
	}

    onClick = (e) => {
        e.stopPropagation();
		if (this.props.onClick) {
			this.props.onClick();
		}
    };

    onMouseDown = (e) => {
        e.stopPropagation();
    };

	render() {
        const width = (this.props.from !== undefined && this.props.to !== undefined)
			? Math.max(0, this.props.to - this.props.from)
			: '100%';
		const left = this.props.from !== undefined ? this.props.from : 0;
        const zIndex = this.props.onTop ? 1000 : undefined;
		const size = this.props.size || 1;

		return (
            <div className="horz-line" onMouseDown={this.onMouseDown}>
				<div style={{
					width: width,
					backgroundColor: getBackgroundColor(this.state.highlighted, this.props.highlightColor),
					height: size,
					position: 'absolute',
					top: this.props.pos - size / 2,
					left: left,
					zIndex: zIndex ? zIndex + 1 : undefined
					}}
					onMouseEnter={() => this.highlightLine(true)}
					onMouseLeave={() => this.highlightLine(false)}
					onClick={this.onClick}>
					<div style={{
						height: 1,
						backgroundColor: this.props.color,
						position: 'absolute',
						width: width,
						left: 0,
						top: Math.floor(size / 2),
					}}/>
				</div>
				{this.props.label && <div style={{
					position: 'absolute',
					width: width,
					left: left,
					top: this.props.pos - size / 2 - 15,
					zIndex: zIndex,
					fontSize: 12,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}>{this.props.label}</div>}
			</div>
		)
	}
}

export class VertLine extends React.Component<LineProps, LineState> {
	static defaultProps = {
		color: 'black'
    };

	constructor(props: LineProps) {
		super(props);
		this.state = {
			highlighted: false
		};
	}
	
	highlightLine(b: boolean) {
		this.setState({
			highlighted: b
		});
	}

    onClick = (e) => {
        e.stopPropagation();
		if (this.props.onClick) {
			this.props.onClick();
		}
    };

    onMouseDown = (e) => {
        e.stopPropagation();
    };
	
	render() {
        const height = (this.props.from !== undefined && this.props.to !== undefined)
			? Math.max(0, this.props.to - this.props.from)
			: '100%';
		const top = this.props.from !== undefined ? this.props.from : 0;
        const zIndex = this.props.onTop ? 1000 : undefined;
		const size = this.props.size || 1;

		return (
            <div className="vert-line" onMouseDown={this.onMouseDown}>
				<div style={{
					width: size,
					backgroundColor: getBackgroundColor(this.state.highlighted, this.props.highlightColor),
					position: 'absolute',
					height: height,
					top: top,
					left: this.props.pos - size / 2,
					zIndex: zIndex ? zIndex + 1 : undefined
					}}
					onMouseEnter={() => this.highlightLine(true)}
					onMouseLeave={() => this.highlightLine(false)}
					onClick={this.onClick}>
					<div style={{
						width: 1,
						backgroundColor: this.props.color,
						position: 'absolute',
						height: height,
						top: 0,
						left: Math.floor(size / 2)
					}}/>
				</div>
				{this.props.label && <div style={{
					position: 'absolute',
					height: height,
					top: top,
					left: this.props.pos - size / 2 + 5,
					fontSize: 12,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}>{this.props.label}</div>}
			</div>
		)
	}
}

function getBackgroundColor(highlighted: boolean, color: string): string {
	if (color) {
		return color;
	} else if (highlighted) {
		return 'rgba(0, 0, 0, 0.1)';
	} else { 
		return 'rgba(0, 0, 0, 0)';
	}
}

export class Switch extends React.Component<{ round: boolean, onChange?: (boolean) => void }, any> {
	toggleSwitch = () => {
		const cl = (this.refs['switch'] as HTMLElement).classList;
		if (cl.contains("on")) {
			cl.remove("on");
			cl.add("off");
			if (this.props.onChange) {
				this.props.onChange(false);
			}
		} else {
			cl.remove("off");
			cl.add("on");
			if (this.props.onChange) {
				this.props.onChange(true);
			}
		}
    };

	render() {
		return this.props.round
			?
			<div ref="switch" className="switch round off" onClick={this.toggleSwitch}>
				<div className="toggle"></div>
			</div>
			:
			<div ref="switch" className="switch off" onClick={this.toggleSwitch}>
				<div className="toggle"></div>
				<span className="on">ON</span>
				<span className="off">OFF</span>
			</div>
			;
	}
}
