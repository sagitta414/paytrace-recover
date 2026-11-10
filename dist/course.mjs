import {esc,request} from './customer-shared.mjs';

const root=document.querySelector('#course-app');
let current;
const supportHref='customer.html?from=course';
const returnToLesson=new URLSearchParams(location.search).get('lesson')==='light-01';
const purchaseContext=(()=>{try{const value=JSON.parse(sessionStorage.getItem('paytrace-course-purchase')||'null');return value&&typeof value.requestId==='string'&&typeof value.orderId==='string'&&typeof value.email==='string'?value:null;}catch{return null;}})();

function shell(s){
  const ready=s.verified&&!s.paymentHold;
  const mode=s.mode==='sandbox'||s.sample===false?'Sandbox purchase':s.mode==='sample'?'Fictional sample':'Purchase demo';
  root.removeAttribute('role');root.removeAttribute('aria-live');
  root.innerHTML=`
    <div class="frame classroom" id="lesson">
      <div class="classroom-top"><div><span class="eyebrow">LIGHT & STORY / YOUR WORKSHOP</span><h1>Find your light</h1><p>A practical photography lesson to do at home, at your own pace.</p></div><a class="quiet-link" href="${supportHref}">Purchase & support <span aria-hidden="true">↗</span></a></div>
      <div class="classroom-layout">
        <aside class="course-rail" aria-label="Workshop navigation">
          <div class="rail-title"><span class="eyebrow">YOUR COURSE</span><strong>The Light & Story Workshop</strong></div>
          <div class="rail-unit"><span class="unit-number">01</span><span><strong>Find your light</strong><small>${ready?'Available now':'Awaiting access'}</small></span><span aria-hidden="true">→</span></div>
          <div class="rail-note"><span class="eyebrow">YOUR ACCESS</span><strong>${s.paymentHold?'Purchase under review':ready?'Lesson ready':'Access being checked'}</strong><p>${ready?'Your purchase and course access have been verified. We’ll check again when you open the lesson.':s.paymentHold?'Your purchase needs review before the lesson can open.':'Your purchase may be complete. We’re waiting for access to be verified; you do not need to buy it again.'}</p><a class="support-action" href="${supportHref}">Unable to access course</a></div>
          <p class="rail-meta">${esc(mode)} · Case ${esc(s.caseId)}</p>
        </aside>
        <div class="lesson-stage">
          <div class="lesson-cover"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" alt="Window light casts the shadow of a vase and flowers across a wall"><div class="cover-label"><span>LESSON 01</span><strong>Find your light</strong></div></div>
          <div class="lesson-panel"><div class="lesson-kicker"><span class="eyebrow">A PRACTICAL EXERCISE</span><span class="access-badge ${ready?'is-ready':'is-locked'}">${ready?'Ready to begin':'Access pending'}</span></div><h2>Photograph the familiar in a new light.</h2><p class="lesson-lede">You only need a familiar object, a window, and a little time to look closely.</p>
            <div class="lesson-action"><div><strong>${ready?'Your lesson is ready':'Full lesson not available yet'}</strong><span>${ready?'Open the lesson to see the complete exercise.':'Your private case has this workshop and purchase attached. Follow it without entering the order again.'}</span></div>${ready?'<button class="action" id="open-lesson" type="button">Open lesson <span aria-hidden="true">→</span></button>':`<a class="action" href="${supportHref}">Unable to access course <span aria-hidden="true">→</span></a>`}</div>
            <div id="lesson-result" aria-live="polite"></div>
          </div>
          <div class="lesson-bottom"><div><span class="eyebrow">ABOUT THIS WORKSHOP</span><p>One lesson on natural light, observation, and composition. Work through it whenever your access is active.</p></div><a class="quiet-link" href="${supportHref}">Purchase & support <span aria-hidden="true">↗</span></a></div>
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
  const fromCheckout=new URLSearchParams(location.search).get('from')==='checkout';
  if(!fromCheckout){try{current=await request('/api/customer/case');shell(current);if(returnToLesson&&current.verified&&!current.paymentHold)await openLesson();return;}catch{}}
  {
    root.removeAttribute('role');root.removeAttribute('aria-live');
    document.querySelector('.site-head nav a[href="#lesson"]')?.setAttribute('href','#lesson-outline');
    const signInLink=document.querySelector('.site-head nav a[href="customer.html?from=course"]');
    if(signInLink){signInLink.href='#learner-sign-in';signInLink.textContent='Sign in';}
    root.innerHTML=`
      <div class="public-course" id="lesson">
        <section class="frame public-hero" aria-labelledby="studio-heading">
          <div class="public-intro"><p class="course-type">A photography workshop to take at home</p><h1 id="studio-heading">The Light &amp; Story Workshop</h1><p class="public-lede">Begin with something already in your home. Watch how window light falls across it, change your position, and make a few frames.</p><div class="hero-actions"><a class="action" href="store-demo.html?scenario=missing-access&from=course">Buy the workshop · $128 <span aria-hidden="true">→</span></a><a class="quiet-link" href="#lesson-outline">Explore the lesson <span aria-hidden="true">↓</span></a></div><p class="access-hint">Demo purchase through PayPal sandbox · no live charge. Already enrolled? <a href="#learner-sign-in">Sign in to your course</a>.</p></div>
          <figure class="public-photo"><img src="assets/course/photographer-room.jpg" width="1500" height="2100" alt="A photographer holding a camera in a light-filled room"><figcaption>Photography at home, with the light that’s there.</figcaption></figure>
        </section>
        <div class="frame course-facts" aria-label="Workshop details"><span>One focused lesson</span><span>At your own pace</span><span>Any camera will do</span></div>
        <section class="frame course-detail" id="lesson-outline" aria-labelledby="detail-heading"><div class="detail-intro"><p class="course-type">A glimpse of lesson one</p><h2 id="detail-heading">See what a window can do.</h2><p>Choose an object you pass every day and place it near a window. Before you take a picture, spend a moment looking at how the light falls across it.</p><ol class="practice-list"><li>Notice where the brightest light lands.</li><li>Move around the object and try a new angle.</li><li>Take two frames and compare the shadows.</li></ol><a class="quiet-link outline-sign-in" href="#learner-sign-in">Already purchased? Sign in <span aria-hidden="true">→</span></a></div><div class="detail-lesson"><img src="assets/course/shadow-still-life.webp" width="1600" height="1067" loading="lazy" alt="The soft silhouette of flowers in warm window light"><div><span class="lesson-index">Lesson 01</span><h3>Find your light</h3><p>Work through a guided exercise in natural light and composition, then choose the frame that says the most with the least.</p><span class="lesson-state">The full exercise opens when access is verified</span></div></div></section>
        <section class="frame learner-entry" id="learner-sign-in" aria-labelledby="sign-in-heading"><div class="entry-intro"><p class="course-type">Your workshop</p><h2 id="sign-in-heading">Pick up where you left off.</h2><p>After checkout, enter your order number and purchase email to check whether the full lesson is ready.</p><div class="entry-help"><strong>What happens next?</strong><p>If the lesson is still locked, we’ll guide you to PayTrace support with your purchase attached.</p></div></div><form class="entry-form" id="course-sign-in"><span class="eyebrow">COURSE ACCESS CHECK</span><label for="course-reference">Order number</label><input id="course-reference" name="reference" required maxlength="150" autocomplete="off" aria-describedby="sign-in-note"><label for="course-email">Email used at checkout</label><input id="course-email" name="email" type="email" required maxlength="254" autocomplete="email"><button class="action" type="submit">Sign in to my course <span aria-hidden="true">→</span></button><p id="sign-in-note">Use the order number shown after checkout and the email entered for that purchase.</p><div id="course-sign-in-status" role="status" aria-live="polite"></div><div id="course-access-result" hidden></div></form></section>
      </div>`;
    root.querySelector('#course-sign-in')?.addEventListener('submit',requestCourseLink);
    if(purchaseContext){root.querySelector('#course-reference').value=purchaseContext.orderId;root.querySelector('#course-email').value=purchaseContext.email;}
    if(fromCheckout)requestAnimationFrame(()=>root.querySelector('#learner-sign-in')?.scrollIntoView());
  }
}
async function requestCourseLink(event){
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button'),status=form.querySelector('#course-sign-in-status');
  const resultBox=form.querySelector('#course-access-result');resultBox.hidden=true;resultBox.replaceChildren();
  button.disabled=true;button.textContent='Checking your purchase…';status.textContent='';status.classList.remove('is-error');
  try{
    if(!purchaseContext)throw Error('For this sandbox test, complete checkout in this browser first.');
    const details={requestId:purchaseContext.requestId,reference:form.elements.reference.value.trim(),email:form.elements.email.value.trim()};
    const result=await request('/api/course/demo-check',details);
    resultBox.hidden=false;resultBox.className='course-access-result '+(result.state==='locked'?'access-locked':'access-ready');
    resultBox.innerHTML=`<span class="eyebrow">${result.state==='locked'?'ACCESS NOT AVAILABLE':'ACCESS READY'}</span><h3 tabindex="-1">${result.state==='locked'?'We found your order. The lesson is still locked.':'Your lesson is ready.'}</h3><p>${esc(result.message)}</p><button class="support-action" id="course-help" type="button">${result.state==='locked'?'Trouble accessing course':'Open my private purchase'} <span aria-hidden="true">→</span></button><p id="course-help-status" role="status"></p>`;
    const helpButton=resultBox.querySelector('#course-help');helpButton.addEventListener('click',async()=>{helpButton.disabled=true;helpButton.textContent='Opening PayTrace support…';try{const help=await request('/api/course/demo-help',{...details,helpId:crypto.randomUUID()});location.href='customer.html?from=course#'+encodeURIComponent(help.token);}catch(error){resultBox.querySelector('#course-help-status').textContent=error.message;helpButton.disabled=false;helpButton.textContent='Try opening PayTrace support';}});
    resultBox.querySelector('h3').focus();
  }catch(error){status.textContent=purchaseContext?error.message:'We can’t verify this purchase in the current browser.';status.classList.add('is-error');if(!purchaseContext){resultBox.hidden=false;resultBox.className='course-access-result';resultBox.innerHTML='<span class="eyebrow">RETURNING TO YOUR WORKSHOP</span><h3>Use the browser where you checked out.</h3><p>If you no longer have access to that browser, ask the merchant for a private case link. Your order number and email cannot open the case on a new device by themselves. You do not need to buy again.</p><a class="support-action" href="customer.html?from=course">See purchase support options <span aria-hidden="true">→</span></a>';}}
  finally{button.disabled=false;button.innerHTML='Sign in to my course <span aria-hidden="true">→</span>';}
}
await init();
