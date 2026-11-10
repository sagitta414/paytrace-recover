import {esc,request} from './customer-shared.mjs';

const root=document.querySelector('#course-app');
let current;

function shell(s){
  const ready=s.verified&&!s.paymentHold;
  const mode=s.mode==='sandbox'||s.sample===false?'Sandbox purchase':s.mode==='sample'?'Fictional sample':'Purchase demo';
  root.removeAttribute('role');root.removeAttribute('aria-live');
  root.innerHTML=`
    <div class="frame classroom" id="lesson">
      <div class="classroom-top"><div><span class="eyebrow">LIGHT & STORY / YOUR WORKSHOP</span><h1>Find your light</h1><p>A practical photography lesson to do at home, at your own pace.</p></div><a class="quiet-link" href="customer.html">Purchase & support <span aria-hidden="true">↗</span></a></div>
      <div class="classroom-layout">
        <aside class="course-rail" aria-label="Workshop navigation">
          <div class="rail-title"><span class="eyebrow">YOUR COURSE</span><strong>The Light & Story Workshop</strong></div>
          <div class="rail-unit"><span class="unit-number">01</span><span><strong>Find your light</strong><small>${ready?'Available now':'Awaiting access'}</small></span><span aria-hidden="true">→</span></div>
          <div class="rail-note"><span class="eyebrow">YOUR ACCESS</span><strong>${s.paymentHold?'Purchase under review':ready?'Lesson ready':'Access being checked'}</strong><p>${ready?'Your purchase and course access have been verified. We’ll check again when you open the lesson.':s.paymentHold?'Your purchase needs review before the lesson can open.':'Your purchase may be complete. We’re waiting for access to be verified; you do not need to buy it again.'}</p><a class="support-action" href="customer.html">Unable to access course</a></div>
          <p class="rail-meta">${esc(mode)} · Case ${esc(s.caseId)}</p>
        </aside>
        <div class="lesson-stage">
          <div class="lesson-cover"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" alt="Window light casts the shadow of a vase and flowers across a wall"><div class="cover-label"><span>LESSON 01</span><strong>Find your light</strong></div></div>
          <div class="lesson-panel"><div class="lesson-kicker"><span class="eyebrow">A PRACTICAL EXERCISE</span><span class="access-badge ${ready?'is-ready':'is-locked'}">${ready?'Ready to begin':'Access pending'}</span></div><h2>Photograph the familiar in a new light.</h2><p class="lesson-lede">You only need a familiar object, a window, and a little time to look closely.</p>
            <div class="lesson-action"><div><strong>${ready?'Your lesson is ready':'Full lesson not available yet'}</strong><span>${ready?'Open the lesson to see the complete exercise.':'The complete exercise opens after your course access is verified.'}</span></div>${ready?'<button class="action" id="open-lesson" type="button">Open lesson <span aria-hidden="true">→</span></button>':'<a class="action" href="customer.html">Check purchase status <span aria-hidden="true">→</span></a>'}</div>
            <div id="lesson-result" aria-live="polite"></div>
          </div>
          <div class="lesson-bottom"><div><span class="eyebrow">ABOUT THIS WORKSHOP</span><p>One lesson on natural light, observation, and composition. Work through it whenever your access is active.</p></div><a class="quiet-link" href="customer.html">Purchase & support <span aria-hidden="true">↗</span></a></div>
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
    document.querySelector('.site-head nav a[href="#lesson"]')?.setAttribute('href','#lesson-outline');
    root.innerHTML=`
      <div class="public-course" id="lesson">
        <section class="frame public-hero" aria-labelledby="studio-heading">
          <div class="public-intro"><p class="course-type">Photography / course overview</p><h1 id="studio-heading">The Light &amp; Story Workshop</h1><p class="public-lede">A practical introduction to photographing everyday subjects in natural light. Work at home, at your own pace, with one focused lesson.</p><div class="hero-actions"><a class="action" href="#lesson-outline">Explore the lesson <span aria-hidden="true">↓</span></a><a class="support-action" href="customer.html">Unable to access course <span aria-hidden="true">↗</span></a></div><p class="access-hint">Your full lesson opens from the private link connected to your purchase.</p></div>
          <figure class="public-photo"><img src="assets/course/photographer-room.jpg" width="1500" height="2100" alt="A photographer using a camera in a bright room"><figcaption>A quiet moment with a camera, at home.</figcaption></figure>
        </section>
        <div class="frame course-facts" aria-label="Course details"><div><span>Format</span><strong>Self-paced exercise</strong></div><div><span>Lessons</span><strong>One focused lesson</strong></div><div><span>Where</span><strong>At home, in natural light</strong></div></div>
        <section class="frame course-detail" id="lesson-outline" aria-labelledby="detail-heading"><div class="detail-intro"><p class="course-type">Course outline</p><h2 id="detail-heading">Learn to see the light you already have.</h2><p>Practice observing a simple scene, choosing a composition, and noticing how light changes the result.</p><ul class="practice-list"><li>Notice the direction and quality of daylight</li><li>Frame a familiar subject with intention</li><li>Compare the photographs you make</li></ul></div><div class="detail-lesson"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" loading="lazy" alt="A vase and flowers casting a shadow in window light"><div><span class="lesson-index">01 / Your lesson</span><h3>Find your light</h3><p>A guided exercise in natural light and composition. The complete instructions are available after your course access is verified.</p><span class="lesson-state">Full lesson opens with verified access</span></div></div></section>
        <section class="frame course-help" aria-labelledby="course-help-heading"><div><p class="course-type">Access support</p><h2 id="course-help-heading">Paid for the workshop but the lesson is locked?</h2><p>Check your purchase and follow the recovery case. You can tell the merchant what happens when you try to open the course.</p></div><a class="support-action" href="customer.html">Unable to access course <span aria-hidden="true">↗</span></a></section>
      </div>`;
  }
}
await init();
