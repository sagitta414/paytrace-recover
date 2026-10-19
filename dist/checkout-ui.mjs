export function checkoutControls(s,cfg={},operator=false){
 const sandbox=s.intakeMode==='sandbox';
 const sample=sandbox?'':'<button class="button dark" data-action="pay">Complete sample checkout · $128</button><p class="fine">Simulated checkout. No PayPal login or real payment.</p>';
 if(cfg.paypal&&operator)return sample+'<div id="paypal-buttons" style="margin-top:20px"></div><p class="fine">PayPal sandbox checkout · test accounts only.</p>';
 if(!sandbox)return sample;
 return '<div class="lock-message"><strong>Awaiting PayPal sandbox checkout.</strong><p>'+(cfg.paypal?'Unlock this session in Developer setup below to load PayPal sandbox checkout.':'PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and DEMO_OPERATOR_KEY on the server, restart it, then unlock this session in Developer setup below.')+'</p></div><p class="fine">This case requires a sandbox payment. No payment or access change has occurred.</p>';
}
