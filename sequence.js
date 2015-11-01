/**
 *
 * example adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "example",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js Example Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@example.com>"
 *          ]
 *          "desc":         "Example adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/*
  Install:
     C:\Program Files\ioBroker\node_modules\iobroker.vcard\lib>npm install vcard-json
     C:\Program Files\ioBroker\node_modules\iobroker.vcard\lib>npm install node-schedule


 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";


// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.example.0


var noOfSteps=15; //changeable up to 99. edit of io-package.json needed!
var adapter = utils.adapter('sequence');
var currentStep=0;          //number of current step in arrays [0...(noOfSteps+1)]
var stepNames=[];           //contains the symbolic names of each step
var stepCmdStrings=[];      //contains the CMD, which is written to CMD-Output
var cmdOutputNames=[];
var conditionInputNames=[];
var noOfLastUsedStep=0;
var stepMonitoringTimes=[]; //contains the monitoring time between CMD and FB in mSec.
var timeoutStepMonitoring;  //timer for monitoring condition time out
var monitoringTimeTimerStarted;
var monitoringTimeOutput;
var monitoringTime=0;
var waitingTimeTimer;       // timer for step waiting time
var waitingTimeTimerStarted; //when was timer started?
var waitingTime=0;          //value of waiting time
var waitingTimeOutput;      //Interval for cyclically output of remaining waiting time

var enumState={
     stopped:0,
     running:1,
     error:2
 }
var estate=enumState.stopped;

adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});




adapter.on('stateChange', function (id, state) {
    if (state && !state.ack) {
        if (id.toString().indexOf( adapter.namespace + '.inputs.sequence.condition_')==0) {
            if(!state.ack)
                checkNextStep(id,state.val);
        } else if (id == adapter.namespace + '.inputs.cmd.start') {
            if(!state.ack)
                startSequence(state.val);
        } else if (id == adapter.namespace + '.inputs.cmd.stop') {
            if(!state.ack)
                stopSequence(state.val);
        } else if (id == adapter.namespace + '.inputs.cmd.next') {
            if(!state.ack)
                nextStep(state.val);
        } else if (id == adapter.namespace + '.inputs.sequence.condition') {
            if(!state.ack)
                nextStepCommonCondition(state.val);
        }
    }
});




adapter.on('ready', function () {
    main();
});





// ###### MAIN ######
function main() {
    adapter.log.info('DEBUG VERSION');
    // in this example all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    estate=enumState.stopped;
    currentStep=0;

    setupNameLists();


    //set step indication
    updateStepIndication();
}


// ###### NEXT STEP ######
function checkNextStep(id, val) {
    //TRIGGERT by inputs.sequence.condition_xx inputs
    if (!val)
        return;
    if (estate != enumState.running)
        return;

    //conditions has to come in right order. no jumps over steps oder backwards
    var inputStepNo=id.toString().substring(id.toString().indexOf('_')+1);
    inputStepNo=parseInt(inputStepNo);
    if(currentStep!=inputStepNo)
        return;

    var currNo = (currentStep < 10) ? '0' + currentStep : currentStep;

    if (!id.toString().indexOf('_' + currNo) == -1)
        return; //wrong condition input was changed

    resetTimers();

    if (currentStep == noOfLastUsedStep) {
        //last step reached
        stopSequence(true);
        return;
    }

    //switch to next step
    currentStep++;
    setCheckNextStep(conditionInputNames[currentStep]);
}


function nextStepCommonCondition(value){
    //TRIGGERD by common condition input input.sequence.condition
    if(estate!=enumState.running)
        return;

    if(!value)
        return;

    resetTimers();

    if(currentStep==noOfLastUsedStep){
        //last step reached
        stopSequence(true);
        return;
    }

    //switch to next step
    currentStep++;

    setCheckNextStep(conditionInputNames[currentStep]);
}


function nextStep(){
    //Triggered by input CMD.NEXT
    if(estate!=enumState.running)
        return;

    resetTimers();

    if(currentStep==noOfLastUsedStep){
        //last step reached
        stopSequence(true);
        return;
    }

    //switch to next step
    currentStep++;

    setCheckNextStep(conditionInputNames[currentStep]);
}


// ###### CMD ######
function startSequence(data) {
    if (!data)
        return;

    adapter.setState('inputs.cmd.start', {val:data,ack: true});

    adapter.getState('inputs.cmd.noOfLastStep', function (err, res) {

        if (!res)
            return;

        noOfLastUsedStep = res.val;
        adapter.setState('inputs.cmd.noOfLastStep', {val:res.val,ack: true});

        //read 'static' inputs
        for (var i = 1; i <= noOfSteps; i++) {
            readInputs(i);
        }

        //clear CMD outputs
        clearCmd(0, noOfSteps);

        if (noOfLastUsedStep < 1)
            return;
        if (noOfLastUsedStep > noOfSteps)
            return;

        waitingTime = 0;
        monitoringTime=0;

        estate = enumState.running;
        currentStep = 1;
        setCheckNextStep(conditionInputNames[currentStep]);
    });
}


function resetTimers() {
    if (timeoutStepMonitoring)
        clearTimeout(timeoutStepMonitoring);
    if (monitoringTimeOutput) {
        adapter.setState('outputs.cmd.remainingMonitoringTime', 0);
        clearInterval(monitoringTimeOutput);
    }
    if (waitingTimeTimer)
        clearTimeout(waitingTimeTimer);
    if (waitingTimeOutput) {
        adapter.setState('outputs.cmd.remainingWaitingTime', 0);
        clearInterval(waitingTimeOutput);
    }

    waitingTime = 0;
    monitoringTime = 0;
}
function stopSequence(data){
    if(!data)
        return;

    resetTimers();
    adapter.setState('inputs.cmd.stop',{val:data,ack:true});
    estate=enumState.stopped;
    currentStep=0;
    clearCmd(0,noOfSteps);

    updateStepIndication();
}




function setCheckNextStep(conditionInput) {
    adapter.getState(conditionInput, function (err, res) {
        adapter.setState(conditionInput, {val:res.val,ack: true}, function () {

            //check if next condition already TRUE. If next condition is TRUE, sequence jumps to next step (without setting CMD)
            if (res) {
                if (res.val.toString().indexOf('T=') > -1) {
                    //waiting time configured
                    var t = res.val.toString().substring(2);
                    t = parseInt(t);
                    if (!t) {
                        //error
                        estate = enumState.error;
                        updateStepIndication();
                        return;
                    }
                    waitingTime = t;

                    adapter.setState(cmdOutputNames[currentStep], stepCmdStrings[currentStep], function () {
                        adapter.setState('outputs.sequence.cmd', stepCmdStrings[currentStep], function () {
                            waitingTimeTimer = setTimeout(function(){nextStep(conditionInput, 1)}, waitingTime);
                            waitingTimeTimerStarted=Date.now();
                            waitingTimeOutput=setInterval(function(){
                                adapter.setState('outputs.cmd.remainingWaitingTime',
                                    (waitingTimeTimerStarted + waitingTime-Date.now())
                                    );
                            }, 1000);
                            //
                        });
                    });
                }
                else if (res.val) {
                    //true -> next step
                    checkNextStep(conditionInput, res.val);
                }
                else {
                    //false -> set cmd output
                    adapter.setState(cmdOutputNames[currentStep], stepCmdStrings[currentStep], function() {
                        adapter.setState('outputs.sequence.cmd', stepCmdStrings[currentStep], function () {
                            if (stepMonitoringTimes[currentStep]) {
                                monitoringTime=stepMonitoringTimes[currentStep];
                                timeoutStepMonitoring = setTimeout(function () {
                                    setTimeoutError(stepNames[currentStep], monitoringTime)
                                }, monitoringTime);
                                monitoringTimeTimerStarted=Date.now();
                                monitoringTimeOutput=setInterval(function(){
                                    adapter.setState('outputs.cmd.remainingMonitoringTime',
                                        (monitoringTimeTimerStarted + monitoringTime-Date.now())
                                    );
                                }, 1000);
                            }
                        });
                    });
                }
            } else {
                //no value -> set cmd output
                adapter.setState(cmdOutputNames[currentStep], stepCmdStrings[currentStep], function() {
                    adapter.setState('outputs.sequence.cmd', stepCmdStrings[currentStep], function () {
                      /*  if (stepMonitoringTimes[currentStep])
                            timeoutStepMonitoring = setTimeout(function () {
                                setTimeoutError(stepNames[currentStep], stepMonitoringTimes[currentStep])
                            }, stepMonitoringTimes[currentStep]);*/
                        if (stepMonitoringTimes[currentStep]) {
                            monitoringTime=stepMonitoringTimes[currentStep];
                            timeoutStepMonitoring = setTimeout(function () {
                                setTimeoutError(stepNames[currentStep], monitoringTime)
                            }, monitoringTime);
                            monitoringTimeTimerStarted=Date.now();
                            monitoringTimeOutput=setInterval(function(){
                                adapter.setState('outputs.cmd.remainingMonitoringTime',
                                    (monitoringTimeTimerStarted + monitoringTime-Date.now())
                                );
                            }, 1000);
                        }

                    });
                });
            }

            updateStepIndication();
        });
    });
}






