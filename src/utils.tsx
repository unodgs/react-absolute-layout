import * as React from "react";
import * as ReactDOM from "react-dom";

export const HorzLine = (props: { pos: number, color: string, dashed?: boolean }) =>
	<div style={{
		height: 1,
		backgroundColor: props.color,
		position: 'absolute',
		width: '100%',
		top: props.pos,
		left: 0		
	}}/>;

export const VertLine = (props: { pos: number, color: string, dashed?: boolean }) =>
	<div style={{
		width: 1,
		backgroundColor: props.color,
		position: 'absolute',
		height: '100%',
		top: 0,
		left: props.pos
	}}/>;