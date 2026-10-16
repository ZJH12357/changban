import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

// Run build:netlify first. This checks the real build and real SDK's pg driver,
// not the handler-import test shim. Database and both listeners stay loopback.
const engine=new PGlite();
await engine.exec(readFileSync(new URL('../netlify/database/migrations/0001_changban.sql',import.meta.url),'utf8'));
const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:55439,maxConnections:20});
let server,browser,logs='';
try {
 await socket.start();
 const connection='postgresql://postgres:postgres@127.0.0.1:55439/postgres?sslmode=disable';
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3013'],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true,
  env:{...process.env,CHANGBAN_BACKEND:'netlify',NETLIFY_DB_URL:connection,NETLIFY_DB_DRIVER:'server',NEXT_TELEMETRY_DISABLED:'1'},
  stdio:['ignore','pipe','pipe'],
 });
 server.stdout.on('data',b=>{logs+=b;});server.stderr.on('data',b=>{logs+=b;});
 const base='http://127.0.0.1:3013';
 let ready=false;
 for(let n=0;n<60;n++){
  if(server.exitCode!==null)throw new Error('Production server exited before ready');
  try{const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Production server did not start');
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 const elder=await browser.newContext({viewport:{width:390,height:844}}),family=await browser.newContext({viewport:{width:1360,height:960}}),errors=[];
 async function api(context,path,data){
  const r=data?await context.request.post(base+path,{data,headers:{origin:base}}):await context.request.get(base+path);
  const body=await r.json();assert.equal(r.ok(),true,JSON.stringify(body));
  if(r.headers()['set-cookie']){
   const token=r.headers()['set-cookie'].match(/changban_session=([a-f0-9]{64})/)?.[1];
   // Local HTTP fixture only: production code must keep its Secure cookie.
   if(token)await context.addCookies([{name:'changban_session',value:token,url:base,httpOnly:true,sameSite:'Lax',secure:false}]);
  }
  return body;
 }
 const password='Demo2026Pass';
 await api(elder,'/api/account',{action:'register',username:'netlify_ui_elder',password,role:'elder',name:'陈阿姨'});
 let state=await api(elder,'/api/care');
 await api(family,'/api/account',{action:'register',username:'netlify_ui_family',password,role:'caregiver'});
 await api(family,'/api/account',{action:'bind',code:state.family.invite,name:'小林',phone:'00000000000',relation:'子女'});
 await api(family,'/api/care',{action:'plan',plan:{title:'联调一起逛街',kind:'activity',time:'16:00',frequency:'once',date:state.today,weekday:4,note:'Netlify PostgreSQL'}});
 const pages=[];
 for(const [context,username,role] of [[elder,'netlify_ui_elder','elder'],[family,'netlify_ui_family','caregiver']]){
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(username=>localStorage.setItem('changban-pet-v2:'+username,JSON.stringify({enabled:false})),username);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'主导航'}).waitFor();
  await page.locator('.task-row').filter({hasText:'联调一起逛街'}).waitFor();
  assert.equal(await page.getByRole('button',{name:role==='elder'?'日常':'关怀',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await pages[0].getByRole('button',{name:'完成联调一起逛街',exact:true}).click();
 await pages[1].waitForFunction(()=>[...document.querySelectorAll('.task-row')].some(r=>r.textContent.includes('联调一起逛街')&&r.textContent.includes('已完成')),null,{timeout:20000});
 for(const page of pages){
  await page.getByRole('button',{name:'历史',exact:true}).click();await page.locator('.history-detail').waitFor();
  await page.locator('.daily-history-task').filter({hasText:'联调一起逛街'}).filter({hasText:'记录完成'}).waitFor();
  await page.getByRole('button',{name:'记录',exact:true}).click();await page.getByRole('heading',{name:'陈阿姨的生活记录',exact:true}).waitFor();
 }
 // Re-enable pet on mobile to verify that the shared V2 asset still loads.
 await pages[0].evaluate(()=>localStorage.setItem('changban-pet-v2:netlify_ui_elder',JSON.stringify({enabled:true})));
 await pages[0].reload({waitUntil:'domcontentloaded'});
 await pages[0].getByRole('navigation',{name:'主导航'}).waitFor();
 const image=await pages[0].request.get(base+'/pets/rabbit.png');assert.equal(image.status(),200);
 assert.deepEqual(errors,[]);
 assert.equal(/cloudflare:workers|Database unavailable|MissingDatabaseConnectionError|node:sqlite/.test(logs),false);
 console.log('PASS: production Next build + actual Netlify SDK + PostgreSQL protocol; elder mobile and caregiver desktop, new schedule visibility, cross-device completion/history, dynamic record title, pet asset and no runtime errors.');
} catch(error){
 console.error(logs.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[local test database]'));
 throw error;
} finally {
 if(browser)await browser.close();
 if(server&&server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}
 await socket.stop();await engine.close();
}
