import {esc,when} from './customer-shared.mjs';

export function emailStatus(state){return ({
 'needs-email':['Purchase email needed','Register the verified purchase email before sending a new invitation.'],
 pending:['Queued','The server has queued this notification. Delivery is not confirmed.'],
 'not-configured':['Email setup needed','The portal message is saved. Configure email and send a fresh invitation.'],
 sending:['Sending','The provider request is in progress. Delivery is not confirmed.'],
 'accepted-by-provider':['Accepted by email provider','Provider acceptance does not prove inbox delivery.'],
 failed:['Email attempt failed','Check email setup, then send a fresh invitation.'],
 'delivery-unknown':['Delivery unconfirmed','The request was interrupted. Check provider activity before sending another invitation.']
 })[state]||['Status unavailable','Refresh email activity to check this attempt.'];}

export function resolutionSteps(state,support){return [
 {label:'Access record active',done:!!state.entitlement?.active,detail:'The stored entitlement is active; this alone does not prove the purchase opens.'},
 {label:'Technical verification',done:!!support.verified,detail:'Current payment, entitlement, and protected content checks must agree.'},
 {label:'Customer confirmation',done:!!support.verified&&!!support.confirmedAt&&!support.help,detail:support.help?'The customer still needs help. Follow up in the conversation.':'The customer separately confirms that their purchase works.'}
 ];}

export function replyTemplates(support){return [
 ['Progress update',support.verified?'The technical access check has passed. Please open your purchase from your private case page and let us know whether it works for you.':'We are reviewing your purchase and access records. Your request is still open. We will record the next update here.'],
 ['Ask what happens','What happens when you try to open your purchase? Please share the error text and which step fails. Do not send passwords or payment details.'],
 ['Acknowledge follow-up','Thank you for letting us know. We will review the issue you described. Please keep updates in this conversation so we can follow the full history.']
 ];}

export function mountSupportPolish(panel,state,support){
 const thread=panel.querySelector('.customer-thread'),form=panel.querySelector('#support-reply');if(!thread||!form)return;
 const resolution=document.createElement('section');resolution.className='support-resolution';resolution.setAttribute('aria-label','Resolution milestones');
 resolution.innerHTML=`<span class="eyebrow">WHAT IS ACTUALLY COMPLETE?</span><div class="resolution-steps">${resolutionSteps(state,support).map(step=>`<div class="${step.done?'complete':''}"><span aria-hidden="true">${step.done?'✓':'○'}</span><strong>${step.label}</strong><p>${esc(step.detail)}</p></div>`).join('')}</div>`;thread.before(resolution);
 const input=form.querySelector('textarea'),kind=form.querySelector('select'),submit=form.querySelector('[type=submit]');
 const preview=document.createElement('section');preview.className='support-preview';preview.setAttribute('aria-label','Message preview');form.querySelector('.support-actions').before(preview);
 const templates=document.createElement('div');templates.className='support-templates';templates.innerHTML='<span>Start with a draft</span>'+replyTemplates(support).map(([label],i)=>`<button type="button" data-template="${i}">${label}</button>`).join('');input.before(templates);
 function update(){const internal=kind.value==='internal';preview.classList.toggle('private-preview',internal);preview.innerHTML=`<div><strong>${internal?'Private note preview':'Customer message preview'}</strong><span>${internal?'Visible to admins only':'Visible in the private customer portal'}</span></div><p>${esc(input.value.trim()||'Your message will appear here as you write.')}</p><small>${input.value.length} / 2,000 characters · ${internal?'No customer notification':'Email delivery depends on notification status'}</small>`;submit.textContent=internal?'Save private note':kind.value==='request'?'Send information request':'Send to customer';templates.hidden=internal;templates.querySelectorAll('button').forEach(b=>b.disabled=input.disabled);}
 input.addEventListener('input',update);kind.addEventListener('change',update);
 templates.querySelectorAll('button').forEach(button=>button.onclick=()=>{if(input.disabled)return;const text=replyTemplates(support)[Number(button.dataset.template)][1];input.value=(input.value.trim()?input.value+'\n\n'+text:text).slice(0,2000);input.dispatchEvent(new Event('input'));input.focus();});update();
 const activity=document.createElement('details');activity.className='support-delivery';activity.innerHTML=`<summary>Notification status · ${support.notifications.length} recorded attempts</summary><p>Portal messages and email notifications are separate. A saved message does not establish email delivery.</p>${support.notifications.slice(-5).reverse().map(n=>{const [title,detail]=emailStatus(n.state);return `<article><strong>${esc(title)}</strong><time>${esc(when(n.at))}</time><p>${esc(detail)}</p></article>`;}).join('')||'<p>No email attempts recorded yet.</p>'}`;resolution.after(activity);
}
