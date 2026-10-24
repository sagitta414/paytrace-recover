import {aiEndpoint} from './ai-endpoint.mjs';
import {courseAccessClient} from './course-access.mjs';
import {randomUUID} from 'node:crypto';
export async function checkConnection(kind,env=process.env,fetcher=fetch){
 const checkedAt=new Date().toISOString();
 const result=(state,detail)=>({kind,state,detail,checkedAt});
 const get=async(url,key)=>{const response=await fetcher(url,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(12000)});return response.status};
 try{
  if(kind==='paypal'){
   if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)return result('not-configured','Add PayPal sandbox client ID and secret to the server.');
   const response=await fetcher('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(12000)});
   return response.ok?result('connected','Sandbox credentials were accepted. A checkout still needs a separate test.'):result('failed',`Sandbox authentication returned ${response.status}. Check the app credentials.`);
  }
  if(kind==='access'){
   if(!env.COURSE_ACCESS_URL||!env.COURSE_ACCESS_API_KEY)return result('not-configured','Add the course service URL and API key to the server. This check does not grant access.');
   let client;try{client=courseAccessClient(env,fetcher)}catch{return result('failed','The course service URL or key configuration is invalid. No access was changed.');}
   const id='paytrace-connection-'+randomUUID();
   let value;try{value=await client.check({id,order:{userId:id,courseId:'course-light'},capture:null});}catch(error){if(/returned HTTP \d+|mismatched entitlement|different payment/.test(error.message))return result('failed','The course service rejected the authenticated entitlement read or returned a mismatched record. No change was made.');throw error;}
   return value.active===false?result('connected','The separate course service accepted an authenticated entitlement read. No grant or lesson check was made.'):result('failed','The course service returned unexpected access for a new check identity. No change was made.');
  }
  if(kind==='ai'){
   const endpoint=aiEndpoint(env);if(!endpoint)return result('not-configured','Add the AI key and model to the server.');
   const response=await fetcher(endpoint.modelUrl,{headers:{...endpoint.headers,Accept:'application/json'},signal:AbortSignal.timeout(12000)});const status=response.status;
   return status===200?result('connected','The configured model is accessible. An agent consultation still needs a case test.'):result('failed',`Model lookup returned ${status}. Check the key and model name.`);
  }
  if(kind==='render'){
   if(!env.RENDER_API_KEY||!env.RENDER_INVESTIGATE_TASK||!env.RENDER_RECOVER_TASK||!env.WORKFLOW_SECRET)return result('not-configured','Add Render API key, task IDs, and workflow secret.');
   const status=await get('https://api.render.com/v1/tasks?limit=1',env.RENDER_API_KEY);
   return status===200?result('connected','Render accepted the API key. Workflow dispatch and callbacks still need a case test.'):result('failed',`Render task lookup returned ${status}. Check the API key and task setup.`);
  }
  if(kind==='email'){
   if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return result('not-configured','Add the email API key and verified sender.');
   const status=await get('https://api.resend.com/domains',env.RESEND_API_KEY);
   return status===200?result('connected','Email API key was accepted. Sender verification and delivery still need a separate test.'):result('failed',`Email domain lookup returned ${status}. Check the API key and sender setup.`);
  }
  return result('failed','Unknown connection.');
 }catch{return result('unavailable','The provider could not be reached. No case or payment was changed.');}
}
