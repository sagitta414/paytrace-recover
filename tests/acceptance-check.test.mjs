import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {assessAcceptance} from '../server/acceptance-check.mjs';

function fixture(){const s=simulatePayment(createCase('match','CL-acceptance-case'));investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);return s;}
test('sample proof cannot satisfy connected acceptance even with a passing lesson',()=>{
 const s=fixture(),report={caseId:s.id,checks:['payment','access','agents','approval','workflow','verification'].map(id=>({id,status:'passed'})),connectedSandboxProof:true},receipt={caseId:s.id,status:'Verified'};
 assert.equal(assessAcceptance(s,report,receipt).passed,false);
 s.capture.source='paypal-sandbox';s.proof.transport='external-course-service';
 assert.equal(assessAcceptance(s,report,receipt).passed,true);
 s.proof.at=new Date(Date.now()-3600000).toISOString();
 assert.equal(assessAcceptance(s,report,receipt).passed,false);
});
test('refund and failed verification have separate fail-closed criteria',()=>{
 const s=fixture(),report={caseId:s.id,checks:[{id:'verification',status:'failed'}],connectedSandboxProof:false,paymentSignal:{eventId:'evt'}},receipt={caseId:s.id,status:'Not verified'};
 s.capture.source='paypal-sandbox';s.proof.passed=false;
 assert.equal(assessAcceptance(s,report,receipt,{mode:'failed-verification'}).passed,true);
 s.writes=2;assert.equal(assessAcceptance(s,report,receipt,{mode:'failed-verification'}).passed,false);
 s.writes=1;s.paymentHold={at:new Date().toISOString()};s.entitlement.active=false;s.sources={access:{status:'available'}};
 assert.equal(assessAcceptance(s,report,receipt,{mode:'refund'}).passed,true);
 report.paymentSignal=null;assert.equal(assessAcceptance(s,report,receipt,{mode:'refund'}).passed,false);
});
