// Only the OpenAI API or an Azure OpenAI resource may receive case evidence.
export function aiEndpoint(env=process.env){
 if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return null;
 const raw=env.OPENAI_BASE_URL||'https://api.openai.com/v1/';
 let url;try{url=new URL(raw)}catch{throw Error('AI base URL is invalid.');}
 const azure=/^[a-z0-9-]+\.openai\.azure\.com$/i.test(url.hostname);
 const openai=url.hostname==='api.openai.com';
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!(azure||openai)||!((azure?['/openai/v1','/openai/v1/']:['/v1','/v1/']).includes(url.pathname)))throw Error('AI base URL must be the official OpenAI or Azure OpenAI v1 endpoint.');
 const base=url.origin+(azure?'/openai/v1/':'/v1/');
 return {provider:azure?'azure-openai':'openai',model:env.OPENAI_MODEL,responsesUrl:base+'responses',modelUrl:base+'models/'+encodeURIComponent(env.OPENAI_MODEL),headers:azure?{'api-key':env.OPENAI_API_KEY}:{Authorization:'Bearer '+env.OPENAI_API_KEY}};
}
