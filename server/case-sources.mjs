import {fingerprint} from '../dist/core.mjs';
// Reads are independent: an outage must not masquerade as an inactive entitlement.
export async function readCaseSources(s,owner,{paypal,access}){
 const before=fingerprint(s),previous=s.sources||{},at=new Date().toISOString();
 const results=await Promise.allSettled([
  Promise.resolve().then(()=>{if(s.capture?.source==='paypal-sandbox')return paypal.refresh(s);if(s.scenario==='missing'&&s.evidenceAvailable===false)throw Error('Missing sample record');return s.capture;}),
  Promise.resolve().then(()=>access(owner,s)).then(value=>{if(!value||typeof value.active!=='boolean'||typeof value.userId!=='string'||typeof value.courseId!=='string')throw Error('Invalid access response');return value;})
 ]);
 const names=['payment','access'];s.sources={};
 results.forEach((result,i)=>{const key=names[i],ok=result.status==='fulfilled';s.sources[key]={status:ok?'available':'unavailable',checkedAt:at,lastSuccessAt:ok?at:previous[key]?.lastSuccessAt||null,system:i===0?(s.capture?.source==='paypal-sandbox'?'PayPal sandbox':'Sample payment records'):'Course access service',detail:ok?'Current record retrieved.':'Unable to retrieve a current record. Last known values are retained.'};
  if(ok){if(i===0){s.capture=result.value;s.evidenceAvailable=true;}else{s.entitlement=result.value;}}else if(i===0)s.evidenceAvailable=false;
 });
 const available=results.every(r=>r.status==='fulfilled');
 if((before!==fingerprint(s)||!available)&&(s.review||s.proof||s.approval)){s.review=null;s.rehearsal=null;s.approval=null;s.proof=null;s.phase=s.writes?'unverified':available?'stale':'needs-evidence';}
 if(!available)s.phase=s.writes?'unverified':'needs-evidence';
 return available;
}
