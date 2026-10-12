import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const p=spawn('npx',['wrangler','tail','courtwatch-app-api','--format','json'],{stdio:['ignore','pipe','pipe'],detached:true,env:process.env});
let data='',stderr='';p.stdout.on('data',c=>{data+=c});p.stderr.on('data',c=>{stderr+=c});
const timer=setTimeout(()=>{try{process.kill(-p.pid,'SIGTERM')}catch{}},65000);await new Promise(resolve=>{p.on('close',resolve);p.on('error',e=>{stderr+=String(e);resolve()})});clearTimeout(timer);
let events=[],depth=0,start=-1,quoted=false,escaped=false;for(let i=0;i<data.length;i++){const c=data[i];if(quoted){if(escaped)escaped=false;else if(c==='\\\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'&&depth){quoted=true;continue}if(c==='{'){if(!depth)start=i;depth++}else if(c==='}'&&depth){depth--;if(!depth){try{events.push(JSON.parse(data.slice(start,i+1)))}catch{}}}}
const clean=s=>String(s).replace(/[\w.+-]+@[\w.-]+/g,'[email]').replace(/\b\d{8,}\b/g,'[id]').slice(0,500);
const rows=events.filter(e=>{try{return new URL(e.event?.request?.url||'').pathname.includes('/app/api/')}catch{return false}}).map(e=>({path:new URL(e.event.request.url).pathname,outcome:e.outcome,status:e.event?.response?.status,exceptions:(e.exceptions||[]).map(x=>clean(x.message)),errors:(e.logs||[]).filter(x=>x.level==='error').map(x=>clean(JSON.stringify(x.message)))}));
const report={status:rows.length?'requests_captured':'no_private_requests_captured',events:rows,tailAvailable:events.length>0,diagnostic:events.length?'':clean(stderr.split('\n').find(s=>/error/i.test(s))||'')};await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/others-runtime.json',JSON.stringify(report));console.log(JSON.stringify(report));
