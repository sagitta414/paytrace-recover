const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const python='C:/Users/Jeffl/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const renderer='C:/Users/Jeffl/.codex/plugins/cache/openai-bundled/visualize/1.0.46/skills/visualize/scripts/render.py';
for(const name of ['recover','agents']){
 const out=path.join(__dirname,'dist',name+'.html');
 const fragment=fs.readFileSync(path.join(__dirname,'source',name+'-fragment.html'),'utf8');
 const portrait='data:image/webp;base64,'+fs.readFileSync(path.join(__dirname,'dist/assets/crew-portraits.webp')).toString('base64');
 const temporary=path.join(__dirname,'.openai',name+'-export.tmp.html');
 fs.writeFileSync(temporary,fragment.replaceAll('assets/crew-portraits.png',portrait));
 try{execFileSync(python,[renderer,temporary,out,'--force'],{stdio:'pipe'});}finally{fs.unlinkSync(temporary);}
 let html=fs.readFileSync(out,'utf8');
 const title=name==='recover'?'Recovery workspace':'Agent room';
 html=html.replace(/<title>[^<]*<\/title>/,'<title>'+title+' — PayTrace Recover</title>');
 html=html.replace('</head>',`<meta name="description" content="Explore the PayTrace Recover ${title.toLowerCase()}. Interactive concept with simulated data."><style>body{max-width:1240px;margin:auto;padding:18px 24px 30px}.export-nav{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:5px 8px 22px;font:13px/1.5 system-ui,sans-serif;color:light-dark(#071d49,#eef5ff)}.export-nav a{color:inherit;text-decoration:none;padding:10px 0}.export-nav a:focus-visible{outline:3px solid #00bcd3;outline-offset:5px}.export-nav strong{font-size:17px;letter-spacing:-.5px}.export-nav div{display:flex;gap:23px;align-items:center}.export-nav a[aria-current]{color:light-dark(#003bff,#8fafff)}@media(max-width:620px){body{padding:12px 10px 20px}.export-nav{padding:0 8px 14px;gap:0;font-size:12px}.export-nav strong{font-size:15px}.export-nav div{gap:17px}.export-nav>a{width:100%;padding-bottom:5px}}</style></head>`);
 html=html.replace('<body>',`<body><nav class="export-nav" aria-label="PayTrace navigation"><a href="./"><strong>← PayTrace Recover</strong></a><div><a href="recover.html" ${name==='recover'?'aria-current="page"':''}>Recovery workspace</a><a href="agents.html" ${name==='agents'?'aria-current="page"':''}>Agent room</a></div></nav>`);
 fs.writeFileSync(out,html);
}
console.log('Exported recovery and agent demos.');
