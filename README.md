#Sequence Adapter for ioBroker

##Description:

This adapter offers the configuration of command sequences (different commands, that are triggered after each other). 
The sequence is built of multiple steps ('outputs.sequence.xx' and 'inputs.sequence.xx') 
and a common control block ('outputs.cmd.xx' and 'inputs.cmd.xx'). Up to now, the sequence adapter supports one 
sequence chain, with up to 10  steps.
 
##The command unit contains:
* 'inputs.cmd.start' Starts sequence
* 'inputs.cmd.stop' Stops sequence
* 'inputs.cmd.next' Manual switch to next step
* 'inputs.cmd.noOfLastStep' Number of the last step. After this step, the sequence is finished.
* 'outputs.cmd.started'
* 'outputs.cmd.stopped'
* 'outputs.cmd.error'
* 'outputs.cmd.lastStepNo'
* 'outputs.cmd.lastStepName'
* 'outputs.cmd.currentStepNo'
* 'outputs.cmd.currentStepName'
* 'outputs.cmd.nextStepNo'
* 'outputs.cmd.nextStepName'
* 'outputs.cmd.remainingWaitingTime'
* 'outputs.cmd.remainingMonitoringTime'

##Each step contains (xx is the step number 1..15):
* A symbolic step name 'inputs.sequence.name_xx'
* A monitoring time in mSec 'inputs.sequence.monitoringTime_xx'
* A command string input 'inputs.sequence.commandString_xx'
* A command output 'outputs.sequence.cmd_xx'
* An input for command feedback 'inputs.sequence.condition_xx' or an waiting time 'T=' (mSec)

##Common step IOs:
* 'outputs.sequence.cmd' always writes the command of the current step out. All step commands are written to this output sequentially.
* 'inputs.sequence.condition' is a common condition input for all steps. 

##Input values:
All condition inputs accept any value (which is not null/undefined/0/false) as TRUE. 
If a condition value has ACK==true, it will be ignored. A configured waiting time will with ACK==true will not be ignored. 
After reading input values, the ACK is set to TRUE.


##Workflow:
* If 'inputs.cmd.start' is set, the sequence switches to STEP1. The CMD outputs will be flushed. The condition inputs will not be touched!
* The command from 'inputs.sequence.commandString_01' is written to 'outputs.sequence.cmd_01' and to 'outputs.sequence.cmd'
* If 'inputs.sequence.monitoringTime_01' is larger than 0, the monitoring time is started.
* If 'inputs.sequence.condition_01' or 'inputs.sequence.condition' is set, the sequence switches to STEP2
* If the monitoring timeout exceeds, the sequence is STOPPED and 'outputs.cmd.error' is set.
* 'Inputs.CMD.Stop' stops the sequence in case of an error
* Instead of using a feedback value at 'inputs.sequence.condition_01', a waiting time in mSec can be configured 
(e.g. 1 second 'T=1000')


Inputs (Start, Stop, Next, conditions) accepts all values as TRUE ("null/NaN/undefinded/false/''" are interpreted as FALSE).

##Prerequirements:
- [ioBroker](http://www.ioBroker.net "ioBroker homepage")



##Change log:  

###0.0.1 (2015-09-28)  
* Initial version

##LOP:  
* Acknowledge mode (manual acknowledge for each step)  
* Multiple sequences (inside one adapter instance)  
* More than 15 steps  
* Branches/jumps inside one sequence???  

