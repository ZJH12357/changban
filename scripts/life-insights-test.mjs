import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const queries=[];let share=0,memberRole='caregiver';
globalThis.__insightDB={prepare(sql){
 queries.push(sql);
 return {bind(){return {
  async first(){return sql.includes('start_date')?{startDate:'2026-10-22'}:{family:'test-family',role:memberRole,share};},
  async all(){return {results:[]};},
 };}};
}};
registerHooks({resolve(s,c,next){
 if(s==='@/db/runtime')return {url:'data:text/javascript,export function database(){return globalThis.__insightDB}',shortCircuit:true};
 if(s==='@/lib/app-auth')return {url:'data:text/javascript,'+encodeURIComponent(`export async function getAccount(r){return r.headers.has('x-test')?{id:'test',role:r.headers.get('x-role')||'caregiver'}:null} export function assertSameOrigin(r){if(r.headers.get('origin')!=='https://test.local')throw Error('origin')}`),shortCircuit:true};
 if(s.startsWith('@/lib/'))return {url:new URL('../lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};
 if(c.parentURL?.includes('/lib/')&&['./care','./life-insights','./ai-schedule-server','./schedule-conversation'].includes(s))return {url:new URL('../lib/'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};
 return next(s,c);
}});
const {buildInsightSnapshot,basicInsightReport}=await import('../lib/life-insights.ts');
const {insightContext,generateAIInsight}=await import('../lib/life-insights-server.ts');
const {aiConfig}=await import('../lib/ai-schedule-server.ts');
const today='2026-10-28',now=today+'T04:00:00Z';
const task=(status,time='10:00',kind='activity')=>({reminder:crypto.randomUUID(),title:'PRIVATE_TITLE',note:'PRIVATE_NOTE',time,kind,status,updated:null,snooze:null,legacy:false});
const day=(date,tasks,coverage='full')=>({date,tasks,coverage,total:tasks.length,done:tasks.filter(t=>t.status==='done').length,pending:tasks.filter(t=>t.status!=='done').length,cancelled:tasks.filter(t=>t.status==='cancelled').length,rate:null});
const days=[day('2026-10-22',[task('done'),task('pending')],'legacy'),day(today,[task('done'),task('pending'),task('pending','20:00'),task('cancelled')])];
const records=[{date:'2026-10-22',mood:'平静',sleep:8,note:'PRIVATE_NOTE'},{date:'2026-10-23',mood:'开心',sleep:8},{date:'2026-10-27',mood:'低落',sleep:6},{date:today,mood:'平静',sleep:6},{date:'2026-10-29',mood:'低落',sleep:0}];
const base={today,now,role:'elder',days,records,includeLife:true,lifeShared:false};
let s=buildInsightSnapshot(base);assert.equal(s.days.length,7);assert.equal(s.start,'2026-10-22');assert.equal(s.summary.done,2);assert.equal(s.summary.unrecorded,1);assert.equal(s.summary.upcoming,1);assert.equal(s.summary.coveredDays,1);assert.equal(s.summary.lifeDays,4);assert.equal(s.summary.averageSleep,7);assert.equal(s.summary.sleepChange,-2);assert.equal(s.summary.lowMoodDays,1);assert.ok(!JSON.stringify(s).includes('PRIVATE'));
const privateView=buildInsightSnapshot({...base,role:'caregiver'});assert.equal(privateView.lifeIncluded,false);assert.equal(privateView.summary.lifeDays,0);assert.ok(!privateView.facts.some(f=>f.id==='mood'));
assert.equal(buildInsightSnapshot({...base,includeLife:false}).summary.lifeDays,0);
assert.equal(buildInsightSnapshot({...base,records:records.slice(0,1)}).summary.sleepChange,null);
assert.equal(buildInsightSnapshot({...base,records:[]}).summary.averageSleep,null);
assert.ok(basicInsightReport(s).suggestions.length>=2);assert.match(basicInsightReport(s).insights[0].interpretation,/核对/);
await insightContext('test','caregiver',true,new Date(now));assert.ok(!queries.some(q=>q.includes('FROM records')),'Private records must not even be queried.');
queries.length=0;share=1;await insightContext('test','caregiver',true,new Date(now));assert.ok(queries.some(q=>q.startsWith('SELECT date,mood,sleep FROM records WHERE family=?')));assert.ok(!queries.some(q=>q.includes('SELECT * FROM records')));
const report=basicInsightReport(s),config=aiConfig({AI_API_KEY:'test-not-real',AI_BASE_URL:'https://api.deepseek.com',AI_MODEL:'deepseek-flash'});let payload;
const mock=output=>async(url,init)=>{payload=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(output)}}]});};
await generateAIInsight(s,config,mock(report));assert.deepEqual(payload.thinking,{type:'disabled'});assert.ok(!JSON.stringify(payload).includes('PRIVATE'));assert.equal(payload.messages.length,2);
await assert.rejects(()=>generateAIInsight(s,config,mock({...report,insights:[{...report.insights[0],evidenceIds:['invented']}]})));
await assert.rejects(()=>generateAIInsight(s,config,mock({...report,insights:[{...report.insights[0],observation:'已完成99999项。'}]})));
await assert.rejects(()=>generateAIInsight(s,config,mock({...report,encouragement:'判断患有抑郁症。'})));
await assert.rejects(()=>generateAIInsight(s,config,async()=>new Response('provider error',{status:429})));
const {POST,GET}=await import('../app/api/life-insights/route.ts');
const request=(body,user=true,origin='https://test.local')=>new Request('https://test.local/api/life-insights',{method:'POST',headers:{origin,...(user?{'x-test':'yes'}:{})},body:JSON.stringify(body)});
assert.equal((await GET(new Request('https://test.local/api/life-insights'))).status,401);
assert.equal((await POST(request({mode:'rules',includeLife:true},false))).status,401);
assert.equal((await POST(request({mode:'rules',includeLife:true},true,'https://evil.invalid'))).status,403);
assert.equal((await POST(request({mode:'ai',includeLife:true}))).status,400);
assert.equal((await POST(request({mode:'rules',includeLife:true,family:'other'}))).status,400);
const result=await (await POST(request({mode:'rules',includeLife:false}))).json();assert.equal(result.mode,'rules');assert.equal(result.snapshot.lifeIncluded,false);assert.ok(result.report.suggestions.length);
memberRole='elder';assert.equal((await POST(request({mode:'rules',includeLife:false}))).status,403);
console.log('PASS: seven-day facts, legacy coverage, future exclusion, rest/mood trends, privacy minimization, evidence validation, consent/origin/role/family guards and rules report (mock AI).');
