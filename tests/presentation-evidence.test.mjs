import test from 'node:test';
import assert from 'node:assert/strict';
import {createCase,simulatePayment,investigate} from '../dist/core.mjs';
import {agentEvidencePanel} from '../dist/focus-agent-workbench.mjs';
import {buildRunReport} from '../dist/run-report.mjs';
import {runReportTimeline} from '../dist/focus-experience.mjs';

test('four specialist cards show findings, uncertainty, and inspectable saved sources',()=>{
 const state=investigate(simulatePayment(createCase()));
 const html=agentEvidencePanel(state);
 for(const name of ['Ledger','Relay','Patch','Prism'])assert.match(html,new RegExp(name));
 assert.match(html,/Inspect 2 sources/);
 assert.match(html,/The records do not establish every cause|A payment alone does not prove access/);
 assert.match(html,/CAP-CL-1048/);
});

test('agent cards escape untrusted model text and source records',()=>{
 const state=investigate(simulatePayment(createCase()));
 state.analysis={mode:'model',findings:[{agent:0,summary:'<img src=x onerror=alert(1)>',unknown:'<script>bad</script>',sources:['payment']}]};
 const html=agentEvidencePanel(state);
 assert.doesNotMatch(html,/<script>|<img src=x/);
 assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
});

test('visual receipt labels demo evidence and does not imply customer confirmation',()=>{
 const state=investigate(simulatePayment(createCase()));
 const html=runReportTimeline(buildRunReport(state,{backend:true}));
 assert.match(html,/RECOVERY RECEIPT/);
 assert.match(html,/Demo evidence/);
 assert.match(html,/Customer confirmation is tracked separately/);
 assert.doesNotMatch(html,/Connected sandbox proof/);
});
