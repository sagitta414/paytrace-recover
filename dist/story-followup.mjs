import {proofIsCurrent} from './operations.mjs';

export function reportStoryHelp(support,now=new Date().toISOString()){
 support.help=true;
 support.confirmedAt=null;
 support.helpAt=now;
 support.acknowledgedAt=null;
 support.recheckedAt=null;
 return support;
}
export function acknowledgeStoryHelp(support,now=new Date().toISOString()){
 if(!support.help)throw Error('There is no open customer follow-up.');
 support.acknowledgedAt=now;
 return support;
}
export function confirmStoryAccess(s,support,{opened,now=new Date().toISOString()}){
 if(!opened||!proofIsCurrent(s))throw Error('Open the verified lesson first.');
 support.help=false;
 support.confirmedAt=now;
 return support;
}
