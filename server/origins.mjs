// Trust deployment configuration only, never request Host or forwarded headers.
export function originConfig(env){
 const parse=value=>{if(!value)return null;try{const u=new URL(value.trim());if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return u;}catch{return null;}};
 const render=parse(env.RENDER_EXTERNAL_URL),configured=parse(env.PUBLIC_URL);
 if(render&&render.protocol!=='https:')throw Error('Render public URL must use HTTPS.');
 if(env.PUBLIC_URL&&!configured&&!render)throw Error('PUBLIC_URL must be a valid HTTP or HTTPS URL.');
 const primary=render||configured||new URL('http://127.0.0.1:'+(env.PORT||4358));
 const allowed=new Set([primary.origin]);
 // Preserve explicitly configured HTTPS custom domains on Render.
 if(configured&&(!render||configured.protocol==='https:'))allowed.add(configured.origin);
 return {publicUrl:primary,allows:origin=>typeof origin==='string'&&allowed.has(origin)};
}
