/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

import { AbsoluteLayout } from "./absolute-layout";

class App extends React.Component<{}, {}> {
	render() {
		return <div><AbsoluteLayout/></div>
	}
}

ReactDOM.render(<App/>, document.getElementById('app'));


