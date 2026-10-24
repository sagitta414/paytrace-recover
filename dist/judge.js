const flags=window.COURSELATCH_RUNTIME||{};
const checks=[
 ['PayPal sandbox',flags.paypal?'Configured · run a capture':'Credentials still needed'],
 ['Course access',flags.courseAccess?'Separate service configured':'Demo service only'],
 ['AI specialists',flags.ai?'Model configured · inspect a case':'Scripted sample only'],
 ['Render Workflows',flags.workflows?'Configured · inspect a run':'Not configured yet']
];
const list=document.querySelector('#judge-readiness-list');
for(const [name,status] of checks){const item=document.createElement('div');const title=document.createElement('strong');const detail=document.createElement('span');title.textContent=name;detail.textContent=status;item.append(title,detail);list.append(item);}
