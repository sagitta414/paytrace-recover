let sdkPromise;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function checkoutCopy(s, { backend, paypal, operator }) {
  if (!backend) return 'This browser sample cannot collect a PayPal sandbox payment. Run the server and create a sandbox case there.';
  if (!paypal) return 'PayPal sandbox credentials are not configured on this server. Add them in the server environment, then return to this case.';
  if (!operator) return 'Unlock the operator session to use the configured PayPal sandbox account.';
  return `Ready to create a PayPal sandbox order for ${s.customerName} and this $128.00 course purchase.`;
}

async function loadSdk(clientId) {
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) + '&currency=USD&intent=capture';
    script.onload = resolve;
    script.onerror = () => reject(Error('PayPal sandbox checkout could not load. Check the connection and retry.'));
    document.head.append(script);
  }).catch(error => { sdkPromise = null; throw error; });
  await sdkPromise;
  if (!window.paypal?.Buttons) throw Error('PayPal checkout is unavailable. Refresh the page and try again.');
}

export function mountCheckout(root, s, { backend, paypal, clientId, operator, api, onClose, onUnlock, onCapture }) {
  const shell = root.querySelector('.review-shell');
  if (!shell || !s || s.capture) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'focus-checkout';
  dialog.innerHTML = `<div class="focus-checkout-head"><div><span class="eyebrow">PAYMENT / SAME CASE</span><h2>Complete the sandbox purchase.</h2></div><button type="button" class="focus-checkout-close" aria-label="Close checkout">×</button></div><p class="focus-checkout-sub">${esc(s.id)} · ${esc(s.customerName)} · The Light &amp; Story Workshop · $128.00 USD</p><p class="focus-checkout-boundary">${checkoutCopy(s, { backend, paypal, operator })}</p>${backend && paypal && !operator ? '<form id="focus-operator-form"><label>Demo operator key <input type="password" name="key" required autocomplete="off"></label><button type="submit" class="button primary">Unlock sandbox checkout</button></form>' : ''}${backend && paypal && operator ? '<div id="focus-paypal-buttons"></div>' : ''}<p class="focus-checkout-note">Sandbox test accounts only. Capturing payment returns to this case; access repair still requires evidence and merchant approval.</p><p class="focus-checkout-error" role="alert" hidden></p>`;
  shell.append(dialog);
  dialog.showModal();
  const error = dialog.querySelector('.focus-checkout-error');
  const showError = message => { error.textContent = message; error.hidden = false; };
  const close = () => { dialog.close(); dialog.remove(); onClose(); };
  dialog.querySelector('.focus-checkout-close').onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector('#focus-operator-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button'); button.disabled = true;
    try { await api('operator', { key: new FormData(event.target).get('key') }); onUnlock(); }
    catch (e) { showError(e.message); button.disabled = false; }
  });
  if (backend && paypal && operator) loadSdk(clientId).then(() => {
    if (!dialog.isConnected) return;
    return window.paypal.Buttons({
      createOrder: async () => (await api('paypal/create', { caseId: s.id })).id,
      onApprove: async data => {
        try { const result = await api('paypal/capture', { orderId: data.orderID, caseId: s.id }); await onCapture(result); }
        catch (e) { showError(e.message + ' Refresh the case before retrying a payment.'); }
      },
      onError: () => showError('Sandbox checkout could not complete. Refresh the case before retrying.')
    }).render(dialog.querySelector('#focus-paypal-buttons'));
  }).catch(e => showError(e.message));
}
