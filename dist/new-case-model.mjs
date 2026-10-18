import {createCase,simulatePayment,record} from './core.mjs';
export function validateNewCase(input){
 if(!input||typeof input!=='object')throw Error('Case details are required.');
 const customerName=typeof input.customerName==='string'?input.customerName.trim():'';
 if(!customerName||customerName.length>80||/[\x00-\x1f<>]/.test(customerName))throw Error('Enter a customer name of 1–80 characters without markup.');
 if(!['sandbox','sample'].includes(input.mode))throw Error('Choose sandbox checkout or sample payment.');
 if(typeof input.requestId!=='string'||! /^[a-f0-9-]{36}$/i.test(input.requestId))throw Error('A valid creation request ID is required.');
 return {customerName,mode:input.mode,requestId:input.requestId};
}
export function newCase(input){
 const data=validateNewCase(input),s=createCase('match','CL-'+data.requestId);
 s.customerName=data.customerName;s.creationInput=data;s.intakeMode=data.mode;
 s.order.userId='learner-'+data.requestId;s.currentAccountId=s.order.userId;s.entitlement.userId=s.order.userId;
 s.fulfillment={code:null,cause:'unknown'};
 record(s,'Case created for the demo course. No access change authorized.');
 if(data.mode==='sample'){s.fulfillment.code='ENROLLMENT_TIMEOUT';simulatePayment(s);}
 return s;
}
