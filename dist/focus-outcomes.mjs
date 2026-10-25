import {proofIsCurrent} from './operations.mjs';
import {request} from './customer-shared.mjs';
const verified=s=>proofIsCurrent(s)&&s.evidenceAvailable!==false&&!Object.values(s.sources||{}).some(source=>source?.status==='unavailable');

export function outcomeCounts(cases){
 const checked=cases.filter(verified);
 return {
  verified:checked.length,
  held:cases.filter(s=>!s.writes&&['blocked','needs-evidence','stale'].includes(s.phase)).length,
  awaitingVerification:cases.filter(s=>s.writes&&!verified(s)).length,
  sandbox:cases.filter(s=>s.capture?.source==='paypal-sandbox').length,
  total:cases.length
 };
}

export function mountOutcomes(root,cases,{backend=false}={}){
 const overview=root.querySelector('.overview');if(!overview)return;
 const counts=outcomeCounts(cases),panel=document.createElement('section');
 panel.className='outcomes-panel surface';panel.setAttribute('aria-label','Recovery outcomes');
 panel.innerHTML=`<div class="section-head"><div><span class="eyebrow">MEASURED IN THIS WORKSPACE</span><h2>What happened to the cases?</h2></div><span class="subtle">${counts.sandbox} PayPal sandbox · ${counts.total-counts.sandbox} sample</span></div><div class="outcomes-grid"><div><strong>${counts.verified}</strong><span>Access verified</span><small>Current payment, entitlement, and lesson checks passed.</small></div><div><strong>${counts.held}</strong><span>Held for evidence</span><small>Blocked, missing, or stale evidence; no access write.</small></div><div><strong>${counts.awaitingVerification}</strong><span>Verification pending</span><small>Access changed, but current proof has not passed.</small></div><div><strong data-confirmed>—</strong><span>Customer confirmation pending</span><small data-confirmation-note>${backend?'Checking private case responses…':'Not tracked in browser samples.'}</small></div></div><p class="outcomes-note">Counts describe this demo workspace, not a merchant-wide success rate. Customer confirmation is separate from technical verification.</p>`;
 overview.after(panel);
 if(!backend)return;
 request('/api/support/outcomes').then(data=>{if(!panel.isConnected)return;const confirmed=new Set(data.confirmedCaseIds||[]);panel.querySelector('[data-confirmed]').textContent=cases.filter(s=>verified(s)&&!confirmed.has(s.id)).length;panel.querySelector('[data-confirmation-note]').textContent='Technically verified cases without a recorded customer confirmation.';}).catch(()=>{if(panel.isConnected)panel.querySelector('[data-confirmation-note]').textContent='Customer response count unavailable. Refresh to retry.';});
}
