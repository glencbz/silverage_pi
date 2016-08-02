import React from 'react';
import _ from 'lodash';
import {objCol as hslFromArray} from './hslFromArray';

function latestUrl(fileName){
	return 'url(static/' + fileName + '?' + new Date().getTime() + ')';
}

class ObjectList extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			objects: []
		};
		this.displayName = 'ObjectList';
	}

	updateObjects(objects){
		this.setState({
			objects
		});
	}

	render() {
		var rows = this.state.objects.map((d) => <ObjectRow fileName={this.props.fileName} object={d} key={d.reading.weight + d.centerOfMass()}/>);
		return (
  			<ul>
  				{rows}
  			</ul>
    	);
    }
}

class ObjectRow extends React.Component {
	constructor(props) {
		super(props);
		this.displayName = 'ObjectRow';
		this.fileName = latestUrl(this.props.fileName);
	}

	render() {
		var weightColor = hslFromArray([240, this.props.object.reading.weight, this.props.object.reading.weight, .7]);
		return (
      	<li className='card object-entry'>
      		<div className='media'>
      			<figure className='media-left'>
      				<div className='object-thumb' style={{backgroundImage: this.fileName}}/>
      			</figure>
				<div className='media-content'>
					<div className='content'>
						<div className='weight-wrapper'>
							<h3 className='weight-header'>{"Weight: " + _.round(this.props.object.reading.weight, 2)}</h3>
							<div className='weight-marker' style={{backgroundColor: weightColor}}/>
						</div>
  						<p>{"Location: " + this.props.object.centerOfMass().map(d => _.round(d,2)).join()}</p>
					</div>
				</div>
				<div className='media-right'>
					<div className='delete-button'/>
				</div> 			
      		</div>
      	</li>
    	);
    }
}

export {ObjectList};
