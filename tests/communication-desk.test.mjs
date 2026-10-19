import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {timelineEntries,timelineMarkup} from '../dist/communication-desk.mjs';
import {openStore} from '../server/store.mjs';

test('timeline separates private notes and recovery records from customer conversation',()=>{
 const entries=timelineEntries({events:[{at:'2026-01-01T12:00:00Z',what:'Access verified'}]}, {messages:[{id:'a',at:'2026-01-01T12:02:00Z',role:'merchant',kind:'internal',text:'PRIVATE NOTE'},{id:'b',at:'2026-01-01T12:01:00Z',role:'customer',kind:'message',text:'<script>unsafe</script>'}]});
 assert.equal(entries[0].category,'private');assert.equal(entries[1].category,'conversation');
 const conversation=timelineMarkup(entries,'conversation');assert.ok(!conversation.includes('PRIVATE NOTE'));assert.ok(!conversation.includes('Access verified'));assert.ok(!conversation.includes('<script>'));assert.ok(conversation.includes('&lt;script&gt;'));
 assert.match(timelineMarkup(entries,'private'),/Private admin note/);
});

test('inbox previews customer replies without leaking private notes or another workspace',()=>{
 const db=openStore(':memory:');try{const owner=db.create(),other=db.create(),id=owner.state.id;
 db.support.view(owner.id,id,true);
 db.support.mutate(owner.id,id,{action:'message',text:'I cannot open the lesson',requestId:randomUUID()});
 db.support.mutate(owner.id,id,{action:'internal',text:'PRIVATE INVESTIGATION',requestId:randomUUID()},true);
 const inbox=db.support.inbox(owner.id);assert.equal(inbox.length,1);assert.equal(inbox[0].kind,'reply');assert.equal(inbox[0].preview,'I cannot open the lesson');assert.ok(inbox[0].at);assert.deepEqual(db.support.inbox(other.id),[]);
 db.support.mutate(owner.id,id,{action:'message',text:'Please try the link again',requestId:randomUUID()},true);assert.equal(db.support.inbox(owner.id).length,0);
 db.support.mutate(owner.id,id,{action:'help',requestId:randomUUID()});assert.equal(db.support.inbox(owner.id)[0].kind,'help');
 }finally{db.close();}
});
