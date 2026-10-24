import {newCase} from './new-case-model.mjs';
export const sandboxCheckoutReady=(backend,config)=>backend===true&&config?.paypal===true;
export function mountNewCase({backend,api,onCreated,isBusy}){
 const sandboxReady=sandboxCheckoutReady(backend,window.COURSELATCH_RUNTIME);
 const toolbar=document.createElement('div');toolbar.className='case-create-toolbar';
 const open=document.createElement('button');open.className='button primary';open.textContent='+ New case';open.type='button';toolbar.append(open);
 document.querySelector('#focus-app').before(toolbar);
 const dialog=document.createElement('dialog');dialog.className='new-case-dialog';dialog.setAttribute('aria-labelledby','new-case-title');
 dialog.innerHTML=`<form id="new-case-form"><div class="eyebrow">RECOVERY DESK</div><h2 id="new-case-title">Start with a purchase.</h2><p>Create a case for the reference course. Access changes still require evidence, your approval, and verification.</p><div class="intake-steps" aria-label="New case steps"><span>1 Purchase</span><span>2 Evidence</span><span>3 Review</span></div><section class="intake-stage" data-stage="0"><label>Customer display name<input name="customerName" required maxlength="80" autocomplete="off" placeholder="e.g. Alex" autofocus></label><p class="footnote">Use a fictional name while testing. A unique demo learner is created for this case.</p></section><section class="intake-stage" data-stage="1" hidden><label>Payment source<select name="mode"><option value="sandbox" ${sandboxReady?'selected':'disabled'}>PayPal sandbox · awaiting checkout</option><option value="sample" ${sandboxReady?'':'selected'}>Sample payment · simulated</option></select></label><div class="new-case-course"><strong>The Light &amp; Story Workshop</strong><span>$128.00 USD · reference course service</span></div><p id="case-mode-help"></p>${!sandboxReady&&backend?'<p class="new-case-setup">PayPal sandbox is not configured on this server. Explore a fictional sample now, then return for a connected checkout. <a href="focus.html?screen=connections">See Connections →</a></p>':''}</section><section class="intake-stage" data-stage="2" hidden><h3>Review before creating</h3><div class="intake-summary"></div><p>Creating a case does not approve a correction or grant access. Review payment evidence after creation.</p></section><p class="new-case-error" role="alert"></p><div class="new-case-actions"><button type="button" class="button" id="cancel-case">Cancel</button><button type="button" class="button" id="case-back" hidden>Back</button><button type="submit" class="button primary" hidden>Create case</button><button type="button" class="button primary" id="case-next">Continue</button></div></form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),error=dialog.querySelector('[role=alert]'),mode=form.elements.mode,submit=form.querySelector('[type=submit]');
 let requestId=null,pending=false,savedInput=null,step=0;
 const back=form.querySelector('#case-back'),next=form.querySelector('#case-next');
 function showStep(){form.querySelectorAll('[data-stage]').forEach((node,i)=>node.hidden=i!==step);form.querySelectorAll('.intake-steps span').forEach((node,i)=>{if(i===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});back.hidden=step===0;next.hidden=step===2;submit.hidden=step!==2;form.querySelector('.intake-summary').textContent=form.elements.customerName.value.trim()+' · The Light & Story Workshop · $128.00 USD · '+(mode.value==='sandbox'?'Awaiting PayPal sandbox checkout':'Fictional sample payment');}
 next.onclick=()=>{if(step===0&&!form.elements.customerName.reportValidity())return;step=Math.min(2,step+1);showStep();};
 back.onclick=()=>{if(pending)return;step=Math.max(0,step-1);showStep();};
 const help=()=>{dialog.querySelector('#case-mode-help').textContent=mode.value==='sandbox'?'Creates an unpaid case. Continue to the checkout desk, unlock configured integrations, and pay with a sandbox buyer. Do not restart the story: keep this case selected.':'Creates a fictional completed payment with missing access. No PayPal request or real customer change occurs.';};
 mode.onchange=help;
 open.onclick=()=>{if(isBusy())return; if(!requestId){requestId=crypto.randomUUID();form.reset();step=0;}error.textContent='';help();showStep();dialog.showModal();};
 dialog.querySelector('#cancel-case').onclick=()=>{if(!pending){dialog.close();open.focus();}};
 dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
 form.onsubmit=async e=>{e.preventDefault();if(pending)return;if(step<2){next.click();return;}pending=true;back.disabled=true;error.textContent='';submit.disabled=true;dialog.querySelector('#cancel-case').disabled=true;
 const input=savedInput||{requestId,customerName:form.elements.customerName.value,mode:mode.value};
 try{
  const result=backend?await api('action',{action:'create-case',...input}):{state:newCase(input)};
  await onCreated(result.state);requestId=null;savedInput=null;form.elements.customerName.disabled=false;mode.disabled=false;dialog.close();
 }catch(err){error.textContent=err.message+' No access change was requested.';
  if(backend&&err.code!=='rejected'){savedInput=input;form.elements.customerName.disabled=true;mode.disabled=true;error.textContent+=' Retry uses the same request to avoid a duplicate case.';}
 }finally{pending=false;back.disabled=false;submit.disabled=false;dialog.querySelector('#cancel-case').disabled=false;}
 };
}
