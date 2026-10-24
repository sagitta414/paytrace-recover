import test from 'node:test';
import assert from 'node:assert/strict';
import {aiEndpoint} from '../server/ai-endpoint.mjs';
import {checkConnection} from '../server/connection-check.mjs';
import {answerQuestion} from '../server/ai.mjs';
import {createCase,simulatePayment,investigate} from '../dist/core.mjs';

const azure={OPENAI_API_KEY:'private-test-key',OPENAI_MODEL:'gpt-4o-mini',OPENAI_BASE_URL:'https://automation-jl107.openai.azure.com/openai/v1/'};
test('Azure OpenAI uses the v1 Responses route and server-only key',async()=>{
 const endpoint=aiEndpoint(azure);assert.equal(endpoint.provider,'azure-openai');assert.equal(endpoint.responsesUrl,'https://automation-jl107.openai.azure.com/openai/v1/responses');assert.equal(endpoint.headers['api-key'],'private-test-key');
 const checked=await checkConnection('ai',azure,async(url,options)=>{assert.equal(url,endpoint.modelUrl);assert.equal(options.headers['api-key'],'private-test-key');return {status:200};});assert.equal(checked.state,'connected');assert.ok(!JSON.stringify(checked).includes('private-test-key'));
 const s=investigate(simulatePayment(createCase()));let calls=0;
 const response=await answerQuestion(s,0,'Does the capture match?',azure,async(url,options)=>{calls++;assert.equal(url,endpoint.responsesUrl);assert.equal(options.headers['api-key'],'private-test-key');assert.equal(JSON.parse(options.body).store,false);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'The capture matches the order.',unknown:'Lesson access is not yet verified.',sources:['payment','order']})}]}]});});
 assert.equal(calls,1);assert.equal(response.sources.length,2);
});
test('AI endpoint refuses arbitrary destinations for case evidence',()=>{
 for(const bad of ['http://automation-jl107.openai.azure.com/openai/v1/','https://evil.example/openai/v1/','https://automation-jl107.openai.azure.com.evil.example/openai/v1/','https://automation-jl107.openai.azure.com/openai/v1/?token=secret'])assert.throws(()=>aiEndpoint({...azure,OPENAI_BASE_URL:bad}),/official OpenAI or Azure OpenAI/);
 assert.equal(aiEndpoint({OPENAI_API_KEY:'key',OPENAI_MODEL:'model'}).responsesUrl,'https://api.openai.com/v1/responses');
});
