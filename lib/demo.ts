import { addCalendarDays, buildDailyHistory, scheduled, shanghaiDate, type CareState, type DailyHistoryResponse, type HistoryOccurrence, type Reminder, type ReminderRevision, type Role } from './care';
import type { CareTransport } from './care-transport';

/** Per-entry in-memory sandbox. Never imports a database, cookie or fetch. */
export function createDemoStore(now = new Date()) {
 const day=shanghaiDate(now),start=addCalendarDays(day,-6),id=crypto.randomUUID();
 let clock=now.getTime(),sequence=0;
 const stamp=()=>new Date(clock=Math.max(clock+1,Date.now())).toISOString();
 const plans:(Reminder&{active:number})[]=[
  {id:'water',title:'喝一杯温水',kind:'other',time:'08:00',frequency:'daily',date:start,weekday:0,note:'虚拟演示：给自己一点温柔的照顾',active:1},
  {id:'stretch',title:'做一会儿轻松伸展',kind:'activity',time:'00:00',frequency:'daily',date:start,weekday:0,note:'虚拟演示：可试试家属的一键提醒',active:1},
  {id:'walk',title:'到楼下散散步',kind:'activity',time:'20:00',frequency:'daily',date:start,weekday:0,note:'虚拟演示：按自己的节奏来',active:1},
  {id:'shopping',title:'和家人一起逛街',kind:'activity',time:'16:00',frequency:'once',date:addCalendarDays(day,1),weekday:0,note:'虚拟演示：明天的安排不计入今天进度',active:1},
 ];
 const revisions:ReminderRevision[]=plans.map(p=>({...p,reminder:p.id,sequence:++sequence,effective:new Date(start+'T00:00:00+08:00').toISOString()}));
 const occurrences:HistoryOccurrence[]=[];
 for(let n=0;n<7;n++)for(let j=0;j<3;j++)if(n===0?j===0:(n+j)%3!==0){const p=plans[j],date=addCalendarDays(day,-n);occurrences.push({reminder:p.id,date,status:'done',snooze:null,updated:new Date(date+'T08:30:00+08:00').toISOString(),title:p.title,time:p.time,kind:p.kind,note:p.note});}
 const records:CareState['records']=[{id:'demo-record',date:day,mood:'开心',sleep:8,systolic:null,diastolic:null,note:'这是虚拟生活记录，可以试试记下今天。',created:now.toISOString()}];
 const checkins:CareState['checkins']=[],requests:CareState['requests']=[],nudges:CareState['nudges']=[];
 let name='陈阿姨',city='广州',check_time='10:00',share=1,familyName='女儿 · 小林',phone='';
 function view(role:Role):CareState {
  const active=plans.filter(p=>p.active).map(({active,...p})=>{void active;return p;});
  const result:CareState={today:day,now:new Date().toISOString(),role,account:{username:`demo:${id}:${role}`,role},self:role==='elder'?{name,phone:'',relation:''}:{name:familyName,phone,relation:'子女'},family:{id:'demo:'+id,name,city,share,check_time,...(role==='elder'?{invite:'DEMOONLY00000001'}:{})},
   members:[{role:'elder',name,phone:'',relation:'',isSelf:role==='elder'},{role:'caregiver',name:familyName,phone:'',relation:'子女',isSelf:role==='caregiver'}],plans:active,
   tasks:active.filter(p=>scheduled(p,day)).map(p=>{const o=occurrences.find(o=>o.reminder===p.id&&o.date===day);return {...p,status:o?.status??'pending',snooze:o?.snooze??undefined,updated:o?.updated};}),records:role==='elder'||share?records:[],checkins,requests,nudges,
   history:occurrences.map(o=>({date:o.date,status:o.status,title:o.title,updated:o.updated})).sort((a,b)=>b.updated.localeCompare(a.updated))};
  return structuredClone(result);
 }
 function history(date:string,range:number):DailyHistoryResponse {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<start||date>day)throw new Error('请选择样例提供的近 7 天日期。');
  const selected=buildDailyHistory(date,start,revisions,occurrences),days=[];
  for(let d=date;d>=start&&days.length<range;d=addCalendarDays(d,-1)){const {tasks,...summary}=buildDailyHistory(d,start,revisions,occurrences);void tasks;days.push(summary);}
  return {today:day,now:new Date().toISOString(),trackingStart:start,earliestDate:start,selected,days};
 }
 function mutate(role:Role,b:Record<string,unknown>) {
  const action=String(b.action),elder=()=>{if(role!=='elder')throw new Error('请切换到体验老人端操作。');},family=()=>{if(role!=='caregiver')throw new Error('请切换到体验家属端操作。');};
  const reminder=()=>{const r=plans.find(p=>p.id===b.id&&p.active);if(!r)throw new Error('找不到这件演示日程。');return r;};
  if(action==='task'){
   elder();const r=reminder();if(!scheduled(r,day))throw new Error('这件日程不属于今天。');
   const status=String(b.status);if(!['done','pending','snoozed'].includes(status))throw new Error('状态无效。');
   const o:HistoryOccurrence={reminder:r.id,date:day,status,snooze:status==='snoozed'?new Date(Date.now()+600000).toISOString():null,updated:stamp(),title:r.title,time:r.time,kind:r.kind,note:r.note};
   const i=occurrences.findIndex(v=>v.reminder===r.id&&v.date===day);if(i<0)occurrences.push(o);else occurrences[i]=o;
  }else if(action==='plan'){
   family();const p=b.plan as Reminder;if(!p?.title?.trim()||!/^\d{2}:\d{2}$/.test(p.time)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw new Error('请检查演示日程的标题和时间。');
   const old=p.id?plans.find(v=>v.id===p.id&&v.active):undefined;if(p.id&&!old)throw new Error('找不到演示日程。');
   const next={id:old?.id??crypto.randomUUID(),title:p.title.slice(0,80),kind:p.kind,time:p.time,frequency:p.frequency,date:p.date,weekday:p.weekday,note:p.note,active:1};
   if(old)Object.assign(old,next);else plans.push(next);revisions.push({...next,reminder:next.id,sequence:++sequence,effective:stamp()});
  }else if(action==='archive'){
   family();const r=reminder();r.active=0;revisions.push({...r,reminder:r.id,sequence:++sequence,effective:stamp()});
  }else if(action==='nudge'){
   family();const r=reminder(),task=view(role).tasks.find(p=>p.id===r.id);if(!task||task.status==='done')throw new Error('这件日程已完成或不属于今天。');
   if(Date.parse(task.snooze??day+'T'+task.time+':00+08:00')>Date.now())throw new Error('还没有到提醒时间。');
   const old=nudges.find(n=>n.reminder===r.id);if(old&&Date.now()-Date.parse(old.created)<300000)throw new Error('刚刚已提醒过，5 分钟内不重复提醒。');
   const n={id:crypto.randomUUID(),reminder:r.id,date:day,senderName:familyName,senderRelation:'子女',due:day+'T'+r.time+':00+08:00',created:stamp(),seen:null};if(old)Object.assign(old,n);else nudges.unshift(n);
  }else if(action==='nudgeSeen'){elder();const n=nudges.find(v=>v.id===b.id);if(n)n.seen=stamp();
  }else if(action==='record'){
   elder();const r=b.record as CareState['records'][number];if(!r||!Number.isFinite(r.sleep))throw new Error('请填写睡眠时间。');
   const record={id:'demo-record',date:day,mood:r.mood,sleep:r.sleep,systolic:r.systolic,diastolic:r.diastolic,note:r.note,created:stamp()};if(records[0]?.date===day)records[0]=record;else records.unshift(record);
  }else if(action==='checkin'||action==='contact'){
   elder();if(action==='checkin'){const c={date:day,mood:String(b.mood),updated:stamp()};if(checkins.length)checkins[0]=c;else checkins.push(c);}
   if((action==='contact'||b.mood==='contact')&&!requests.some(r=>r.status!=='resolved'))requests.unshift({id:crypto.randomUUID(),status:'pending',created:stamp(),seen:null,resolved:null});
  }else if(action==='request'){
   family();const r=requests.find(v=>v.id===b.id);if(r){r.status=String(b.status);r.seen??=stamp();if(r.status==='resolved')r.resolved=stamp();}
  }else if(action==='share'){elder();share=b.share?1:0;
  }else if(action==='profile'){elder();const p=b.profile as Record<string,string>;name=p.name||name;city=p.city??city;check_time=p.check_time||check_time;
  }else if(action==='member'){const m=b.member as Record<string,string>;if(role==='caregiver'){familyName=m.name||familyName;phone='';}else name=m.name||name;
  }else throw new Error('体验模式不提供真实绑定、家庭码更换或外部电话，请注册账号使用。');
 }
 function transport(role:Role):CareTransport {return async(path,init)=>{
  try {
   const url=new URL(path,'https://demo.invalid');
   if(url.pathname==='/api/history')return Response.json(history(url.searchParams.get('date')??day,Number(url.searchParams.get('range')??7)));
   if(url.pathname!=='/api/care')throw new Error('体验模式不访问真实账号接口。');
   if(init?.method==='POST')mutate(role,JSON.parse(String(init.body)));
   return Response.json(view(role));
  }catch(e){return Response.json({error:e instanceof Error?e.message:'演示操作失败。'},{status:400});}
 };}
 return {view,history,transport};
}
