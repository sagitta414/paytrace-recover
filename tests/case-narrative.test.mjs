import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {caseChapter,caseChapterMarkup} from '../dist/case-narrative.mjs';

test('case chapter follows payment, evidence, approval, proof, and human confirmation', () => {
  const s = createCase();
  assert.match(caseChapter(s).phase, /PURCHASE NOT CONFIRMED/);
  simulatePayment(s);
  assert.equal(caseChapter(s).phase, 'THE GAP');
  investigate(s);
  assert.equal(caseChapter(s).phase, 'EVIDENCE REVIEWED');
  rehearse(s);
  assert.equal(caseChapter(s).phase, 'MERCHANT DECISION');
  approve(s,s.rehearsal.id);
  assert.equal(caseChapter(s).phase, 'APPROVAL RECORDED');
  applyRepair(s);
  assert.equal(caseChapter(s).phase, 'CORRECTION APPLIED');
  verify(s);
  assert.equal(caseChapter(s,null,{backend:true}).phase, 'TECHNICAL PROOF');
  assert.equal(caseChapter(s,{confirmedAt:new Date().toISOString()}).phase, 'CUSTOMER CONFIRMED');
  assert.equal(caseChapter(s,{confirmedAt:new Date().toISOString(),help:true}).phase, 'CUSTOMER FOLLOW-UP');
});

test('uncertain and blocked cases never present a repair as completed', () => {
  const s = simulatePayment(createCase('conflict'));
  investigate(s);
  assert.equal(caseChapter(s).phase, 'SAFE STOP');
  assert.match(caseChapterMarkup(s,null,{backend:false}), /separate customer demo/);
  assert.equal(caseChapter(s,null,{uncertain:true}).phase, 'STATUS NEEDS A CHECK');
  const restored = simulatePayment(createCase('restored'));
  assert.equal(caseChapter(restored).phase, 'ACCESS FOUND');
  assert.equal(caseChapter({...restored,phase:'review-failed'}).phase, 'REVIEW INTERRUPTED');
  assert.equal(caseChapter({...restored,phase:'stale'}).phase, 'MORE EVIDENCE NEEDED');
});
