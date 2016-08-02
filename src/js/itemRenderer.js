import _ from 'lodash';
import React from 'react';
import colors from './colors';
import {SensorReading, ObjectLogger} from './itemTracker';
import {objCol, cellCol} from './hslFromArray';

function sumPairwise(a1, a2){
  return _.map(a1, (_, i) => a1[i] + a2[i]);
}

function rgbFromArray(colArray){
  return "rgb(" + colArray.join() + ")";
}

// expects Objects and index as props
class SensorCell extends React.Component {
  constructor(props) {
    super(props);
    this.displayName = 'SensorCell';
    this.getReadingColor = this.getReadingColor.bind(this);
  }

  getReadingColor(){
    var reading = this.props.readings.readings[this.props.indices[0]][this.props.indices[1]];
    var val = Math.round(reading);
    return cellCol([0, val, val, 1]);
  }

  render() {
    var bgStyle = {
      backgroundColor: this.getReadingColor()
    };
    return (<div className="sensor-cell" style={bgStyle}></div>);
  }
}

class DisplayObject extends React.Component {
  constructor(props) {
    super(props);
    this.object = this.props.object;
    this.displayName = 'DisplayObject';
  }

  render(){
    var cm = this.object.centerOfMass();
    var coords = cm.map(d => d * 35 / 11 + 'em');
    var diam = _.clamp(0.5 + this.object.spread() * 2, 2) * 35 / 11;
    var style = {
      position: "absolute",
      top: "calc(" + coords[0] + " - " + (diam / 2) + "em)",
      left: "calc(" + coords[1] + " - " + (diam / 2) + "em)",
      width: diam + 'em',
      height: diam + 'em',
      borderRadius: diam + 'em',
      backgroundColor: objCol([240, this.object.reading.weight, this.object.reading.weight, 0.7]),
    }
    return (
      <div className="grid-object" style={style}>
      </div>
    );
  }
}

// expects props height and width
class SensorGrid extends React.Component {
  constructor(props) {
    super(props);
    this.height = this.props.height;
    this.width = this.props.width;
    this.state = {
      objects: [],
      readings: SensorReading.createNewReading()
    }
    this.displayName = 'SensorGrid';
  }

  updateReading(readings, objects){
  
    this.setState({
      readings, objects
    });
  }

  cellRow(rowIndex){
    return _.times(this.width, columnIndex => 
      <SensorCell indices={[rowIndex, columnIndex]}
                  readings={this.state.readings}/>
    );
  }

  render() {
    console.log('grid state', this.state);
    var displayObjects = this.state.objects.map((o,i) => <DisplayObject 
      object={o} 
      key={o.reading.weight + o.centerOfMass()}/>);
    return (
      <div className="sensor-grid">
        {displayObjects}
        {_.times(this.height, i => this.cellRow(i))}
      </div>);
  }
}

export default SensorGrid;
