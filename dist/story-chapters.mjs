import {proofIsCurrent} from './operations.mjs';

// Chapters describe observed state. A simulated write is never described as a verified outcome.
export function storyChapters(s,{started=false,opened=false,confirmed=false,help=false}={}){
 const blocked=s.review?.outcome==='blocked';
 const verified=proofIsCurrent(s);
 const stages=[
  ['The gap',started,'A customer paid, but the course is locked.'],
  ['Evidence',!!s.review,'Payment, order, learner, and course are compared.'],
  ['Specialists',!!s.review,'Four specialists challenge the proposed next step.'],
  ['Merchant decision',!!s.approval,'The exact change needs a preview and explicit approval.'],
  ['One correction',s.writes===1,'Only the purchased course entitlement may change.'],
  ['Fresh verification',verified,'Payment, entitlement, and lesson access are checked again.'],
  ['Customer outcome',verified&&opened&&confirmed&&!help,'The customer opens the lesson and confirms the result.']
 ];
 return stages.map(([title,done,description],index)=>({number:index+1,title,description,status:done?'done':blocked&&index>=3?'held':help&&index===6?'reopened':s.proof&&!s.proof.passed&&index>=5?'needs-check':index===stages.findIndex(x=>!x[1])?'current':'waiting'}));
}
