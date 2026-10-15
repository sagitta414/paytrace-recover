export class RequestFailure extends Error{constructor(code,message){super(message);this.code=code;}}
export function validateCase(s){if(!s||s.schema!==1||typeof s.id!=='string'||typeof s.customerName!=='string'||!s.order||typeof s.order.amount!=='number'||!s.entitlement||typeof s.entitlement.active!=='boolean'||!Array.isArray(s.events)||s.events.some(e=>typeof e.what!=='string'||typeof e.at!=='string')||s.review&&(!Array.isArray(s.review.exchange)||s.review.exchange.some(e=>!Array.isArray(e.sources)))||s.proof&&!Array.isArray(s.proof.checks))throw new RequestFailure('response','Case records were incomplete. Your previous view has been retained.');return s;}
export function createApi({fetcher=fetch,timeoutMs=45000}={}){return async function request(path,data){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const r=await fetcher('/api/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal});
  if(r.status===401)throw new RequestFailure('session','Your session is unavailable. Reload the workspace before continuing.');
  if(r.status>=500)throw new RequestFailure('service','The recovery service is unavailable. Your last loaded records are still shown.');
  if(!r.headers.get('content-type')?.includes('application/json'))throw new RequestFailure('response','An unexpected response was received. Refresh records before continuing.');
  let j;try{j=await r.json();}catch{throw new RequestFailure('response','The service returned incomplete data. Refresh records before continuing.');}
  if(!r.ok)throw new RequestFailure('rejected',j.error||'The request was not accepted. Refresh the case and review its evidence.');
  return j;
 }catch(e){if(e instanceof RequestFailure)throw e;throw new RequestFailure(controller.signal.aborted?'timeout':'network',controller.signal.aborted?'The request timed out. Its result is not yet confirmed.':'The connection was interrupted. Its result is not yet confirmed.');}finally{clearTimeout(timer);}
};}
export async function loadSnapshot(api,selected){const [portfolio,detail]=await Promise.all([api('operations'),selected?api('case?caseId='+encodeURIComponent(selected)):Promise.resolve(null)]);if(!Array.isArray(portfolio?.cases))throw new RequestFailure('response','Case records were incomplete. Your previous view has been retained.');portfolio.cases.forEach(validateCase);if(selected&&(!detail?.state||detail.state.id!==selected))throw new RequestFailure('changed','The active case changed. Return to the queue and open it again.');if(detail?.state)validateCase(detail.state);return {cases:portfolio.cases,state:detail?.state};}
export function sourcesUnavailable(s){return !!s?.sources&&Object.values(s.sources).some(source=>source.status!=='available');}
