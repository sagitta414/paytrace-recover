import {newCase} from './new-case-model.mjs';
export function mountNewCase({backend,api,onCreated,isBusy}){
 const toolbar=document.createElement('div');toolbar.className='case-create-toolbar';
 const open=document.createElement('button');open.className='button primary';open.textContent='+ New case';open.type='button';toolbar.append(open);
 document.querySelector('#focus-app').before(toolbar);
 const dialog=document.createElement('dialog');dialog.className='new-case-dialog';dialog.setAttribute('aria-labelledby','new-case-title');
 dialog.innerHTML=`<form id="new-case-form"><div class="eyebrow">RECOVERY DESK</div><h2 id="new-case-title">Start with a purchase.</h2><p>Create a case for the demo course. Access changes still require evidence, your approval, and verification.</p><label>Customer display name<input name="customerName" required maxlength="80" autocomplete="off" placeholder="e.g. Alex" autofocus></label><p class="footnote">Use a fictional name while testing. A unique demo learner is created for this case.</p><label>Payment source<select name="mode"><option value="sandbox" ${backend?'':'disabled'}>PayPal sandbox · awaiting checkout</option><option value="sample" ${backend?'':'selected'}>Sample payment · simulated</option></select></label><div class="new-case-course"><strong>The Light &amp; Story Workshop</strong><span>$128.00 USD · demo course service</span></div><p id="case-mode-help"></p><p class="new-case-error" role="alert"></p><div class="new-case-actions"><button type="button" class="button" id="cancel-case">Cancel</button><button type="submit" class="button primary">Create case</button></div></form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),error=dialog.querySelector('[role=alert]'),mode=form.elements.mode,submit=form.querySelector('[type=submit]');
 let requestId=null,pending=false,savedInput=null;
 const help=()=>{dialog.querySelector('#case-mode-help').textContent=mode.value==='sandbox'?'Creates an unpaid case. Continue to the checkout desk, unlock configured integrations, and pay with a sandbox buyer. Do not restart the story: keep this case selected.':'Creates a fictional completed payment with missing access. No PayPal request or real customer change occurs.';};
 mode.onchange=help;
 open.onclick=()=>{if(isBusy())return; if(!requestId){requestId=crypto.randomUUID();form.reset();}error.textContent='';help();dialog.showModal();};
 dialog.querySelector('#cancel-case').onclick=()=>{if(!pending){dialog.close();open.focus();}};
 dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
 form.onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;error.textContent='';submit.disabled=true;dialog.querySelector('#cancel-case').disabled=true;
 const input=savedInput||{requestId,customerName:form.elements.customerName.value,mode:mode.value};
 try{
  const result=backend?await api('action',{action:'create-case',...input}):{state:newCase(input)};
  await onCreated(result.state);requestId=null;savedInput=null;form.elements.customerName.disabled=false;mode.disabled=false;dialog.close();
 }catch(err){error.textContent=err.message+' No access change was requested.';
  if(backend&&err.code!=='rejected'){savedInput=input;form.elements.customerName.disabled=true;mode.disabled=true;error.textContent+=' Retry uses the same request to avoid a duplicate case.';}
 }finally{pending=false;submit.disabled=false;dialog.querySelector('#cancel-case').disabled=false;}
 };
}
