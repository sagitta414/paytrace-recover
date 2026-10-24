import {esc,when} from './customer-shared.mjs';
export function customerNext(s){
 if(s.help)return {owner:'Merchant',title:'Your request is still open',detail:'You have asked for more help. Describe what is still going wrong in the conversation below.'};
 if(s.request)return {owner:'You',title:'The merchant needs your reply',detail:s.request};
 if(s.verified&&s.confirmedAt)return {owner:'No action needed',title:'You confirmed that access works',detail:'Your confirmation is recorded. You can return here if you need more help.'};
 if(s.verified)return {owner:'You',title:'Try opening your purchase',detail:'The technical check passed. Open the purchase, then let the merchant know whether it works for you.'};
 return {owner:'Merchant',title:'Your purchase is being reviewed',detail:s.next||'The merchant will check the purchase and record the next update here.'};
}
export function customerNextMarkup(s){const next=customerNext(s),last=s.messages?.at(-1);return `<section class="customer-next"><div class="customer-next-icon" aria-hidden="true">${s.verified&&!s.help?'✓':'↗'}</div><div><span class="customer-eyebrow">UP NEXT · ${esc(next.owner)}</span><h2>${esc(next.title)}</h2><p>${esc(next.detail)}</p>${last?`<small>Latest message · ${esc(when(last.at))}</small>`:'<small>No messages recorded yet. You can start the conversation below.</small>'}</div></section>`;}
export function customerProgressMarkup(s){
 const stage=Math.max(0,Math.min(3,Number(s.status)||0));
 const labels=['Request received','Reviewing purchase','Updating access','Technical access check',s.help?'Follow-up open':'Your confirmation'];
 return `<ol class="customer-progress" aria-label="Purchase recovery progress">${labels.map((label,i)=>{
  const done=i<4?i<=stage&&!(i===3&&!s.verified):!!s.confirmedAt&&s.verified&&!s.help;
  const current=i===4?(s.help||s.verified&&!s.confirmedAt):i===stage&&!s.verified;
  return `<li class="${done?'done':s.help&&i===4?'reopened':''}" ${current?'aria-current="step"':''}><strong>${done?'✓':String(i+1).padStart(2,'0')}</strong>${label}</li>`;
 }).join('')}</ol>`;
}
export function mountCustomerClarity(root,s,{pending=false}={}){
 root.querySelector('.customer-hero')?.insertAdjacentHTML('afterend',customerNextMarkup(s));
 const form=root.querySelector('#reply'),input=root.querySelector('#message');if(!form||!input)return;
 const starters=document.createElement('div');starters.className='customer-starters';starters.setAttribute('aria-label','Message starters');
 const choices=[['Ask for an update','Could you share the latest update on my purchase?'],['Access still missing','I still cannot access my purchase. Here is what happens when I try: '],['Wrong account?','I may be signed in with a different account. What should I check?']];
 starters.innerHTML='<span>Not sure what to say?</span>'+choices.map(([label],i)=>`<button type="button" data-starter="${i}" ${pending?'disabled':''}>${label}</button>`).join('');form.prepend(starters);
 starters.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(pending||input.disabled)return;const text=choices[Number(b.dataset.starter)][1];input.value=(input.value.trim()?input.value+'\n\n'+text:text).slice(0,2000);input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();});
 const counter=document.createElement('span');counter.className='customer-character-count';input.after(counter);const update=()=>{counter.textContent=input.value.length+' / 2,000 characters';};input.addEventListener('input',update);update();
 input.disabled=pending;
}
