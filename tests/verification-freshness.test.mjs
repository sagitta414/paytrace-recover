import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {proofIsCurrent} from '../dist/operations.mjs';
import {proofFresh,verificationAge,verificationStatus} from '../dist/verification-policy.mjs';

test('passing proof expires without becoming a second grant or erasing its history',()=>{
 const s=simulatePayment(createCase('match','CL-freshness'));
 investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s);
 assert.equal(proofIsCurrent(s),true);
 const checked=Date.parse(s.proof.at);
 assert.equal(proofFresh(s,checked+299000),true);
 assert.equal(proofFresh(s,checked+301000),false);
 s.proof.at=new Date(checked-301000).toISOString();
 assert.equal(proofIsCurrent(s),false);
 assert.equal(s.writes,1);
 assert.equal(verificationStatus(s).lastVerifiedAt,s.proof.at);
});

test('verification age configuration stays within a bounded interval',()=>{
 assert.equal(verificationAge({}),300000);
 assert.equal(verificationAge({VERIFICATION_MAX_AGE_SECONDS:'600'}),600000);
 for(const value of ['0','59','3601','NaN'])assert.throws(()=>verificationAge({VERIFICATION_MAX_AGE_SECONDS:value}));
});
