import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase, postgresSql } from '../db/postgres-adapter.ts';

assert.equal(postgresSql("SELECT '?' AS senderName FROM members WHERE user=? -- ?\nAND name='user'").sql,
  'SELECT \'?\' AS "senderName" FROM members WHERE "user"=$1 -- ?\nAND name=\'user\'');
assert.equal(postgresSql('INSERT OR IGNORE INTO history_tracking (family) VALUES (?);').sql,
  'INSERT INTO history_tracking (family) VALUES ($1) ON CONFLICT DO NOTHING');
const engine = new PGlite();
await engine.exec(readFileSync(new URL('../netlify/database/migrations/0001_changban.sql', import.meta.url), 'utf8'));
const query = async (sql, values) => { const r = await engine.query(sql, values); return {rows:r.rows,rowCount:r.affectedRows ?? r.rows.length}; };
const db = createPostgresDatabase(() => ({query,connect:async()=>({query,release(){}})}));
globalThis.__changbanTestDatabase = db;
const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({resolve(specifier, context, next) {
  if(specifier==='@/db/runtime') return {url:'data:text/javascript,export const localPreview=false; export function database(){return globalThis.__changbanTestDatabase}',shortCircuit:true};
  if(specifier.startsWith('@/')) return {url:pathToFileURL(resolve(root,specifier.slice(2)+'.ts')).href,shortCircuit:true};
  if(specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const url=new URL(specifier+'.ts',context.parentURL);
    if(existsSync(url)) return {url:url.href,shortCircuit:true};
  }
  return next(specifier,context);
}});
const account=await import('../app/api/account/route.ts'),care=await import('../app/api/care/route.ts'),history=await import('../app/api/history/route.ts');
const sessions=new Map();
async function request(who,api,body,expected=200,search='') {
 const req=new Request('https://demo.test/api/'+api+search,{method:body?'POST':'GET',headers:{origin:'https://demo.test',cookie:sessions.get(who)||'','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const mod={account,care,history}[api],r=await mod[body?'POST':'GET'](req),data=await r.json();
 assert.equal(r.status,expected,JSON.stringify(data));
 if(r.headers.has('set-cookie')) {assert.match(r.headers.get('set-cookie'),/HttpOnly.*SameSite=Lax.*Secure/);sessions.set(who,r.headers.get('set-cookie').split(';')[0]);}
 return data;
}
const password='Demo2026Pass';
try {
 await request('anonymous','care',null,401);
 await request('anonymous','history',null,401);
 await request('elder','account',{action:'register',role:'elder',username:'postgres_elder',password,name:'陈阿姨'});
 let state=await request('elder','care');const family=state.family.id,today=state.today;
 await request('family','account',{action:'register',role:'caregiver',username:'postgres_family',password});
 await request('family','care',null,409);
 await request('family','account',{action:'bind',code:state.family.invite,name:'小林',phone:'00000000000',relation:'子女'});
 state=await request('family','care');assert.equal(state.family.invite,undefined);assert.equal(state.family.id,family);
 await request('other','account',{action:'register',role:'elder',username:'postgres_other',password,name:'其他家庭'});
 await request('elder','care',{action:'plan',plan:{}},403);
 const plan={title:'测试散步',kind:'activity',time:'00:00',frequency:'daily',date:today,weekday:4,note:"don't interpolate ? or user"};
 state=await request('family','care',{action:'plan',plan});
 const reminder=state.plans.find(p=>p.title===plan.title);assert.equal(reminder.note,plan.note);
 await request('other','care',{action:'task',id:reminder.id,status:'done'},404);
 await request('family','care',{action:'task',id:reminder.id,status:'done'},403);
 const nudged=await request('family','care',{action:'nudge',id:reminder.id});
 assert.equal(nudged.nudges[0].senderName,'小林');assert.equal(nudged.nudges[0].senderRelation,'子女');
 await request('family','care',{action:'nudge',id:reminder.id},409);
 await request('elder','care',{action:'nudgeSeen',id:nudged.nudges[0].id});
 await request('elder','care',{action:'task',id:reminder.id,status:'done'});
 const progress=await request('family','care');assert.equal(progress.tasks.find(p=>p.id===reminder.id).status,'done');
 const h=await request('family','history',null,200,'?range=30');assert.equal(h.selected.coverage,'full');assert.ok(h.selected.tasks.some(t=>t.title===plan.title&&t.status==='done'));
 await request('family','care',{action:'plan',plan:{...plan,id:reminder.id,title:'改名后的散步'}});
 await request('family','care',{action:'archive',id:reminder.id});
 const saved=await request('elder','history');assert.ok(saved.selected.tasks.some(t=>t.title===plan.title&&t.status==='done'));
 await request('elder','care',{action:'record',record:{mood:'开心',sleep:7.5,systolic:null,diastolic:null,note:'原型记录'}});
 assert.equal((await request('family','care')).records[0].sleep,7.5);
 await request('elder','care',{action:'share',share:false});assert.equal((await request('family','care')).records.length,0);
 await request('elder','care',{action:'checkin',mood:'contact'});
 const contacts=(await request('family','care')).requests;assert.equal(contacts.length,1);
 await request('family','care',{action:'request',id:contacts[0].id,status:'resolved'});
 await request('elder','care',{action:'profile',profile:{name:'陈奶奶',city:'广州',check_time:'10:00'}});
 assert.equal((await request('family','care')).family.name,'陈奶奶');
 await request('other','history',null,400,'?date=2099-01-01');
 await request('family','account',{action:'logout'});assert.equal((await request('family','account')).authenticated,false);
 await request('family','account',{action:'login',username:'postgres_family',password});
 assert.equal((await request('family','care')).family.id,family);
 console.log('PASS: PostgreSQL real API handlers: roles, independent families, binding, sessions, daily sync, nudge cooldown/aliases, history snapshots, sharing, decimal records and contact requests.');
 const before=await db.prepare('SELECT COUNT(*) AS count FROM app_users').first();
 await assert.rejects(db.batch([
   db.prepare('INSERT INTO app_users (id,username,password_hash,salt,role,created) VALUES (?,?,?,?,?,?)').bind('rollback','rollback','test','test','elder','now'),
   db.prepare('INSERT INTO app_users (id,username,password_hash,salt,role,created) VALUES (?,?,?,?,?,?)').bind('rollback','duplicate','test','test','elder','now'),
 ]));
 assert.deepEqual(await db.prepare('SELECT COUNT(*) AS count FROM app_users').first(),before);
 await assert.rejects(db.prepare('SELECT ? AS test').all(),/parameter count/);
 const hostile=await account.POST(new Request('https://demo.test/api/account',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({action:'logout'})}));
 assert.equal(hostile.status,403);
 console.log('PASS: parameter binding, PostgreSQL batch rollback and same-origin protection; all test data lives only in an isolated in-memory PostgreSQL engine.');
} finally {await engine.close();delete globalThis.__changbanTestDatabase;}
