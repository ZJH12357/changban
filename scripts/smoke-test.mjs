import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const origin='http://127.0.0.1:3000',suffix=Date.now().toString(36),password='Care2026Demo';
function client(){let cookie='';return async(path,payload=null,expected=200)=>{const response=await fetch(origin+path,{method:payload?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(payload?{'Content-Type':'application/json',Origin:origin}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];let data;try{data=await response.json()}catch{throw new Error('Non-JSON response '+response.status)}assert.equal(response.status,expected,JSON.stringify(data));return data;}}
const elder=client(),caregiver=client(),outsider=client();
assert.equal((await elder('/api/account')).authenticated,false);
let account=await elder('/api/account',{action:'register',username:'elder_'+suffix,password,role:'elder',name:'林测试',phone:'138 0000 0001',city:'广州'});assert.equal(account.account.role,'elder');assert.equal(account.needsBinding,false);
let state=await elder('/api/care');assert.equal(state.role,'elder');assert.ok(state.family.invite);assert.equal(state.members.length,1);const invite=state.family.invite,id=state.tasks[0].id;
assert.equal((await elder('/api/care?role=caregiver')).role,'elder');
await elder('/api/care',{action:'plan',plan:{title:'越权提醒',kind:'other',time:'12:00',frequency:'daily',date:state.today,weekday:4,note:''}},403);
state=await elder('/api/care',{action:'task',id,status:'done'});assert.equal(state.tasks.find(t=>t.id===id).status,'done');
state=await elder('/api/care',{action:'checkin',mood:'good'});assert.equal(state.checkins[0].mood,'good');
state=await elder('/api/care',{action:'record',record:{mood:'开心',sleep:8,systolic:120,diastolic:80,note:'账号流程验证'}});assert.equal(state.records.length,1);
account=await caregiver('/api/account',{action:'register',username:'care_'+suffix,password,role:'caregiver'});assert.equal(account.needsBinding,true);
await caregiver('/api/care',null,409);
await caregiver('/api/account',{action:'bind',code:'AAAAAAAAAAAAAAAA',name:'测试女儿',phone:'138 0000 0002',relation:'子女'},404);
account=await caregiver('/api/account',{action:'bind',code:invite,name:'测试女儿',phone:'138 0000 0002',relation:'子女'});assert.equal(account.needsBinding,false);
state=await caregiver('/api/care');assert.equal(state.role,'caregiver');assert.equal(state.family.invite,undefined);assert.ok(state.members.some(m=>m.name==='测试女儿'&&m.relation==='子女'&&m.isSelf));
assert.ok((await elder('/api/care')).members.some(m=>m.name==='测试女儿'&&m.relation==='子女'));
await caregiver('/api/care',{action:'task',id,status:'done'},403);await caregiver('/api/care',{action:'rotateInvite'},403);await caregiver('/api/care',{action:'share',share:false},403);
state=await caregiver('/api/care',{action:'plan',plan:{title:'家属添加的提醒',kind:'activity',time:'19:00',frequency:'daily',date:state.today,weekday:4,note:'一起散步'}});assert.ok(state.tasks.some(t=>t.title==='家属添加的提醒'));
await elder('/api/account',{action:'logout'});assert.equal((await elder('/api/account')).authenticated,false);await elder('/api/care',null,401);
await elder('/api/account',{action:'login',username:'elder_'+suffix,password:'Wrong2026'},401);
account=await elder('/api/account',{action:'login',username:'elder_'+suffix,password});assert.equal(account.account.role,'elder');assert.ok((await elder('/api/care')).family.invite);
await outsider('/api/account',{action:'register',username:'other_'+suffix,password,role:'elder',name:'周阿姨',phone:'',city:'深圳'});const other=await outsider('/api/care');assert.notEqual(other.family.id,(await elder('/api/care')).family.id);assert.equal(other.members.length,1);
// A pre-fix local account must still log in after new registrations switch hash format.
const legacyName='legacy_'+suffix,legacySalt=randomBytes(16).toString('hex');
const legacyHash=pbkdf2Sync(password,Buffer.from(legacySalt,'hex'),120000,32,'sha256').toString('hex');
const fixtureDb=new DatabaseSync(fileURLToPath(new URL('../.data/changban.sqlite',import.meta.url)));
try{fixtureDb.prepare('INSERT INTO app_users (id,username,password_hash,salt,role,created) VALUES (?,?,?,?,?,?)').run(randomUUID(),legacyName,legacyHash,legacySalt,'caregiver',new Date().toISOString());}finally{fixtureDb.close();}
const legacyClient=client();
await legacyClient('/api/account',{action:'login',username:legacyName,password:'Wrong2026'},401);
account=await legacyClient('/api/account',{action:'login',username:legacyName,password});
assert.equal(account.authenticated,true);assert.equal(account.account.role,'caregiver');assert.equal(account.needsBinding,true);
console.log('PASS: account registration/login/logout, legacy local login, fixed roles, caregiver onboarding, family-code privacy, member relationship, authorization, persistence, and family isolation.');
