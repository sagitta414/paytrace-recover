import {checks} from './core.mjs';
import {proofIsCurrent} from './operations.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():'No check time recorded';
const workflowStages={investigate:[['gather','Gather evidence'],['analyze','Analyze findings'],['record','Record recommendation']],recover:[['repair','Apply approved correction'],['verify','Check protected lesson']]};
const latestRun=(s,kind)=>{
 const runs=Array.isArray(s.workflowRuns)?s.workflowRuns:[];
 return [...runs,...(s.job?.kind===kind&&s.job.runId?[{kind,runId:s.job.runId,startedAt:s.job.startedAt,finishedAt:s.job.pending?null:s.job.expiredAt||null,status:s.job.expiredAt?'timed-out':s.job.error?'failed':s.job.pending?'running':kind==='investigate'&&s.job.completed?.record||kind==='recover'&&s.job.completed?.verify?'completed':'incomplete',completedStages:Object.keys(s.job.completed||{})}]:[])].filter(run=>run.kind===kind).at(-1)||null;
};

export function recoveryTrail(s,{uncertain=false}={}){
 const sandbox=s.capture?.source==='paypal-sandbox',sample=s.capture?.source==='sample';
 const payment=s.capture?.status==='COMPLETED'&&s.evidenceAvailable!==false&&s.sources?.payment?.status!=='unavailable'&&!uncertain&&checks(s).slice(0,5).every(check=>check.ok);
 const investigation=latestRun(s,'investigate'),recovery=latestRun(s,'recover');
 const review=!!s.review,approved=!!s.approval&&s.approval.planId===s.rehearsal?.id&&s.approval.fingerprint===s.rehearsal?.fingerprint;
 const proof=!uncertain&&s.evidenceAvailable!==false&&proofIsCurrent(s);
 return [
  {id:'payment',label:sandbox?'PayPal payment':'Purchase record',state:payment?'Matched':s.capture?.status==='COMPLETED'?'Recheck needed':'Pending',tone:payment?'done':'waiting',time:s.sources?.payment?.checkedAt||s.paidAt,source:sandbox?'PayPal sandbox capture':sample?'Illustrative sample record':'Payment source',detail:payment?'The completed capture and saved order agree on order, learner, course, amount, and currency.':'A current completed capture and exact purchase match are required.',target:'payment'},
  {id:'investigation',label:investigation?.runId?'Render investigation':'Investigation',state:investigation?.status==='completed'&&review?`${s.review.mode==='model'?'AI review':'Scripted review'} recorded`:investigation?.status==='running'?'Render running':investigation?.status==='failed'||investigation?.status==='timed-out'?'Run needs attention':review?'Review recorded':'Not started',tone:investigation?.status==='completed'&&review?'done':investigation?.status==='running'?'working':'waiting',time:investigation?.finishedAt||investigation?.startedAt||null,source:investigation?.runId?'Render task run':review?'PayTrace case review':'No run recorded',reference:investigation?.runId||null,stages:investigation?.runId?workflowStages.investigate.map(([id,label])=>({id,label,done:investigation.completedStages?.includes(id)})):null,detail:investigation?.runId?'Render accepted this task run. Saved stage callbacks show what finished; specialist findings are separate case records.':review?'A case review exists, but no Render investigation run is recorded here.':'No investigation result is recorded yet.',target:'investigation'},
  {id:'approval',label:'Authorization',state:approved?s.approval.mode==='policy'?'Merchant policy':'Merchant approved':s.rehearsal?'Preview ready':'Awaiting decision',tone:approved?'done':'waiting',time:s.approval?.at||null,source:approved?s.approval.mode==='policy'?'Enabled merchant policy':'Merchant decision':'Case decision',detail:approved?'The authorization is tied to the exact previewed learner, course, and purchase.':'A review or preview never authorizes a grant by itself.',target:'approval'},
  {id:'recovery',label:recovery?.runId?'Render recovery':'Recovery run',state:recovery?.status==='running'?'Render running':recovery?.status==='completed'&&s.writes===1?'Run finished':recovery?.status==='failed'||recovery?.status==='timed-out'?'Run needs attention':s.writes?'Grant recorded':'Not started',tone:recovery?.status==='completed'&&s.writes===1?'done':recovery?.status==='running'?'working':'waiting',time:recovery?.finishedAt||recovery?.startedAt||null,source:recovery?.runId?'Render task run':s.writes?'PayTrace recovery service':'No run recorded',reference:recovery?.runId||null,stages:recovery?.runId?workflowStages.recover.map(([id,label])=>({id,label,done:recovery.completedStages?.includes(id)})):null,detail:recovery?.runId?'Render accepted the approved recovery run. A completed task still requires a current protected-lesson check.':s.writes?'An access write is recorded, but no Render recovery run is recorded for it.':'No access correction has run.',target:'recovery'},
  {id:'lesson',label:'Lesson proof',state:proof?'Verified':s.proof?.passed?'Proof expired':s.proof?'Check failed':'Not checked',tone:proof?'done':'waiting',time:s.proof?.at||null,source:s.proof?.transport||'Protected course check',detail:proof?'Fresh payment, entitlement, and protected lesson checks agree. Buyer-browser receipt and customer confirmation are separate.':'The case is not complete until a current protected-lesson check passes.',target:'lesson'}
 ];
}

