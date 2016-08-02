/*
Item tracking pseudocode:

1. Maintain a steady-state reading by averaging over previous cycles

2. Diff new reading with avg, if new reading < THRESHOLD, Update average by 
avg = (avg + newVal) * (n)/(n-1)

3. Else, if reading >= threshold, begin tracking new steady-state for x cycles

4. After x cycles, diff original state with new state to obtain readings specific to object

*/

import _ from 'lodash';
import Heap from 'heap';
import {sensorDims as sd} from './sensorDims';

const sensorDims = [sd.height, sd.width];

function timeQueue(){
  return new Heap((a,b) =>{
    a.timeStamp - b.timeStamp;
  });
} 

function indOfMin(array){
  var min = array[0];
  var indMin = 0;

  for (var i = 1; i < array.length; i++)
    if (array[i] < min){
      min = array[i];
      indMin = i;
    }

  return indMin;
}

function heapRange(max){
  var h = new Heap()
  _.forEach(_.range(max), d => h.push(d))
  return h;
}

class LogObject{
  static sqEuDist(xy1, xy2){
    return Math.pow(xy1[0] - xy2[0], 2) + Math.pow(xy1[1] - xy2[1], 2);
  }

  constructor(reading){
    this.reading = reading,
    this.timeStamp = new Date();
  }

  centerOfMass(){
    if (this.cm)
      return this.cm;

    var coordAcc = [0,0];
    for (var i = 0; i < this.reading.readings.length; i++){
      for (var j = 0; j < this.reading.readings[i].length; j++){
        coordAcc[0] += this.reading.readings[i][j] * (i + .5);
        coordAcc[1] += this.reading.readings[i][j] * (j + .5);
      }
    }

    this.cm = coordAcc.map(d => d / this.reading.weight);
    return this.cm;
  }

  spread(){
    if (this.sp)
      return this.sp;
    var cm = this.centerOfMass();
    var spread = 0;
    for (var i = 0; i < this.reading.readings.length; i++){
      for (var j = 0; j < this.reading.readings[i].length; j++){
        spread += Math.abs(this.reading.readings[i][j]) * LogObject.sqEuDist([i + 0.5, j + 0.5], cm);
      }
    }
    spread /= this.reading.weight;
    this.sp = Math.pow(spread, 0.5);
    return this.sp;
  }
}

var errorCount = 0;
class SensorReading{
  static createNewReading(){
    return new SensorReading(SensorReading.createNewReadingArray());
  }

  static createNewReadingArray(){
    return _.chunk(_.times(sensorDims[0] * sensorDims[1], _.constant(0)), sensorDims[1]);
  }

  constructor(readings){
    if (!readings)
      this.readings = SensorReading.createNewReadingArray();
    else
      this.readings = readings;
    [this.weight, this.max] = this.sumOverSelf();
  }  

  averageNewReading(newReading, timeStep){
    var denom = 1 / (timeStep + 1);
    var newAvg = SensorReading.createNewReadingArray();
    for (var i = 0; i < sensorDims[0]; i ++)
      for (var j = 0; j < sensorDims[1]; j++)
        newAvg[i][j] = denom * (newReading.readings[i][j] + timeStep * this.readings[i][j]);
    return new SensorReading(newAvg);
  }

  diffReading(otherReading, clamp){
    var diff = SensorReading.createNewReadingArray();
    for (var i = 0; i < sensorDims[0]; i ++){
      for (var j = 0; j < sensorDims[1]; j++){
        var cellDiff = this.readings[i][j] - otherReading.readings[i][j];
        diff[i][j] = clamp ? _.clamp(cellDiff, 0, 255): cellDiff;
      }
    }
    return new SensorReading(diff);
  }

  reduceDiffReadings(otherReading, add=false){
    var sum = 0;
    var op;
    if (add)
      op = _.add;
    else
      op = _.subtract;

    for (var i = 0; i < sensorDims[0]; i ++)
      for (var j = 0; j < sensorDims[1]; j++)
        sum += Math.abs(op(otherReading.readings[i][j], this.readings[i][j]));
    return sum;
  }

