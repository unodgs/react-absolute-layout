/// <reference path="../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";

class App extends React.Component<{}, {}> {
	render() {
		return <div>Hello</div>
	}
}

ReactDOM.render(<App/>, document.getElementById('app'));


