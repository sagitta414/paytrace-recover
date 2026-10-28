import {crew,findings,reviewIsCurrent,evidenceSnapshot} from './core.mjs';
import {proofIsCurrent} from './operations.mjs';
import {esc,when} from './customer-shared.mjs';
import {mountPulse} from './workspace-widgets.mjs';

export function agentRunView(s){
 const run=s?.agentRun;if(!run)return null;
 const active=Number.isInteger(run.agent)&&run.agent>=0&&run.agent<crew.length?crew[run.agent].name:null;
 const stage=run.step==='evidence'?'Gathering current records':run.step==='challenge'?'Challenging the recommendation':run.step==='decision'?'Checking the final answers':run.step?.startsWith('response-')?'Answering an objection':run.step?.startsWith('finding-')?'Reviewing evidence':'Review recorded';
 return {title:run.status==='failed'?'Review interrupted':run.status==='complete'?'Review recorded':active?`${active} is working`:'Gathering evidence',detail:run.status==='failed'?'No recommendation was completed. Retry after checking the connection.':run.status==='complete'?(run.mode==='scripted'?'Scripted demo findings are ready.':'Four specialist conclusions are recorded. Merchant approval is still required for any access change.'):`${stage}. No access change is being made.`,mode:run.mode,steps:crew.map((member,i)=>({name:member.name,state:run.mode==='scripted'&&run.status==='complete'?'scripted':run.status==='running'&&run.agent===i?'working':run.completed?.includes(i===3?'decision':'finding-'+i)?'received':'waiting'}))};
}

export function caseHandoff(s,uncertain=false){
 if(uncertain)return {owner:'Merchant',title:'Refresh before deciding',detail:'The displayed records may be out of date. Retrieve current evidence before another action.',tone:'amber'};
 if(proofIsCurrent(s))return {owner:'Merchant',title:'Access verified. Follow up with the customer.',detail:'Technical verification is complete. Check the conversation separately for customer confirmation.',tone:'green'};
 if(s.job?.pending)return {owner:'Recovery workflow',title:'An investigation is in progress',detail:'Refresh status to retrieve its result. No further action is needed while the workflow runs.',tone:'blue'};
 if(s.phase==='review-failed')return {owner:'Merchant',title:'The agent review stopped.',detail:'No recommendation or access change was authorized. Check the connection status, then retry the investigation. The purchase remains open.',tone:'amber'};
 if(s.writes)return {owner:'Merchant',title:'Verify the outcome, without another grant',detail:'An access change was recorded. A fresh verification must pass before you report success.',tone:'amber'};
 if(s.phase==='rehearsed')return {owner:'Merchant',title:'Your approval is the next step',detail:'Compare the before and after states. Approve only the exact change shown below.',tone:'blue'};
 if(s.phase==='approved')return {owner:'Merchant',title:'Apply the approved correction',detail:'Approval is recorded. Execution and verification still need to complete.',tone:'blue'};
 if(['blocked','needs-evidence','stale'].includes(s.phase))return {owner:'Merchant',title:'Resolve the evidence gap',detail:'Inspect the discrepancy and use the conversation to request what is missing. Access remains unchanged.',tone:'amber'};
 return {owner:'Merchant',title:s.capture?'Review the purchase evidence':'Confirm the purchase first',detail:s.capture?'Match the payment, customer, and purchased access before proposing a correction.':'Payment is not confirmed. Complete the appropriate checkout before investigating access.',tone:'blue'};
}

export function priorities(cases){return [
 {title:'Ready for approval',detail:'Preview prepared · your decision next',items:cases.filter(s=>s.phase==='rehearsed'&&!s.job?.pending),tone:'blue'},
 {title:'Check the outcome',detail:'Access changed · verification still needed',items:cases.filter(s=>s.writes&&!proofIsCurrent(s)&&!s.job?.pending),tone:'amber'},
 {title:'Evidence needs attention',detail:'Resolve a gap before changing access',items:cases.filter(s=>['blocked','needs-evidence','stale','review-failed'].includes(s.phase)&&!s.job?.pending),tone:'purple'}
 ];}