  sumOverSelf(){
    var sum = 0;
    var max = 0;
    for (var i = 0; i < sensorDims[0]; i ++)
      for (var j = 0; j < sensorDims[1]; j++){
      	try{
        	sum += this.readings[i][j];
        	max = this.readings[i][j] > max ? this.readings[i][j] : max;
      	}
      	catch (e){
      		console.error("wtf error", e, this);
      		console.log("counts", errorCount);
      		errorCount++;
      	}
    }
    return [sum, max]; 
  }
}

class TestCycle{
  constructor(initialReading, numTestCycles=20){
    this.testingAvg = initialReading,
    this.testingCount = 1,
    this.numTestCycles = numTestCycles;
  }

  test(newReading){
    // if we are not done testing for an object
    // console.log('test reading', newReading);
    if (this.testingCount < this.numTestCycles){
      this.testingAvg = this.testingAvg.averageNewReading(newReading, this.testingCount);
      this.testingCount += 1;
      return undefined;
    }
    else
      return this.testingAvg;
  }
}

class ObjectLogger {
  constructor(socket){
    this.newObjectThreshold = 140,
    this.deleteObjectThreshold = 80,
    this.readingCount = 0,
    this.avgReading = SensorReading.createNewReading(),
    this.testCycle = undefined,
    this.socket = socket,
    this.objects = new Set();
    this.baseline;
  }

  calibrateValues(newReading){
    if(!this.calibrationTest){
      this.calibrationTest = new TestCycle(newReading, 100);
      return;
    }
    console.log(this.calibrationTest)
    var result = this.calibrationTest.test(newReading);
    if (result)
      this.baseline = result;
  }

  updateValues(newReading, callback){

    /////////////////////
    ///Sensor calibration
    if (!this.baseline){
      this.calibrateValues(newReading);
      return;
    } else{
      console.log('before diff baseline', newReading);
      newReading = newReading.diffReading(this.baseline, true);
      console.log('after diff baseline', newReading);
      console.log('baseline', this.baseline);
    }
    /////////////////////

    // if not currently testing for a new object
    if (!this.testCycle){
      // if the difference in readings is less than the threshold for a new object
      if (this.avgReading.reduceDiffReadings(newReading, false) < this.newObjectThreshold){
        this.readingCount += 1;
        this.avgReading = this.avgReading.averageNewReading(newReading, this.readingCount);
      }
      // if the difference in readings is not less than the threshold for a new object
      else{
        console.log('test start', this.avgReading, newReading);
        this.testCycle = new TestCycle(newReading);
      }
    }
    else{
      var testResult = this.testCycle.test(newReading);
      this.updateObjects(testResult);
    }
    callback(newReading, Array.from(this.objects));
  }
  
  updateObjects(testResult){
    if (!testResult)
      return undefined;

    console.log('test raw', testResult);
    var diffResult = testResult.diffReading(this.avgReading);
    console.log('test diff', diffResult);
    var diffMagnitude = diffResult.weight;

    this.testCycle = undefined;
    this.readingCount = 1;
    this.avgReading = testResult;

    if (diffMagnitude > this.newObjectThreshold){
      var newObject = new LogObject(diffResult);
      console.log('new object', diffMagnitude, newObject.reading.weight);
      this.addObject(newObject);
    }

    else if (diffMagnitude < -this.deleteObjectThreshold){
      this.testDeleteObject(diffResult);
    }

    console.log(this.objects);
  }

  addObject(newObject){
    this.objects.add(newObject);
    console.log('new object added woo');
    this.socket.emit('new_obj', {
      weight: newObject.reading.weight,
      position: newObject.centerOfMass(),
      spread: newObject.spread()
    });
  }

  testDeleteObject(diffResult){
    var objectsArray = Array.from(this.objects);
    var objectDiffs = objectsArray.map(x => x.reading.reduceDiffReadings(diffResult, true));
    var bestObjectInd = indOfMin(objectDiffs);
    
    console.log("best object score", objectDiffs[bestObjectInd]);
    
    // LOOK BACK HERE THIS MAY COME BACK
    // if (objectDiffs[bestObjectInd] <= this.newObjectThreshold)
    this.deleteObject(objectsArray[bestObjectInd]);
  }

  deleteObject(toDelete){
    this.objects.delete(toDelete);
    this.socket.emit('del_obj', {
      weight: toDelete.reading.weight,
      position: toDelete.centerOfMass(),
      spread: toDelete.spread()
    });
  }

}

export{SensorReading,ObjectLogger};