// ###### UTILS ######
function setTimeoutError(step, time){
    estate=enumState.error;
    updateStepIndication();
}


function clearCmd(start, stop){
    if(stop<start)
        return;
    for(var v=start;v<=stop;v++){
        adapter.setState( cmdOutputNames[v],'');
    }
    adapter.setState('outputs.sequence.cmd', '');
}




function updateStepIndication()
{
    adapter.setState('outputs.cmd.stopped',estate==enumState.stopped);
    adapter.setState('outputs.cmd.started',estate==enumState.running);
    adapter.setState('outputs.cmd.error',estate==enumState.error);

    adapter.setState('outputs.cmd.lastStepNo', currentStep-1);
    adapter.setState('outputs.cmd.lastStepName', (stepNames[currentStep-1])?stepNames[currentStep-1]:'');

    adapter.setState('outputs.cmd.currentStepNo',currentStep);
    adapter.setState('outputs.cmd.currentStepName', (stepNames[currentStep])?stepNames[currentStep]:'');

    var ns=((currentStep+1) > noOfSteps)?0:currentStep+1;
    adapter.setState('outputs.cmd.nextStepNo',ns);
    adapter.setState('outputs.cmd.nextStepName', (stepNames[ns])?stepNames[ns]:'');

   // adapter.setState('outputs.cmd.currentWaitingTime',waitingTime);
}



function readInputs(index){
    var no=(index<10)?'0'+index:index;

    adapter.getState('inputs.sequence.name_'+no, function (err, res) {
        if (res) {
            stepNames[index] = res.val;
            adapter.setState('inputs.sequence.name_'+no,{val:res.val, ack:true});
        }
    });

    adapter.getState('inputs.sequence.monitoringTime_'+no, function (err, res) {
        if (res) {
            stepMonitoringTimes[index]=res.val;
            adapter.setState('inputs.sequence.monitoringTime_'+no,{val:res.val, ack:true});
        }
    });

    adapter.getState('inputs.sequence.commandString_'+no, function (err, res){
        if(res)
        {
            stepCmdStrings[index]=res.val;
            adapter.setState('inputs.sequence.commandString_'+no,{val:res.val, ack:true});
        }
    });
}



function setupNameLists() {
    for (var index = 1; index <= noOfSteps; index++) {
        var no = (index < 10) ? '0' + index : index;
        cmdOutputNames[index] = 'outputs.sequence.cmd_' + no;
        conditionInputNames[index] = 'inputs.sequence.condition_' + no;
    }
}



