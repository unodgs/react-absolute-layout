/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AbsoluteLayout } from "./absolute-layout";

class App extends React.Component<{}, {}> {
	render() {
		return <div>
			<AbsoluteLayout columns={20} rows={20} width={800} height={500}>
				<div style={{backgroundColor: 'red'}}/>
				<div style={{backgroundColor: 'green'}}/>
				<div style={{backgroundColor: 'yellow'}}/>
			</AbsoluteLayout>
		</div>
	}
}

ReactDOM.render(<App/>, document.getElementById('app'));


