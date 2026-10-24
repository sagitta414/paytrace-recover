import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutCopy } from '../dist/focus-checkout.mjs';

test('checkout explains configuration and avoids implying a browser payment', () => {
  const s = { customerName: 'Maya' };
  assert.match(checkoutCopy(s, { backend: false }), /cannot collect/);
  assert.match(checkoutCopy(s, { backend: true, paypal: false }), /credentials are not configured/);
  assert.match(checkoutCopy(s, { backend: true, paypal: true, operator: false }), /Unlock/);
  assert.match(checkoutCopy(s, { backend: true, paypal: true, operator: true }), /Ready to create/);
});
