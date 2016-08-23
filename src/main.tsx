/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AbsoluteLayout } from "./absolute-layout";
                                  
class App extends React.Component<{}, {}> {
	render() {
		return <div style={{position: 'absolute', right: 50, left: '35%'}}>
			<AbsoluteLayout height={500} snapToGrid={false} editing={true}
				initialLayout="EwDgDAggzAbGByBWMJ7ACwQNToQRmAQyLAS1HznnXDV3iymAAVgZF4oB2ZqdDrEA">
				<div style={{backgroundColor: 'red'}}/>
				<div style={{backgroundColor: 'green'}}/>
				<div style={{backgroundColor: 'yellow'}}/>
				<div style={{backgroundColor: 'blue'}}/>
			</AbsoluteLayout>
		</div>
	}
}

ReactDOM.render(<App/>, document.getElementById('app'));


