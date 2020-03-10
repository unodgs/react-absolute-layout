import * as React from "react";
import * as ReactDOM from "react-dom";

import { AbsoluteLayout } from "./absolute-layout";
                                  
class App extends React.Component<{}, {}> {
	render() {
		// initialLayout="EwDgDAggzAbGByBWMJ7ACwQNToQRmAQyLAS1HznnXDV3iymAAVgZF4oB2ZqdDrEA"			
		return <div style={{position: 'absolute', right: 50, left: 30}}>
			<AbsoluteLayout height={500} snapToGrid={false} editing={true} name="test">
				<div style={{backgroundColor: 'red'}} key="red-box"/>
				<div style={{backgroundColor: 'green'}}/>
				<div style={{backgroundColor: 'yellow'}}/>
				<div style={{backgroundColor: 'blue'}}>
					<input type="text"/>
				</div>
			</AbsoluteLayout>
		</div>
	}
}

ReactDOM.render(<App/>, document.getElementById('app'));


