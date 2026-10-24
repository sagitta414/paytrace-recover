import {proofIsCurrent} from './operations.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function caseChapter(s, support = null, {backend = false, uncertain = false} = {}) {
  const verified = proofIsCurrent(s) && !uncertain;
  if (uncertain) return {
    number: '—', phase: 'STATUS NEEDS A CHECK', title: 'First, find out what happened.',
    customer: 'The customer needs a clear update, but the latest server result is not confirmed.',
    merchant: 'Refresh the case before approving, applying, or repeating any action.',
    owner: 'Merchant · refresh status', target: 'refresh', tone: 'caution'
  };
  if (support?.help) return {
    number: '06', phase: 'CUSTOMER FOLLOW-UP', title: 'The customer says it still does not work.',
    customer: 'Their report keeps the case open even if a technical check passed.',
    merchant: 'Acknowledge the message, review the new details, and recheck access without another grant.',
    owner: 'Merchant · respond to customer', target: 'communication', tone: 'caution'
  };
  if (s.job?.pending || s.phase === 'reviewing') return {
    number: '02', phase: 'INVESTIGATION RUNNING', title: 'The evidence review is still underway.',
    customer: 'Keep the customer informed that the purchase is being checked; no outcome is promised yet.',
    merchant: 'Refresh the workflow status before taking another action.',
    owner: 'Merchant · check workflow', target: 'refresh', tone: 'active'
  };
  if (s.phase === 'review-failed') return {
    number: '02', phase: 'REVIEW INTERRUPTED', title: 'The specialist review needs another attempt.',
    customer: 'The customer should not be told that a correction is ready.',
    merchant: 'Retry the evidence review after checking the source status.',
    owner: 'Merchant · retry review', target: 'decision', tone: 'caution'
  };
  if (s.phase === 'stale' || s.phase === 'needs-evidence' || s.review?.outcome === 'needs-evidence') return {
    number: '02', phase: 'MORE EVIDENCE NEEDED', title: 'The records need a fresh look.',
    customer: 'The merchant is still checking the purchase and has not approved an access change.',
    merchant: 'Refresh the payment and access records, then run a new review before previewing a correction.',
    owner: 'Merchant · check evidence', target: 'evidence', tone: 'caution'
  };
  if (s.review?.outcome === 'blocked' || s.phase === 'blocked') return {
    number: '03', phase: 'SAFE STOP', title: 'The purchase evidence does not support a grant.',
    customer: 'The customer needs an explanation and a specific request for the matching order reference.',
    merchant: 'Do not change access. Explain the mismatch and ask for the right purchase details.',
    owner: 'Merchant · request evidence', target: 'communication', tone: 'caution'
  };
  if (verified && support?.confirmedAt) return {
    number: '06', phase: 'CUSTOMER CONFIRMED', title: 'The customer can use the purchase.',
    customer: 'Technical access passed and the customer separately confirmed that it works.',
    merchant: 'Keep the outcome receipt and conversation available if they need help again.',
    owner: 'No action needed', target: 'receipt', tone: 'complete'
  };
  if (verified) return {
    number: '05', phase: 'TECHNICAL PROOF', title: 'The checks passed. Ask the customer to try it.',
    customer: support === null && backend ? 'Customer confirmation has not been loaded yet.' : 'The customer has not confirmed that the purchase works for them.',
    merchant: backend ? 'Share a private case link with the verified purchaser and invite them to open the lesson.' : 'Switch to the guided customer perspective to see how confirmation is separate from the technical check.',
    owner: backend ? 'Merchant · invite customer' : 'Demo · see customer view', target: backend ? 'communication' : 'customer-demo', tone: 'proof'
  };
  if (s.writes) return {
    number: '04', phase: 'CORRECTION APPLIED', title: 'Access changed. The outcome is still unknown.',
    customer: 'Do not tell the customer access is restored until the payment, entitlement, and lesson checks agree.',
    merchant: 'Run or retry verification. A failed read does not justify another access grant.',
    owner: 'Merchant · verify outcome', target: 'decision', tone: 'active'
  };
  if (s.phase === 'approved') return {
    number: '04', phase: 'APPROVAL RECORDED', title: 'One exact correction is approved.',
    customer: 'The purchased course is still locked until the approved action completes.',
    merchant: 'Apply the approved change once, then verify it independently.',
    owner: 'Merchant · apply correction', target: 'decision', tone: 'active'
  };
  if (s.phase === 'rehearsed') return {
    number: '03', phase: 'MERCHANT DECISION', title: 'The proposed change is ready for your decision.',
    customer: 'Access has not changed. The preview is only a copy of the proposed result.',
    merchant: 'Compare the before and after state, then explicitly approve this customer and course if the evidence holds.',
    owner: 'Merchant · decide', target: 'decision', tone: 'active'
  };
  if (s.review) return {
    number: '02', phase: 'EVIDENCE REVIEWED', title: 'The specialists have a recommendation.',
    customer: 'The customer should hear that the merchant is investigating, without a premature promise of restored access.',
    merchant: 'Read the findings and limitations, then preview the smallest correction.',
    owner: 'Merchant · preview change', target: 'decision', tone: 'active'
  };
  if (s.capture?.status === 'COMPLETED' && s.entitlement?.active) return {
    number: '05', phase: 'ACCESS FOUND', title: 'Access is present. Check the outcome.',
    customer: 'The course entitlement appears active, but the customer may still need a confirmed lesson check.',
    merchant: 'Verify the purchase and protected lesson without granting access again.',
    owner: 'Merchant · verify existing access', target: 'decision', tone: 'active'
  };
  if (s.capture?.status === 'COMPLETED') return {
    number: '01', phase: 'THE GAP', title: 'The payment succeeded. Access did not.',
    customer: 'The customer paid for a digital course and is waiting at a locked lesson.',
    merchant: 'Match the payment to the order, learner, course, amount, and current access before proposing a fix.',
    owner: 'Merchant · inspect evidence', target: 'evidence', tone: 'active'
  };
  return {
    number: '01', phase: 'PURCHASE NOT CONFIRMED', title: 'Confirm the payment before promising access.',
    customer: 'A purchase was started, but the payment evidence is not yet complete.',
    merchant: s.intakeMode === 'sandbox' ? 'Complete the PayPal sandbox checkout for this case, then review the resulting capture.' : 'Check the payment source before starting a correction.',
    owner: s.intakeMode === 'sandbox' ? 'Merchant · sandbox checkout' : 'Merchant · check payment', target: 'decision', tone: 'caution'
  };
}

