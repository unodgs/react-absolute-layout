import * as React from "react";
import * as ReactDOM from "react-dom";

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
	}

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

	onClick = () => {
		if (this.props.onClick) {
			this.props.onClick();
		}
	}

	render() {
		const width = (this.props.from !== undefined && this.props.to !== undefined) ? (this.props.to - this.props.from) : '100%';
		const left = this.props.from !== undefined ? this.props.from : 0;
		const zIndex = this.props.onTop ? '1000' : 'auto';
		const size = this.props.size || 1;

		return (
			<div style={{
				width: width,
				backgroundColor: getBackgroundColor(this.state.highlighted, this.props.highlightColor),
				height: size,
				position: 'absolute',
				top: this.props.pos - size / 2,
				left: left,
				zIndex: zIndex
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
					top: size / 2,
				}}/>
				{this.props.label && <div style={{
					position: 'absolute',
					width: width,
					left: 0,
					top: -(size / 2 + 12),
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
	}

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

	onClick = () => {
		if (this.props.onClick) {
			this.props.onClick();
		}
	}

	render() {
		const height = (this.props.from !== undefined && this.props.to !== undefined) ? (this.props.to - this.props.from) : '100%';
		const top = this.props.from !== undefined ? this.props.from : 0;
		const zIndex = this.props.onTop ? '1000' : 'auto';
		const size = this.props.size || 1;

		return (
			<div style={{
				width: size,
				backgroundColor: getBackgroundColor(this.state.highlighted, this.props.highlightColor),
				position: 'absolute',
				height: height,
				top: top,
				left: this.props.pos - size / 2,
				zIndex: zIndex					
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
					left: size / 2
				}}/>
				{this.props.label && <div style={{
					position: 'absolute',
					height: height,
					left: size,
					top: 0,
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
	if (highlighted) {
		return 'rgba(0, 0, 0, 0.1)'; 
	} else if (color) {
		return color;
	} else { 
		return 'rgba(0, 0, 0, 0)';
	}
}
