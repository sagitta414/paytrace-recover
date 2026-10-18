import {decisionBrief,outcomeFacts} from './story-model.mjs';
import {briefMarkup,factsMarkup,downloadFacts} from './story-components.mjs';
import {request} from './customer-shared.mjs';
export function mountStory(root,s,{backend}){
 if(!s)return;const rail=root.querySelector('.case-decision-column'),main=root.querySelector('.case-evidence-column');if(!rail||!main)return;
 const brief=document.createElement('section');brief.className='story-brief-panel';brief.innerHTML='<span class="eyebrow">DECISION AT A GLANCE</span><h3>The evidence, in plain language.</h3>'+briefMarkup(decisionBrief(s));rail.append(brief);
 const receipt=document.createElement('section');receipt.className='story-brief-panel';main.append(receipt);
 const show=(support=null,failed=false)=>{const facts=outcomeFacts(s,support);receipt.innerHTML='<span class="eyebrow">MEASURED OUTCOME</span><h3>System proof. Customer confirmation.</h3>'+factsMarkup(facts)+(failed?'<p>Customer updates could not be retrieved. Confirmation and message count are unconfirmed.</p>':'')+'<button class="button">Download outcome facts</button><p><a href="story.html">Follow the interactive recovery story ↗</a></p>';receipt.querySelector('button').onclick=()=>downloadFacts(facts);};show();
 if(backend)request('/api/support?caseId='+encodeURIComponent(s.id)).then(d=>{if(receipt.isConnected)show(d);}).catch(()=>{if(receipt.isConnected)show(null,true);});
}
