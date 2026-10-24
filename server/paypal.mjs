const BASE='https://api-m.sandbox.paypal.com';
export function paypalClient(env=process.env,fetcher=fetch){
 let token=null,expires=0;
 async function request(path,{method='GET',body,key}={}){
  if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)throw Error('PayPal sandbox credentials are not configured.');
  if(!token||Date.now()>expires){const r=await fetcher(BASE+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PayPal sandbox authentication failed.');const j=await r.json();if(!j.access_token)throw Error('PayPal did not return an access token.');token=j.access_token;expires=Date.now()+Math.max(30,j.expires_in-60)*1000}
  const r=await fetcher(BASE+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(key?{'PayPal-Request-Id':key}:{})},body:body?(typeof body==='string'?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error(`PayPal sandbox request failed (${r.status}). Retry or inspect the sandbox dashboard.`);return r.json();
 }
 return {
  async verifyWebhook(raw,headers){
   if(!env.PAYPAL_WEBHOOK_ID)throw Error('PayPal sandbox webhook ID is not configured.');
   const names={'transmission_id':'paypal-transmission-id','transmission_time':'paypal-transmission-time','cert_url':'paypal-cert-url','auth_algo':'paypal-auth-algo','transmission_sig':'paypal-transmission-sig'};
   const fields={};for(const [field,header] of Object.entries(names)){const value=headers[header];if(typeof value!=='string'||!value||value.length>4096)throw Error('PayPal webhook signature headers are missing or invalid.');fields[field]=value;}
   fields.webhook_id=env.PAYPAL_WEBHOOK_ID;
   // Embed the original event JSON. PayPal requires the signed event representation,
   // so parsing and re-stringifying the webhook body is not sufficient here.
   const body=JSON.stringify(fields).slice(0,-1)+',"webhook_event":'+raw+'}';
   const result=await request('/v1/notifications/verify-webhook-signature',{method:'POST',body});
   return result.verification_status==='SUCCESS';
  },
  async create(s){const j=await request('/v2/checkout/orders',{method:'POST',key:'create-'+s.id,body:{intent:'CAPTURE',purchase_units:[{custom_id:s.id,reference_id:s.id,description:'PayTrace Recover sandbox: Light & Story Workshop',amount:{currency_code:'USD',value:'128.00'}}]}});if(!j.id)throw Error('PayPal did not return an order ID.');return j.id},
  async capture(s){if(!s.paypalOrderId)throw Error('Create a sandbox order first.');let order=await request('/v2/checkout/orders/'+encodeURIComponent(s.paypalOrderId));if(order.status!=='COMPLETED')order=await request('/v2/checkout/orders/'+encodeURIComponent(s.paypalOrderId)+'/capture',{method:'POST',key:'capture-'+s.id,body:{}});return normalize(s,order)},
  async refresh(s){const order=await request('/v2/checkout/orders/'+encodeURIComponent(s.paypalOrderId));const c=normalize(s,order);const captured=await request('/v2/payments/captures/'+encodeURIComponent(c.id));if(captured.id!==c.id)throw Error('Capture reference changed.');return {...c,status:captured.status,amount:money(captured.amount?.value),currency:captured.amount?.currency_code}},
 };
}
function money(value){if(!/^\d+\.\d{2}$/.test(String(value)))throw Error('Unexpected PayPal amount format.');return Number(String(value).replace('.',''))}
export function normalize(s,j){const unit=j.purchase_units?.[0],captures=unit?.payments?.captures;if(j.id!==s.paypalOrderId||j.purchase_units?.length!==1||unit.custom_id!==s.id||captures?.length!==1)throw Error('PayPal order evidence does not match this purchase.');const c=captures[0];if(!c.id)throw Error('No capture was returned.');return {id:c.id,orderId:unit.custom_id,userId:s.order.userId,courseId:s.order.courseId,amount:money(c.amount?.value),currency:c.amount?.currency_code,status:c.status,source:'paypal-sandbox'}}

