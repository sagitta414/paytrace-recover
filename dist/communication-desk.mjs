import {esc,when,request} from './customer-shared.mjs';

export function timelineEntries(state,support){
 const events=(state.events||[]).map((event,i)=>({id:'event-'+i,at:event.at,text:event.what,category:'system',label:'Recovery event · internal'}));
 const messages=(support?.messages||[]).map(message=>({id:message.id,at:message.at,text:message.text,category:message.kind==='internal'?'private':'conversation',label:message.kind==='internal'?'Private admin note':message.role==='customer'?'Customer message':message.role==='automatic'?'Automatic customer update':message.role==='ai-assisted'?'AI-assisted reply · merchant reviewed':'Merchant reply · customer visible'}));
 return [...events,...messages].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}

export function timelineMarkup(entries,filter='all'){
 const filtered=entries.filter(entry=>filter==='all'||entry.category===filter);
 return filtered.length?`<ol class="communication-events">${filtered.map(entry=>`<li class="event-${entry.category}"><span class="communication-dot" aria-hidden="true"></span><div><header><strong>${esc(entry.label)}</strong><time>${esc(when(entry.at))}</time></header><p>${esc(entry.text)}</p></div></li>`).join('')}</ol>`:'<p class="communication-empty">No recorded updates in this view.</p>';
}

export function mountTimeline(root,state,support){
 const target=root.querySelector('.case-evidence-column');if(!target)return;
 let panel=target.querySelector('.communication-timeline');
 const previous=panel?.querySelector('[aria-pressed="true"]')?.dataset.timelineFilter||'all';
 if(!panel){panel=document.createElement('section');panel.className='communication-timeline';target.append(panel);}
 const entries=timelineEntries(state,support);
 panel.innerHTML=`<span class="eyebrow">THE COMPLETE CASE RECORD</span><h2>Every update. One timeline.</h2><p>Recovery events, customer messages, and private notes. The Conversation filter contains customer-visible messages. Recovery events and private notes stay in this workspace.</p><div class="communication-tabs" aria-label="Timeline filters">${[['all','All updates'],['conversation','Conversation'],['system','Recovery'],['private','Private notes']].map(([id,label])=>`<button type="button" data-timeline-filter="${id}" aria-pressed="${id===previous}">${label}</button>`).join('')}</div><div class="communication-event-list">${timelineMarkup(entries,previous)}</div><small>Newest first · ${entries.length} available records. Recovery history may be limited to the most recent events.</small>`;
 panel.querySelectorAll('[data-timeline-filter]').forEach(button=>button.onclick=()=>{panel.querySelectorAll('[data-timeline-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));panel.querySelector('.communication-event-list').innerHTML=timelineMarkup(entries,button.dataset.timelineFilter);});
 for(const detail of target.querySelectorAll('details.detail'))if(detail.querySelector('summary')?.textContent.startsWith('Recovery timeline'))detail.remove();
}

export function mountInbox(root,onSelect){
 const box=document.createElement('section');box.className='support-inbox communication-inbox';root.querySelector('.overview')?.after(box);if(!box.isConnected)root.prepend(box);
 let items=[],filter='all',query='',loading=false;
 function render(note=''){
 const visible=items.filter(item=>(filter==='all'||item.kind===filter)&&`${item.customerName} ${item.caseId} ${item.preview||''}`.toLowerCase().includes(query.toLowerCase()));
 box.innerHTML=`<div class="communication-inbox-head"><div><span class="eyebrow">CUSTOMER INBOX</span><h2>${items.length?`${items.length} conversation${items.length===1?' needs':'s need'} a follow-up.`:'Stay close to every customer.'}</h2><p>Reply-needed status comes from the conversation, not an unread counter.</p></div><button class="button" data-inbox-refresh ${loading?'disabled':''}>${loading?'Checking…':'Refresh inbox'}</button></div><div class="communication-inbox-tools"><div class="communication-tabs" aria-label="Inbox filters">${[['all','All follow-ups'],['help','Still needs help'],['reply','Customer replied']].map(([id,label])=>`<button type="button" data-inbox-filter="${id}" aria-pressed="${filter===id}">${label}${id==='all'?'':` · ${items.filter(item=>item.kind===id).length}`}</button>`).join('')}</div><input type="search" aria-label="Search customer inbox" placeholder="Find a customer, case, or message" value="${esc(query)}"></div><p class="communication-inbox-status" role="status">${esc(note)}</p><div class="communication-inbox-list">${visible.map((item,i)=>`<button class="communication-inbox-row" data-inbox-open="${i}"><span class="inbox-monogram" aria-hidden="true">${esc(item.customerName.slice(0,1))}</span><span class="inbox-person"><strong>${esc(item.customerName)}</strong><small>${esc(item.caseId)}${item.at?' · '+esc(when(item.at)):''}</small><span>${esc(item.preview||item.text)}</span></span><span class="inbox-reason ${item.kind==='help'?'needs-help':''}">${item.kind==='help'?'Still needs help':'Reply needed'}</span><span aria-hidden="true">↗</span></button>`).join('')||`<div class="communication-empty">${loading?'Retrieving customer follow-ups…':note?'The inbox could not be confirmed. Retry above.':query?'No matching conversations. Try another search.':filter==='all'?'No customer follow-ups are waiting. New replies will appear after you refresh.':'No conversations in this category.'}</div>`}</div>`;
 box.querySelector('[data-inbox-refresh]').onclick=load;
 box.querySelectorAll('[data-inbox-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.inboxFilter;render(note);});
 box.querySelectorAll('[data-inbox-open]').forEach(button=>button.onclick=()=>onSelect(visible[Number(button.dataset.inboxOpen)].caseId));
 box.querySelector('input').oninput=e=>{query=e.target.value;const position=e.target.selectionStart;render(note);const field=box.querySelector('input');field.focus();try{field.setSelectionRange(position,position);}catch{}};
 }
 async function load(){if(loading)return;loading=true;render();try{const result=await request('/api/support/inbox');if(!box.isConnected)return;if(!Array.isArray(result.items))throw Error('Unexpected inbox response.');items=result.items.sort((a,b)=>Number(b.kind==='help')-Number(a.kind==='help')||(Date.parse(b.at)||0)-(Date.parse(a.at)||0));loading=false;render();}catch{loading=false;if(box.isConnected)render('Could not refresh the inbox. Previously loaded conversations may be out of date.');}}
 load();
}