export function recoveryTrailMarkup(s,options={}){
 const steps=recoveryTrail(s,options),selected=steps.find(step=>step.tone!=='done')||steps.at(-1);
 return `<section class="case-recovery-trail" aria-label="Recovery trail"><div class="case-recovery-trail-head"><div><span class="eyebrow">${s.capture?.source==='paypal-sandbox'?'PAYPAL SANDBOX CASE':s.capture?.source==='sample'?'ILLUSTRATIVE SAMPLE':'CASE RECORD'}</span><h2>From payment to lesson proof</h2></div><span class="case-recovery-trail-count">${steps.filter(step=>step.tone==='done').length} of ${steps.length} steps recorded</span></div><ol class="case-recovery-trail-steps">${steps.map((step,index)=>`<li class="${step.tone}"><button type="button" data-trail-stage="${step.id}" aria-pressed="${step.id===selected.id}"><span class="case-trail-index">${step.tone==='done'?'✓':String(index+1).padStart(2,'0')}</span><strong>${esc(step.label)}</strong><small>${esc(step.state)}</small></button></li>`).join('')}</ol><div class="case-recovery-trail-detail" aria-live="polite"></div><p class="case-recovery-trail-note">A completed task run is not proof of access. The buyer’s own confirmation is separate.</p></section>`;
}

export function mountRecoveryTrail(root,s,options={}){
 const node=root.querySelector('.case-recovery-trail');if(!node)return;
 const steps=recoveryTrail(s,options),selected=steps.find(step=>step.tone!=='done')||steps.at(-1);
 const detail=node.querySelector('.case-recovery-trail-detail');
 function show(step){
  node.querySelectorAll('[data-trail-stage]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.trailStage===step.id)));
  const anchor={payment:'case-fact-payment',investigation:root.querySelector('#case-agent-consensus')?'case-agent-consensus':root.querySelector('#case-record-02')?'case-record-02':'case-deep-evidence',approval:'case-decision',recovery:root.querySelector('#case-record-03')?'case-record-03':'case-deep-evidence',lesson:'case-fact-access'}[step.target];
  const stages=step.stages?`<div class="case-render-run"><span class="case-render-run-id">Render run ${esc(step.reference)}</span><ol aria-label="Saved workflow stages">${step.stages.map(stage=>`<li class="${stage.done?'complete':'pending'}"><span aria-hidden="true">${stage.done?'✓':'·'}</span>${esc(stage.label)} <small>${stage.done?'Completed':'Not yet recorded'}</small></li>`).join('')}</ol></div>`:'';
  detail.innerHTML=`<div><span class="eyebrow">${esc(step.source)}</span><h3>${esc(step.label)} · ${esc(step.state)}</h3><p>${esc(step.detail)}</p>${stages}<small>${step.time?'Recorded '+esc(when(step.time)):'No time recorded'}</small></div><a href="#${anchor}" data-trail-source="${step.target}">Inspect ${step.target==='payment'?'capture':step.target==='lesson'?'proof':'record'} <span aria-hidden="true">↗</span></a>`;
  detail.querySelector('[data-trail-source]').addEventListener('click',()=>{
   const deep=root.querySelector('#case-deep-evidence');if(deep)deep.open=true;
   const groupNumber={payment:'01',investigation:'02',approval:'01',recovery:'03',lesson:'03'}[step.target];
   const group=root.querySelector(`.case-record-group[data-record-group="${groupNumber}"]`);if(group)group.open=true;
   if(step.target==='payment')root.querySelector('#case-fact-payment')?.setAttribute('open','');
   if(step.target==='lesson')root.querySelector('#case-fact-access')?.setAttribute('open','');
  });
 }
 node.querySelectorAll('[data-trail-stage]').forEach(button=>button.addEventListener('click',()=>show(steps.find(step=>step.id===button.dataset.trailStage))));
 show(selected);
}
