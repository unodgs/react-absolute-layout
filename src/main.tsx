import { AbsoluteLayout, GridLayout } from "./absolute-layout";
import React from "react";
import ReactDOM from "react-dom";

class App extends React.Component<{}, {
    layout: GridLayout
}> {
    
    constructor(props: {}) {
        super(props);
        this.state = {
            layout: []
        }
    }
    
    onUpdateLayout = (layout: GridLayout) => {
        this.setState({
            layout
        })
    }
    
    render() {
        // initialLayout="EwDgDAggzAbGByBWMJ7ACwQNToQRmAQyLAS1HznnXDV3iymAAVgZF4oB2ZqdDrEA"			
        return <div>
        
            <div style={{ width: 100, height: 70, border: "1px solid black", display: 'flex', alignItems: 'center', justifyContent: 'center'}} draggable>Drag me</div>    
            <div style={{ position: 'absolute', right: 50, left: 50, top: 150 }}>
                <AbsoluteLayout height={500} width={500} snapToGrid={true} editing={true} name="test"
                    layout={this.state.layout} onUpdateLayout={this.onUpdateLayout}
                >
                    <div style={{ backgroundColor: 'green', color: 'white' }}>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.                    </div>
                    <div style={{ backgroundColor: 'yellow' }}/>
                    <div style={{ backgroundColor: 'blue' }}>
                        <input type="text"/>
                    </div>
                </AbsoluteLayout>
            </div>
        </div>

    }
}

ReactDOM.render(<App/>, document.getElementById('app'));


