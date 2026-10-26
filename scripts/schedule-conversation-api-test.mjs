import assert from 'node:assert/strict';
const base='http://127.0.0.1:3000',suffix=Date.now().toString(36);
function client(){let cookie='';return async(path,body,expected=200)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});const next=r.headers.get('set-cookie');if(next)cookie=next.split(';')[0];const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;};}
const elder=client(),care=client(),other=client(),anon=client();const password='Demo2026Pass';
await elder('/api/account',{action:'register',username:'s_elder_'+suffix,password,role:'elder',name:'会话测试老人'});
let state=await elder('/api/care');await care('/api/account',{action:'register',username:'s_care_'+suffix,password,role:'caregiver'});await care('/api/account',{action:'bind',code:state.family.invite,name:'会话测试家属',phone:'00000000000',relation:'子女'});
await other('/api/account',{action:'register',username:'s_other_'+suffix,password,role:'elder',name:'隔离测试'});
const plan={title:'会话 API 验收 '+suffix,kind:'other',time:'16:30',frequency:'once',date:state.today,weekday:0,note:''},requestId=crypto.randomUUID();
await anon('/api/care',{action:'elderPlan',plan},401);
await elder('/api/care',{action:'plan',plan},403);await care('/api/care',{action:'elderPlan',plan},403);
state=await elder('/api/care',{action:'elderPlan',plan,requestId});const created=state.plans.find(p=>p.title===plan.title);assert.ok(created);
state=await elder('/api/care',{action:'elderPlan',plan,requestId});assert.equal(state.plans.filter(p=>p.title===plan.title).length,1);
await elder('/api/care',{action:'elderPlan',plan:{...plan,title:'变更内容'},requestId},409);
await elder('/api/care',{action:'elderPlan',plan:{...plan,id:created.id}},403);
await other('/api/care',{action:'task',id:created.id,status:'done'},404);await care('/api/care',{action:'task',id:created.id,status:'done'},403);
assert.ok((await care('/api/care')).tasks.some(p=>p.id===created.id));assert.equal((await other('/api/care')).plans.some(p=>p.id===created.id),false);
await elder('/api/care',{action:'elderPlan',plan:{...plan,date:'2026-02-30'}},400);
await elder('/api/care',{action:'elderPlan',plan:{...plan,time:'25:00'}},400);
console.log('PASS: local real API elder creation, caregiver visibility, anonymous/role/family guards, invalid fields, retry deduplication and conflicting request rejection.');
