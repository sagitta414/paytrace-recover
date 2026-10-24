// The public story and the merchant workspace are separate examples. Only the
// browser sample can safely deep-link to Maya's seeded case.
export function storyEntry(cases, backend, query = '') {
  const params = new URLSearchParams(query);
  if (params.get('from') !== 'story') return { active: false, caseId: null };
  const maya = backend ? null : cases.find(s => s.id === 'CL-1048' && s.customerName === 'Maya');
  return { active: true, caseId: maya?.id || null };
}

export function storyBridge({ selected = false, backend = false, verified = false } = {}) {
  const next = verified
    ? 'The technical checks passed. Share the private case link from Customer communication, then wait for the customer to try the purchase and confirm it works.'
    : selected
      ? 'Now inspect the payment and access evidence, hear the specialists, preview a single correction, and decide whether to approve it.'
      : 'Choose a case in the queue to inspect its evidence and decide what happens next.';
  const boundary = backend
    ? 'The story is a separate browser simulation. This workspace reads its own server cases.'
    : 'This workspace uses sample cases. The guided story and workspace keep separate demo state.';
  return `<section class="story-bridge" aria-label="Recovery story handoff"><div class="story-bridge-mark">${verified ? '03' : selected ? '02' : '01'}<span> / 03</span></div><div><span class="eyebrow">${verified ? 'FROM TECHNICAL PROOF TO CUSTOMER CONFIRMATION' : 'FROM CUSTOMER PROBLEM TO MERCHANT DECISION'}</span><h2>${verified ? 'The customer gets the final word.' : selected ? 'The customer is waiting. You have the next move.' : 'Start with the customer’s missing access.'}</h2><p>${next}</p><small>${boundary}</small></div><a href="story.html${selected ? '?perspective=customer' : ''}">${selected ? 'See the customer perspective ↗' : 'Follow the guided story ↗'}</a></section>`;
}