export function caseChapterMarkup(s, support, options = {}) {
  const c = caseChapter(s, support, options);
  const target = !options.backend && c.target === 'communication' ? 'customer-demo' : c.target;
  const action = target === 'customer-demo'
    ? '<a href="story.html?perspective=customer">See separate customer demo ↗</a>'
    : `<button type="button" data-chapter-target="${target}">${target === 'communication' ? 'Open customer communication' : target === 'evidence' ? 'Inspect the evidence' : target === 'receipt' ? 'View outcome receipt' : target === 'refresh' ? 'Refresh case status' : 'Go to the next decision'} ↗</button>`;
  return `<div class="case-chapter ${c.tone}" aria-label="Case chapter"><div class="case-chapter-index"><strong>${c.number}</strong><span>CASE CHAPTER</span></div><div class="case-chapter-content"><span class="eyebrow">${c.phase}</span><h2>${c.title}</h2><div class="case-chapter-views"><p><b>CUSTOMER EXPERIENCE</b>${c.customer}</p><p><b>MERCHANT NEXT STEP</b>${c.merchant}</p></div><div class="case-chapter-foot"><span>${esc(c.owner)}</span>${action}</div><small>${options.backend ? 'Server case · customer confirmation comes from the private tracker.' : 'Sample case · customer messages and confirmation are illustrated in the separate story.'}</small></div></div>`;
}

export function mountCaseChapter(root, s, support = null, options = {}) {
  const body = root.querySelector('.sheet-body');
  if (!body) return;
  const prior = body.querySelector(':scope > .case-chapter');
  if (prior) prior.remove();
  body.insertAdjacentHTML('afterbegin', caseChapterMarkup(s, support, options));
  const card = body.querySelector(':scope > .case-chapter');
  card.querySelector('[data-chapter-target]')?.addEventListener('click', event => {
    const kind = event.currentTarget.dataset.chapterTarget;
    if (kind === 'refresh') { root.querySelector('[data-action="refresh"]')?.click(); return; }
    const selector = {communication:'.support-panel', evidence:'.case-evidence-column', decision:'.case-decision-column', receipt:'.story-outcome-panel'}[kind];
    const target = selector && root.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    if (kind === 'communication') target.querySelector('summary')?.focus();
  });
}
