export type Role="elder"|"caregiver";
export type Reminder={id:string;title:string;kind:string;time:string;frequency:string;date:string;weekday:number;note:string;status?:string;snooze?:string;updated?:string};
export type ContactRequest={id:string;status:string;created:string;seen:string|null;resolved:string|null};
export type FamilyNudge={id:string;reminder:string;date:string;senderName:string;senderRelation:string;due:string;created:string;seen:string|null};
export type LifeRecord={id:string;date:string;mood:string;sleep:number;systolic:number|null;diastolic:number|null;note:string;created:string};
export type CareState={today:string;now:string;role:Role;account:{username:string;role:Role};self:{name:string;phone:string;relation:string};family:{id:string;name:string;city:string;share:number;check_time:string;invite?:string};members:{role:Role;name:string;phone:string;relation:string;isSelf:boolean}[];plans:Reminder[];tasks:Reminder[];checkins:{date:string;mood:string;updated:string}[];requests:ContactRequest[];nudges:FamilyNudge[];records:LifeRecord[];history:{date:string;status:string;title:string;updated:string}[]};
export function shanghaiDate(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function shanghaiTime(now=new Date()){return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false}).format(now);}
export function scheduled(r:Reminder,day:string){if(day<r.date)return false;return r.frequency==="daily" || (r.frequency==="once"&&r.date===day) || (r.frequency==="weekly"&&new Date(day+"T12:00:00+08:00").getUTCDay()===r.weekday);}
export function addCalendarDays(day:string,days:number){const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function nextScheduledDate(r:Reminder,onOrAfter:string):string|null{
 const first=r.date>onOrAfter?r.date:onOrAfter;
 if(r.frequency==="once")return r.date>=onOrAfter?r.date:null;
 if(r.frequency==="daily")return first;
 if(r.frequency==="weekly")return addCalendarDays(first,(r.weekday-new Date(first+"T12:00:00Z").getUTCDay()+7)%7);
 return null;
}
export function upcomingSchedules(plans:Reminder[],today:string):{plan:Reminder;day:string}[]{
 const tomorrow=addCalendarDays(today,1);
 return plans.flatMap(plan=>{const day=nextScheduledDate(plan,tomorrow);return day?[{plan,day}]:[];})
  .sort((a,b)=>a.day.localeCompare(b.day)||a.plan.time.localeCompare(b.plan.time)||a.plan.id.localeCompare(b.plan.id));
}
export function scheduleDateLabel(day:string,today:string){
 const relative=day===today?"今天":day===addCalendarDays(today,1)?"明天":"";
 return (relative?relative+" · ":"")+day;
}
export const kindLabels:Record<string,string>={medicine:"用药",visit:"复诊",activity:"活动",other:"其他"};
export function clockLabel(iso:string){return new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));}

export type ReminderRevision=Reminder&{sequence:number;reminder:string;effective:string;active:number};
export type HistoryOccurrence={reminder:string;date:string;status:string;snooze:string|null;updated:string;title:string;time:string;kind:string;note:string};
export type DailyHistoryTask={reminder:string;title:string;time:string;kind:string;note:string;status:"done"|"pending"|"snoozed"|"cancelled";updated:string|null;snooze:string|null;legacy:boolean};
export type DailyHistoryDay={date:string;coverage:"full"|"legacy";total:number;done:number;pending:number;cancelled:number;rate:number|null;tasks:DailyHistoryTask[]};
export type DailyHistoryResponse={today:string;now:string;trackingStart:string;earliestDate:string;selected:DailyHistoryDay;days:Omit<DailyHistoryDay,"tasks">[]};

export function buildDailyHistory(day:string,trackingStart:string,revisions:ReminderRevision[],occurrences:HistoryOccurrence[]):DailyHistoryDay{
 const start=new Date(day+"T00:00:00+08:00").toISOString(),end=new Date(addCalendarDays(day,1)+"T00:00:00+08:00").toISOString();
 const versions=new Map<string,ReminderRevision[]>();
 for(const r of [...revisions].sort((a,b)=>a.effective.localeCompare(b.effective)||a.sequence-b.sequence)){
  const list=versions.get(r.reminder)??[];list.push(r);versions.set(r.reminder,list);
 }
 const rows=new Map<string,DailyHistoryTask>();
 const row=(r:ReminderRevision,status:DailyHistoryTask["status"]):DailyHistoryTask=>({reminder:r.reminder,title:r.title,time:r.time,kind:r.kind,note:r.note,status,updated:null,snooze:null,legacy:false});
 if(day>=trackingStart)for(const [id,list] of versions){
  const latest=[...list].reverse().find(r=>r.effective<end);if(!latest)continue;
  if(latest.active&&scheduled(latest,day))rows.set(id,row(latest,"pending"));
  else if(!latest.active&&latest.effective>=start){
   const previous=[...list].reverse().find(r=>r.effective<=latest.effective&&r.active&&scheduled(r,day));
   if(previous)rows.set(id,row(previous,"cancelled"));
  }
 }
 for(const o of occurrences.filter(o=>o.date===day)){
  const list=versions.get(o.reminder)??[];
  const atAction=[...list].reverse().find(r=>r.effective<=o.updated);
  const previous=rows.get(o.reminder),base=atAction?row(atAction,"pending"):list.length?{...row(list[0],"pending"),legacy:true}:{reminder:o.reminder,title:o.title,time:o.time,kind:o.kind,note:o.note,status:"pending" as const,updated:null,snooze:null,legacy:true};
  const status=o.status==="done"?"done":previous?.status==="cancelled"?"cancelled":o.status==="snoozed"?"snoozed":"pending";
  rows.set(o.reminder,{...base,status,updated:o.updated,snooze:o.snooze});
 }
 const tasks=[...rows.values()].sort((a,b)=>a.time.localeCompare(b.time)||a.reminder.localeCompare(b.reminder));
 const total=tasks.filter(t=>t.status!=="cancelled").length,done=tasks.filter(t=>t.status==="done").length,cancelled=tasks.filter(t=>t.status==="cancelled").length;
 return {date:day,coverage:day>=trackingStart?"full":"legacy",total,done,pending:total-done,cancelled,rate:day>=trackingStart&&total?Math.round(done/total*100):null,tasks};
}
