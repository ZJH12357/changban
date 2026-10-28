import { addCalendarDays, type DailyHistoryDay, type Role } from './care';

export type InsightFact={id:string;text:string};
export type InsightSnapshot={start:string;end:string;generatedAt:string;role:Role;lifeIncluded:boolean;lifeShared:boolean;days:{date:string;covered:boolean;done:number;unrecorded:number;upcoming:number;cancelled:number}[];summary:{coveredDays:number;done:number;unrecorded:number;upcoming:number;activityDone:number;lifeDays:number;averageSleep:number|null;sleepChange:number|null;lowMoodDays:number};facts:InsightFact[]};
export type InsightSection={title:string;observation:string;interpretation:string;evidenceIds:string[]};
export type InsightAdvice={title:string;action:string;reason:string;evidenceIds:string[]};
export type InsightReport={opening:string;insights:InsightSection[];encouragement:string;suggestions:InsightAdvice[]};
export type InsightResult={snapshot:InsightSnapshot;report:InsightReport;mode:'ai'|'rules'|'demo';notice?:string};

/** Derive facts from historical revisions, never reconstruct the past from current plans. */
export function buildInsightSnapshot(input:{today:string;now:string;role:Role;days:DailyHistoryDay[];records:{date:string;mood:string;sleep:number}[];includeLife:boolean;lifeShared:boolean}):InsightSnapshot {
 const {today,now,role}=input,start=addCalendarDays(today,-6),facts:InsightFact[]=[];
 let activityDone=0;
 const days=Array.from({length:7},(_,i)=>{
  const date=addCalendarDays(start,i),day=input.days.find(d=>d.date===date),covered=day?.coverage==='full';
  const active=day?.tasks.filter(t=>t.status!=='cancelled')??[];
  const done=active.filter(t=>t.status==='done').length;
  const upcoming=covered?active.filter(t=>t.status!=='done'&&Date.parse(t.snooze??date+'T'+t.time+':00+08:00')>Date.parse(now)).length:0;
  const unrecorded=covered?active.length-done-upcoming:0;
  activityDone+=active.filter(t=>t.status==='done'&&t.kind==='activity').length;
  const row={date,covered,done,unrecorded,upcoming,cancelled:day?.cancelled??0};
  facts.push({id:'day-'+date,text:covered?`${date}：已记录完成 ${done} 项；已到时间未记录完成 ${unrecorded} 项；时间未到 ${upcoming} 项；已取消 ${row.cancelled} 项。`:`${date}：未完整跟踪当日安排，仅能确认已记录完成 ${done} 项，不据此计算未完成数量。`});
  return row;
 });
 const lifeIncluded=input.includeLife&&(role==='elder'||input.lifeShared);
 const unique=new Map<string,{date:string;mood:string;sleep:number}>();
 if(lifeIncluded)for(const r of input.records)if(r.date>=start&&r.date<=today&&!unique.has(r.date))unique.set(r.date,r);
 const records=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const sleeps=records.filter(r=>Number.isFinite(r.sleep)&&r.sleep>=0&&r.sleep<=24);
 const average=(rows:typeof sleeps)=>rows.length?Math.round(rows.reduce((n,r)=>n+r.sleep,0)/rows.length*10)/10:null;
 const early=sleeps.filter(r=>r.date<=addCalendarDays(start,2)),late=sleeps.filter(r=>r.date>=addCalendarDays(start,4));
 const sleepChange=early.length>=2&&late.length>=2?Math.round((average(late)!-average(early)!)*10)/10:null;
 for(const r of records)facts.push({id:'life-'+r.date,text:`${r.date}：自填心情“${['开心','平静','低落'].includes(r.mood)?r.mood:'未填写'}”；自填睡眠 ${Number.isFinite(r.sleep)&&r.sleep>=0&&r.sleep<=24?r.sleep:'未填写'} 小时。`});
 const summary={coveredDays:days.filter(d=>d.covered).length,done:days.reduce((n,d)=>n+d.done,0),unrecorded:days.reduce((n,d)=>n+d.unrecorded,0),upcoming:days.reduce((n,d)=>n+d.upcoming,0),activityDone,lifeDays:records.length,averageSleep:average(sleeps),sleepChange,lowMoodDays:records.filter(r=>r.mood==='低落').length};
 facts.push({id:'coverage',text:`范围 ${start} 至 ${today}，共 7 天；完整日程覆盖 ${summary.coveredDays} 天；${lifeIncluded?`生活记录 ${records.length} 天`:'未纳入生活记录'}。无记录不等于没有活动或心情不好。`});
 facts.push({id:'schedule',text:`共已记录完成 ${summary.done} 项，其中活动类 ${activityDone} 项；完整覆盖日中已到时间未记录完成 ${summary.unrecorded} 项；时间未到 ${summary.upcoming} 项。未记录完成不代表实际没有做。`});
 if(lifeIncluded)facts.push({id:'sleep',text:`${sleeps.length} 天有效自填睡眠记录，平均 ${summary.averageSleep??'未知'} 小时；前 3 天与后 3 天各至少 2 条记录时才比较，${sleepChange===null?'当前不进行趋势比较':`后段均值比前段${sleepChange>=0?'增加':'减少'} ${Math.abs(sleepChange)} 小时`}。这是自填记录变化，不是健康结论。`},{id:'mood',text:`已填生活记录 ${records.length} 天，其中“低落” ${summary.lowMoodDays} 天；缺失日期不推断情绪。`});
 return {start,end:today,generatedAt:now,role,lifeIncluded,lifeShared:input.lifeShared,days,summary,facts};
}

