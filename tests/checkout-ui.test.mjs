import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutControls} from '../dist/checkout-ui.mjs';
test('sandbox checkout never offers a rejected sample payment',()=>{const s={intakeMode:'sandbox'};const missing=checkoutControls(s,{backend:true});assert.doesNotMatch(missing,/data-action="pay"|id="paypal-buttons"/);assert.match(missing,/not configured/);const locked=checkoutControls(s,{paypal:true});assert.match(locked,/Unlock this session/);assert.doesNotMatch(locked,/data-action="pay"|id="paypal-buttons"/);const ready=checkoutControls(s,{paypal:true},true);assert.match(ready,/id="paypal-buttons"/);assert.doesNotMatch(ready,/data-action="pay"/);});
test('sample storefront retains simulated checkout',()=>{assert.match(checkoutControls({},{}),/data-action="pay"/);assert.match(checkoutControls({},{paypal:true},true),/id="paypal-buttons"/);});