export function mountClarity(root,s,{cases=[],screen='cases',busy=false,uncertain=false}={}){
 if(!s){
  const overview=root.querySelector('.overview');if(screen!=='cases'||!overview)return;
  const section=document.createElement('section');section.className='clarity-priorities';section.setAttribute('aria-label','Recovery priorities');
  section.innerHTML=priorities(cases).map(group=>`<button class="priority-card ${group.tone}" ${busy||!group.items.length?'disabled':''} ${group.items.length?`data-case="${esc(group.items[0].id)}"`:''}><span class="priority-number">${group.items.length}</span><span><strong>${group.title}</strong><small>${group.detail}</small><em>${group.items.length?'Open first case →':'No cases waiting here'}</em></span></button>`).join('');overview.after(section);mountPulse(root,{cases,backend:window.COURSELATCH_RUNTIME?.backend===true,busy,uncertain,onSelect:caseId=>root.dispatchEvent(new CustomEvent('paytrace-select-case',{detail:caseId}))});return;
 }
 const head=root.querySelector('.sheet-head'),main=root.querySelector('.case-evidence-column');if(!head||!main)return;
 const handoff=caseHandoff(s,uncertain),banner=document.createElement('section');banner.className='clarity-handoff '+handoff.tone;
 const last=s.events?.at(-1);
 banner.innerHTML=`<div><span class="eyebrow">UP NEXT · ${esc(handoff.owner)}</span><h2>${esc(handoff.title)}</h2><p>${esc(handoff.detail)}</p></div><span class="clarity-stamp">${last?'Last recorded activity<br>'+esc(when(last.at)):'No activity recorded yet'}</span>`;head.append(banner);
 const panel=document.createElement('section');panel.className='clarity-specialists';
 const current=!!s.review&&reviewIsCurrent(s)&&!uncertain;
 const snapshot=s.review?.snapshot||evidenceSnapshot(s);
 const run=agentRunView(s);
 panel.innerHTML=`<div class="clarity-section-head"><div><span class="eyebrow">FOUR PERSPECTIVES · ONE DECISION</span><h2>Meet the evidence team.</h2></div><span class="clarity-method">${s.phase==='review-failed'?'Review interrupted':!s.review?'Awaiting investigation':!current?'Review needs refreshing':s.review.mode==='scripted'?'Scripted demo review':'AI-assisted review'}</span></div>${run?`<div class="agent-run agent-run-${esc(s.agentRun.status)}" role="status"><div><strong>${esc(run.title)}</strong><p>${esc(run.detail)}</p></div><span>${esc(run.mode==='model'?'AI model':'Scripted demo')}</span><div class="agent-run-steps">${run.steps.map(step=>`<span class="${esc(step.state)}">${esc(step.name)} <small>${step.state==='received'?'Response received':step.state==='working'?'Working':step.state==='scripted'?'Sample finding':'Waiting'}</small></span>`).join('')}</div></div>`:''}<p class="clarity-intro">${s.phase==='review-failed'?'The previous review produced no usable recommendation. Retry after checking the connection.':'Expand a specialist to see the finding, its supporting records, and what it cannot establish.'}</p><div class="clarity-agent-grid">${crew.map((agent,i)=>{
 const finding=s.analysis?.findings?.find(f=>f.agent===i)||findings(s)[i],statements=current?(s.review.exchange||[]).filter(x=>x.agent===i):[];
 const sourceKeys=[...new Set([...finding.sources,...statements.flatMap(x=>x.sources||[])])];
 return `<details class="clarity-agent agent-${i}"><summary><span class="clarity-avatar specialist-avatar specialist-${i}" aria-hidden="true">${agent.name[0]}</span><span><strong>${agent.name}</strong><small>${agent.role}</small></span><span class="clarity-expand" aria-hidden="true">+</span></summary><div class="clarity-agent-body"><p class="agent-hello">“${esc(agent.hello)}”</p><p>${esc(agent.scope)}</p>${current?`<h3>${s.analysis?.findings?.some(f=>f.agent===i)?"Recorded finding":"Evidence summary"}</h3><p>${esc(finding.summary)}</p>${statements.map(x=>`<p class="agent-statement"><strong>${esc(x.kind)}</strong><br>${esc(x.summary)}</p>`).join('')}<h3>What remains uncertain</h3><p>${esc(finding.unknown)}</p><details class="clarity-records"><summary>Inspect supporting records · ${sourceKeys.length}</summary>${sourceKeys.map(key=>`<h4>${esc(key)}</h4><pre>${esc(JSON.stringify(snapshot[key],null,2))}</pre>`).join('')}</details>`:'<div class="agent-waiting">A current investigation is required before this specialist’s findings can support a decision.</div>'}</div></details>`;
 }).join('')}</div><p class="clarity-footnote">Specialists recommend. You approve. The system verifies the result.</p>`;
 main.querySelector('.case-column-title')?.after(panel);
 // Replace the older duplicate specialist list, keeping the evidence and audit trail.
 for(const details of main.querySelectorAll('details.detail'))if(details.querySelector('summary')?.textContent.startsWith('Specialist review'))details.remove();
}
