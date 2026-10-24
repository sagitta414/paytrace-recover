import test from 'node:test';
import assert from 'node:assert/strict';
import {customerProgressMarkup} from '../dist/customer-clarity.mjs';

test('technical proof and customer confirmation have separate progress steps', () => {
  const checked = customerProgressMarkup({status:3,verified:true,confirmedAt:null,help:false});
  assert.match(checked,/Technical access check/);
  assert.match(checked,/Your confirmation/);
  assert.match(checked,/<li class="" aria-current="step"><strong>05<\/strong>Your confirmation/);
  const confirmed = customerProgressMarkup({status:3,verified:true,confirmedAt:'2026-10-23T00:00:00Z',help:false});
  assert.match(confirmed,/<li class="done" ><strong>✓<\/strong>Your confirmation/);
});

test('a help report reopens the final progress step', () => {
  const reopened=customerProgressMarkup({status:3,verified:true,confirmedAt:null,help:true});
  assert.match(reopened,/class="reopened" aria-current="step"/);
  assert.match(reopened,/Follow-up open/);
});
