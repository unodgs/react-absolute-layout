/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

class App extends React.Component<{}, {}> {
	render() {
		console.log("!!");
		return <div>Hello</div>
	}
}

console.log("jol");
ReactDOM.render(<App/>, document.getElementById('app'));


