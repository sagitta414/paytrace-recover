import {courseAccessClient} from '../server/course-access.mjs';
import {createCase} from '../dist/core.mjs';

const client=courseAccessClient(process.env);
if(!client)throw Error('Set the course service URL and key before running this check.');
const state=createCase('match','SMOKE-READ-ONLY');
const access=await client.check(state);
if(access.active||access.userId!==state.order.userId||access.courseId!==state.order.courseId)throw Error('Unexpected course entitlement in read-only smoke test.');
console.log(JSON.stringify({service:new URL(process.env.COURSE_ACCESS_URL).origin,readSucceeded:true,active:access.active,accessWrites:state.writes}));
