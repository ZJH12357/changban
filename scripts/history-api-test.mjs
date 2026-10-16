import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { addCalendarDays } from '../lib/care.ts';
const base='http://127.0.0.1:3000',suffix=Date.now().toString(36),password='Demo2026Pass';
function client(){let cookie='';return async(path,body,expected=200)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});const next=r.headers.get('set-cookie');if(next)cookie=next.split(';')[0];const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;};}
const elder=client(),care=client(),other=client(),anonymous=client();
await anonymous('/api/history',null,401);
await elder('/api/account',{action:'register',username:'h_elder_'+suffix,password,role:'elder',name:'历史测试老人'});
let state=await elder('/api/care');const family=state.family.id,today=state.today,yesterday=addCalendarDays(today,-1),start=addCalendarDays(today,-7),old=addCalendarDays(start,-1);
await care('/api/account',{action:'register',username:'h_care_'+suffix,password,role:'caregiver'});
await care('/api/account',{action:'bind',code:state.family.invite,name:'历史测试家属',phone:'00000000000',relation:'子女'});
await other('/api/account',{action:'register',username:'h_other_'+suffix,password,role:'elder',name:'其他家庭'});
for(const p of state.plans)await care('/api/care',{action:'archive',id:p.id});
const plan={title:'历史原名',kind:'activity',time:'16:00',frequency:'daily',date:start,weekday:4,note:'历史原备注'};
state=await care('/api/care',{action:'plan',plan});const task=state.plans.find(p=>p.title===plan.title);
// Time-travel fixture touches only this freshly created test family.
const db=new DatabaseSync(fileURLToPath(new URL('../.data/changban.sqlite',import.meta.url)));
try{
 db.prepare('UPDATE families SET created=? WHERE id=?').run(new Date(old+'T00:00:00+08:00').toISOString(),family);
 db.prepare('UPDATE history_tracking SET start_date=?,started_at=? WHERE family=?').run(start,new Date(start+'T00:00:00+08:00').toISOString(),family);
 db.prepare('UPDATE reminder_revisions SET effective=? WHERE family=? AND reminder=?').run(new Date(start+'T00:00:00+08:00').toISOString(),family,task.id);
 const insert=db.prepare('INSERT INTO occurrences (id,family,reminder,date,status,snooze,updated) VALUES (?,?,?,?,?,NULL,?)');
 insert.run(task.id+':'+yesterday,family,task.id,yesterday,'done',new Date(yesterday+'T16:05:00+08:00').toISOString());
 insert.run(task.id+':'+old,family,task.id,old,'done',new Date(old+'T16:05:00+08:00').toISOString());
}finally{db.close();}
await care('/api/care',{action:'plan',plan:{...plan,id:task.id,title:'今天修改后的名称',time:'17:00'}});
let h=await care('/api/history?date='+yesterday+'&range=7');
assert.equal(h.selected.total,1);assert.equal(h.selected.done,1);assert.equal(h.selected.tasks[0].title,'历史原名');assert.equal(h.selected.tasks[0].time,'16:00');
assert.equal(h.days.length,7);assert.ok(h.days.some(d=>d.pending===1&&d.done===0));
assert.deepEqual((await elder('/api/history?date='+yesterday)).selected,h.selected);
assert.equal((await other('/api/history?family='+family)).selected.tasks.some(t=>t.reminder===task.id),false);
await care('/api/care',{action:'archive',id:task.id});
h=await elder('/api/history?date='+yesterday);assert.equal(h.selected.done,1);assert.equal(h.selected.tasks[0].title,'历史原名');
h=await elder('/api/history?date='+today);assert.equal(h.selected.tasks.find(t=>t.reminder===task.id).status,'cancelled');
h=await elder('/api/history?date='+old);assert.equal(h.selected.coverage,'legacy');assert.equal(h.selected.rate,null);assert.equal(h.selected.tasks[0].title,'历史原名');
await elder('/api/history?date=2026-02-30',null,400);
await elder('/api/history?date='+addCalendarDays(today,1),null,400);
await elder('/api/history?range=365',null,400);
assert.equal((await elder('/api/history?date='+today+'&range=30')).days.length,9);
console.log('PASS: protected daily history, full/legacy ranges, untouched days, immutable renamed/archived past schedules, cancellation, role/family isolation and invalid/future-date rejection.');
