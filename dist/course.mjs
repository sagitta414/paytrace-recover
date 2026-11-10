import {esc,request} from './customer-shared.mjs';

const root=document.querySelector('#course-app');
let current;

function shell(s){
  const ready=s.verified&&!s.paymentHold;
  const mode=s.mode==='sandbox'||s.sample===false?'Sandbox purchase':s.mode==='sample'?'Fictional sample':'Purchase demo';
  root.removeAttribute('role');root.removeAttribute('aria-live');
  root.innerHTML=`
    <div class="frame classroom" id="lesson">
      <div class="classroom-top"><div><span class="eyebrow">THE LIGHT & STORY WORKSHOP</span><h1>Your classroom</h1><p>One practical exercise in seeing ordinary light differently.</p></div><a class="quiet-link" href="customer.html">View purchase & support <span aria-hidden="true">↗</span></a></div>
      <div class="classroom-layout">
        <aside class="course-rail" aria-label="Workshop navigation">
          <div class="rail-title"><span class="eyebrow">COURSE GUIDE</span><strong>The Light & Story Workshop</strong></div>
          <div class="rail-unit"><span class="unit-number">01</span><span><strong>Find your light</strong><small>${ready?'Available now':'Awaiting access'}</small></span><span aria-hidden="true">→</span></div>
          <div class="rail-note"><span class="eyebrow">YOUR ACCESS</span><strong>${s.paymentHold?'Purchase under review':ready?'Lesson ready':'Access being checked'}</strong><p>${ready?'Your purchase and course access have been verified. We’ll check again when you open the lesson.':s.paymentHold?'Your purchase needs review before the lesson can open.':'Your purchase may be complete. We’re waiting for access to be verified; you do not need to buy it again.'}</p><a href="customer.html">See case progress <span aria-hidden="true">↗</span></a></div>
          <p class="rail-meta">${esc(mode)} · Case ${esc(s.caseId)}</p>
        </aside>
        <div class="lesson-stage">
          <div class="lesson-cover"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" alt="Window light casts the shadow of a vase and flowers across a wall"><div class="cover-label"><span>WORKSHOP / 01</span><strong>Find your light</strong></div></div>
          <div class="lesson-panel"><div class="lesson-kicker"><span class="eyebrow">LESSON 01 · FIELD EXERCISE</span><span class="access-badge ${ready?'is-ready':'is-locked'}">${ready?'Ready to begin':'Access pending'}</span></div><h2>Start with the light<br>you already have.</h2><p class="lesson-lede">An everyday object becomes your subject. Notice what the light changes before you make the frame.</p>
            <div class="lesson-action"><div><strong>${ready?'Your lesson is ready':'Full exercise locked'}</strong><span>${ready?'Open the lesson to begin the exercise.':'The full exercise opens only when this purchase has verified course access.'}</span></div>${ready?'<button class="action" id="open-lesson" type="button">Begin lesson <span aria-hidden="true">→</span></button>':'<a class="action" href="customer.html">Check access <span aria-hidden="true">→</span></a>'}</div>
            <div id="lesson-result" aria-live="polite"></div>
          </div>
          <div class="lesson-bottom"><div><span class="eyebrow">ABOUT THIS WORKSHOP</span><p>A focused photography exercise about light, observation, and composition. The workshop currently has one available lesson.</p></div><a class="quiet-link" href="customer.html">Questions about access? <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
    </div>`;
  root.querySelector('#open-lesson')?.addEventListener('click',openLesson);
}

function lessonView(lesson){
  const sentences=String(lesson.body||'').match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean)||[];
  const steps=sentences.map((sentence,i)=>`<li><span class="exercise-number">${String(i+1).padStart(2,'0')}</span><p>${esc(sentence)}</p></li>`).join('');
  return `<section class="opened-lesson" aria-labelledby="opened-heading"><div class="opened-head"><span class="eyebrow">YOUR EXERCISE</span><h3 id="opened-heading" tabindex="-1">${esc(lesson.title)}</h3><p>Take your time. You can return to this exercise whenever your access is active.</p></div><ol class="exercise-steps">${steps}</ol><div class="opened-foot"><strong>Look at what changed.</strong><p>Compare your frames and notice which direction of light best tells the story you wanted to show.</p></div></section>`;
}

async function openLesson(){
  const button=root.querySelector('#open-lesson'),target=root.querySelector('#lesson-result');
  button.disabled=true;button.textContent='Opening your lesson…';
  try{
    const lesson=await request('/api/customer/lesson?caseId='+encodeURIComponent(current.caseId));
    target.innerHTML=lessonView(lesson);
    button.remove();
    root.querySelector('.lesson-action strong').textContent='Exercise open';
    root.querySelector('.lesson-action div>span').textContent='Your first lesson is below.';
    root.querySelector('.access-badge').textContent='Lesson open';
    target.querySelector('#opened-heading')?.focus();
    if(lesson.browserChallenge&&crypto.subtle){try{const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(lesson.body)))).map(x=>x.toString(16).padStart(2,'0')).join('');await request('/api/customer/browser-proof',{caseId:current.caseId,token:lesson.browserChallenge,digest});}catch{target.insertAdjacentHTML('beforeend','<p class="receipt-note">The lesson opened, but its separate browser receipt was not recorded.</p>');}}
  }catch(error){target.innerHTML=`<p class="error" role="alert">${esc(error.message)} <a href="customer.html">Check your private case</a> or try again.</p>`;button.disabled=false;button.textContent='Try opening the lesson';}
}

async function init(){
  try{current=await request('/api/customer/case');shell(current);}
  catch{
    root.removeAttribute('role');root.removeAttribute('aria-live');
    root.innerHTML=`
      <section class="studio-entry" id="lesson" aria-labelledby="studio-heading">
        <div class="frame studio-topline"><span>LIGHT & STORY / THE WORKSHOP</span><span>AN EXERCISE IN SEEING</span></div>
        <div class="frame studio-main">
          <div class="studio-copy">
            <span class="studio-mark"><span aria-hidden="true"></span> A PHOTOGRAPHY WORKSHOP</span>
            <h1 id="studio-heading">Notice the light.<br><em>Find the story.</em></h1>
            <p>Photography begins with attention. Start with one familiar subject and discover how light can change the way you see it.</p>
            <div class="studio-actions"><a class="action studio-action" href="customer.html">Open your purchase <span aria-hidden="true">↗</span></a><span>Your private purchase link opens the lesson.</span></div>
          </div>
          <figure class="studio-visual"><div class="studio-image-window"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" alt="Golden window light casts a vase and flower shadow across a wall"></div><figcaption><span>STUDY 01 / NATURAL LIGHT</span><span>THE LIGHT & STORY WORKSHOP</span></figcaption></figure>
        </div>
        <div class="frame studio-bottom"><span>ONE LESSON. A NEW WAY TO SEE.</span><span>OBSERVE <b aria-hidden="true">/</b> FRAME <b aria-hidden="true">/</b> COMPARE</span></div>
      </section>`;
  }
}
await init();
