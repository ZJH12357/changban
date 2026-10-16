import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { addCalendarDays } from '../lib/care.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const base='http://127.0.0.1:3000',suffix=Date.now().toString(36),password='Demo2026Pass';
const elder=await browser.newContext({viewport:{width:1360,height:960}}),care=await browser.newContext({viewport:{width:1360,height:960}}),errors=[];
async function api(c,path,data){const r=data?await c.request.post(base+path,{data}):await c.request.get(base+path);assert.equal(r.ok(),true,await r.text());return r.json();}
async function pageFor(c,username){const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(username=>localStorage.setItem('changban-pet-v2:'+username,JSON.stringify({enabled:false})),username);await page.goto(base);await page.getByRole('button',{name:'历史',exact:true}).click();await page.locator('.history-detail').waitFor();return page;}
try{
 const ename='hist_e_'+suffix,cname='hist_c_'+suffix;
 await api(elder,'/api/account',{action:'register',username:ename,password,role:'elder',name:'日程历史测试'});
 let state=await api(elder,'/api/care');const family=state.family.id,today=state.today,yesterday=addCalendarDays(today,-1),start=addCalendarDays(today,-2),legacy=addCalendarDays(today,-3);
 await api(care,'/api/account',{action:'register',username:cname,password,role:'caregiver'});
 await api(care,'/api/account',{action:'bind',code:state.family.invite,name:'测试家属',phone:'00000000000',relation:'子女'});
 for(const p of state.plans)await api(care,'/api/care',{action:'archive',id:p.id});
 const fixture=[];
 for(const title of ['散步记录','喝水记录','当日停用项目']){
  state=await api(care,'/api/care',{action:'plan',plan:{title,kind:'activity',time:'16:00',frequency:'daily',date:start,weekday:4,note:'历史界面验收'}});
  fixture.push(state.plans.find(p=>p.title===title));
 }
 const db=new DatabaseSync(fileURLToPath(new URL('../.data/changban.sqlite',import.meta.url)));
 try{
  db.prepare('UPDATE families SET created=? WHERE id=?').run(new Date(legacy+'T00:00:00+08:00').toISOString(),family);
  db.prepare('UPDATE history_tracking SET start_date=?,started_at=? WHERE family=?').run(start,new Date(start+'T00:00:00+08:00').toISOString(),family);
  for(const p of fixture)db.prepare('UPDATE reminder_revisions SET effective=? WHERE family=? AND reminder=?').run(new Date(start+'T00:00:00+08:00').toISOString(),family,p.id);
  for(const day of [yesterday,legacy])db.prepare('INSERT INTO occurrences (id,family,reminder,date,status,updated) VALUES (?,?,?,?,?,?)').run(fixture[0].id+':'+day,family,fixture[0].id,day,'done',new Date(day+'T16:05:00+08:00').toISOString());
 }finally{db.close();}
 await api(care,'/api/care',{action:'archive',id:fixture[2].id});
 await api(elder,'/api/care',{action:'task',id:fixture[0].id,status:'done'});
 await api(care,'/api/care',{action:'plan',plan:{...fixture[0],title:'今天改过的散步名称'}});
 const ep=await pageFor(elder,ename),cp=await pageFor(care,cname);
 assert.deepEqual(await cp.locator('.daily-history-stats b').allTextContents(),['2 项','1 项','1 项']);
 assert.match(await cp.locator(`[data-history-reminder="${fixture[0].id}"]`).innerText(),/散步记录.*记录完成/s);
 assert.equal(await cp.locator('.daily-history-task button').count(),0);
 assert.equal(await cp.locator('.bottom-nav button').count(),6);
 await Promise.all([cp.waitForResponse(r=>r.url().includes('/api/history?')&&r.url().includes('range=30')&&r.status()===200),cp.getByRole('button',{name:'近 30 天',exact:true}).click()]);
 assert.equal(await cp.getByRole('button',{name:'近 30 天',exact:true}).getAttribute('aria-pressed'),'true');
 console.log('PASS: both roles can open history; today has daily totals, completion time and cancellations; history is read-only; 7/30-day controls work.');
 await cp.locator('input[aria-label="查看日期"]').fill(yesterday);
 await cp.locator('.history-detail').filter({hasText:yesterday+'的日程明细'}).waitFor();
 assert.deepEqual(await cp.locator('.daily-history-stats b').allTextContents(),['3 项','1 项','2 项']);
 assert.match(await cp.locator(`[data-history-reminder="${fixture[0].id}"]`).innerText(),/散步记录/);
 assert.equal((await cp.locator('.history-detail').innerText()).includes('今天改过的散步名称'),false);
 await cp.screenshot({path:'outputs/history-desktop.png',fullPage:true});
 await ep.locator('input[aria-label="查看日期"]').fill(yesterday);await ep.locator('.history-detail').filter({hasText:yesterday+'的日程明细'}).waitFor();
 assert.deepEqual(await ep.locator('.daily-history-stats b').allTextContents(),['3 项','1 项','2 项']);
 await cp.locator('input[aria-label="查看日期"]').fill(legacy);await cp.locator('.history-detail').filter({hasText:legacy+'的日程明细'}).waitFor();
 assert.match(await cp.locator('.history-detail').innerText(),/旧操作记录/);assert.equal(await cp.locator('progress').count(),0);
 console.log('PASS: earlier-day schedules and original names survive edits/archives; both roles agree; legacy records never fabricate a completion rate.');
 await cp.getByRole('button',{name:'回到今天',exact:true}).click();await cp.locator('.history-detail').filter({hasText:'今天的日程明细'}).waitFor();
 await api(elder,'/api/care',{action:'task',id:fixture[1].id,status:'done'});
 await cp.waitForFunction(()=>document.querySelectorAll('.daily-history-stats b')[1]?.textContent==='2 项',null,{timeout:20000});
 await cp.setViewportSize({width:390,height:844});await cp.waitForTimeout(500);
 await cp.screenshot({path:'outputs/history-mobile.png',fullPage:true});
 assert.equal(await cp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await cp.reload();await cp.getByRole('button',{name:'历史',exact:true}).click();await cp.locator('.history-detail').waitFor();
 assert.deepEqual(await cp.locator('.daily-history-stats b').allTextContents(),['2 项','2 项','0 项']);
 assert.deepEqual(errors,[]);
 console.log('PASS: elder completion updates caregiver history, refresh persists records, six-item mobile navigation fits, and no browser runtime errors occur.');
}finally{await browser.close();}
