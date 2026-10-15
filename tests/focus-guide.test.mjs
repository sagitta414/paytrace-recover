import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate,rehearse,approve,applyRepair,verify} from '../dist/core.mjs';
import {guideStep} from '../dist/focus-guide.mjs';
test('Guidance explains approval without mutating the purchase',()=>{const s=simulatePayment(createCase());investigate(s);rehearse(s);const before=JSON.stringify(s);assert.equal(guideStep(s).title,'You make the decision.');assert.equal(JSON.stringify(s),before);assert.equal(s.approval,null);assert.equal(s.writes,0);});
test('Guidance distinguishes blocked evidence from a safe preview',()=>{const s=simulatePayment(createCase('conflict'));investigate(s);assert.equal(guideStep(s).agent,3);assert.match(guideStep(s).body,/Do not grant access/);});
test('Guidance does not announce success after a failed verification',()=>{const s=simulatePayment(createCase());investigate(s);rehearse(s);approve(s,s.rehearsal.id);applyRepair(s);verify(s,{lessonAvailable:false});assert.match(guideStep(s).body,/case stays open/);verify(s);assert.equal(guideStep(s).title,'Now you have a checked outcome.');});
