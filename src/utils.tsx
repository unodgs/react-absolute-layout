import * as React from "react";
import * as ReactDOM from "react-dom";

interface LineProps {
	pos: number,
	from?: number,
	to?: number,
	color: string,
	dashed?: boolean,
	label?: string
}

export class HorzLine extends React.Component<LineProps, {}> {
	render() {
		const width = (this.props.from !== undefined && this.props.to !== undefined) ? (this.props.to - this.props.from) : '100%';
		const left = this.props.from !== undefined ? this.props.from : 0;
		return (
			<div>
				<div style={{
					height: 1,
					backgroundColor: this.props.color,
					position: 'absolute',
					width: width,
					left: left,
					top: this.props.pos,
				}}/>
				{this.props.label && <div style={{
					position: 'absolute',
					width: width,
					left: left,
					top: this.props.pos - 15,
					fontSize: 12,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}>{this.props.label}</div>}
			</div>
		)
	}
}

export class VertLine extends React.Component<LineProps, {}> {
	render() {
		const height = (this.props.from !== undefined && this.props.to !== undefined) ? (this.props.to - this.props.from) : '100%';
		const top = this.props.from !== undefined ? this.props.from : 0;
		return (
			<div>
				<div style={{
					width: 1,
					backgroundColor: this.props.color,
					position: 'absolute',
					height: height,
					top: top,
					left: this.props.pos
				}}/>
				{this.props.label && <div style={{
					position: 'absolute',
					height: height,
					left: this.props.pos + 3,
					top: top,
					fontSize: 12,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}>{this.props.label}</div>}
			</div>
		)
	}
}