export function basicInsightReport(s:InsightSnapshot):InsightReport {
 const family=s.role==='caregiver',v=s.summary;
 const insights:InsightSection[]=[{title:'日常节奏与记录习惯',observation:`这七天已记录完成 ${v.done} 项安排，其中活动类 ${v.activityDone} 项。`,interpretation:v.unrecorded?`另有 ${v.unrecorded} 项已到时间尚未记录完成，可以先核对是否忘记打卡或调整了安排，再了解实际感受。`:'记录中没有已到时间仍待确认的事项；可以结合自己的实际感受，继续保持舒适的节奏。',evidenceIds:['schedule','coverage']}];
 if(s.lifeIncluded&&v.lifeDays){
  insights.push({title:'休息与心情线索',observation:`共有 ${v.lifeDays} 天生活记录，已填写的睡眠时长平均为 ${v.averageSleep??'未知'} 小时，${v.lowMoodDays} 天记录为“低落”。`,interpretation:v.sleepChange===null?'当前记录不作前后趋势比较。可以先聊聊白天的精神感受，以及最近是否改变了作息。':`后段与前段的睡眠均值相差 ${Math.abs(v.sleepChange)} 小时。这只是记录变化，适合结合白天感受了解原因，不能据此判断身体状况。`,evidenceIds:['sleep','mood','coverage']});
 }
 const suggestions:InsightAdvice[]=[{title:family?'先聊感受，再问进度':'给自己留一点轻松的时间',action:family?'可以问：“这几天过得怎么样？有没有哪件事想让我陪你一起做？”先听感受，再一起核对日程。':'今天挑一件自己喜欢、做起来轻松的小事，按自己的感受安排，不必为了打卡勉强完成。',reason:'日程记录能提供沟通线索，但不能替代本人的感受。',evidenceIds:['schedule']}];
 suggestions.push(s.lifeIncluded&&v.lifeDays?{title:'把休息感受记下来',action:family?'征得老人同意后，聊聊睡眠是否踏实、白天是否有精神。若不适持续或明显影响生活，可陪同咨询专业人员。':'愿意的话，记下今晚休息得怎么样、明天白天是否有精神。若不适持续或明显影响生活，可以联系家人或专业人员。',reason:'结合自填记录与实际感受，更有助于理解作息变化。',evidenceIds:['sleep','mood']}:{title:'从简单记录开始',action:family?'尊重老人的分享选择，可以邀请其自愿记录睡眠和心情，也可以直接聊聊近况。':'愿意时填一下睡眠和心情，不必补齐所有日期；也可以直接与家人聊聊近况。',reason:'目前报告主要依据日程记录，不对缺少的生活记录作推断。',evidenceIds:['coverage']});
 return {opening:family?'让记录成为关心的起点。下面把已观察到的情况、可能的理解方向和可执行的关怀建议分开呈现。':'生活里的每一件小事都值得被看见。我们一起看看这七天的节奏，再挑一两件适合自己的小行动。',insights,encouragement:v.done?`这七天记下的 ${v.done} 次完成，是照顾日常的一点点积累。${family?'感谢您愿意花时间了解家人的感受。':'做过的事值得肯定，也请给休息留出位置。'}`:'愿意看看自己的生活节奏，就是一个好的开始。记录多少不代表生活过得好不好。',suggestions};
}
