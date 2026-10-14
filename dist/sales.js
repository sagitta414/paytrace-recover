const sampleEvidence={
 payment:{source:'PAYPAL / SAMPLE CAPTURE',title:'The payment went through.',copy:'A completed $128 capture matches this sample purchase reference. That confirms payment, but access still needs its own check.',code:'Capture status: COMPLETED',status:'Payment evidence found',agent:'Ledger · Payment analyst',finding:'“The payment matches. Let’s check what the enrollment service did next.”',portrait:0},
 handoff:{source:'COURSE SERVICE / SAMPLE PROCESSING LOG',title:'The enrollment update failed.',copy:'The sample log records a timeout while updating course access. It identifies the failed step; it does not establish why the service timed out.',code:'Enrollment update: TIMEOUT',status:'Cause remains unconfirmed',agent:'Relay · Event investigator',finding:'“We can trace the failed update. We should keep the underlying cause marked unknown.”',portrait:1},
 access:{source:'COURSE SERVICE / SAMPLE ACCESS RECORD',title:'The purchased course is still locked.',copy:'Maya’s access record is missing. A proposed correction would grant this course to this learner, after the purchase checks and merchant approval.',code:'Course entitlement: MISSING',status:'Merchant review required',agent:'Patch · Repair planner',finding:'“One learner, one course. I’ll show the proposed change before anything is applied.”',portrait:2}
};
document.querySelectorAll('[data-evidence]').forEach(button=>button.addEventListener('click',()=>{
 const record=sampleEvidence[button.dataset.evidence];
 document.querySelectorAll('[data-evidence]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 for(const key of ['source','title','copy','code','status','agent','finding'])document.getElementById('preview-'+key).textContent=record[key];
 document.getElementById('preview-avatar').className='portrait p'+record.portrait;
}));
