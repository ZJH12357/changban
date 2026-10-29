"use client";
import { addCalendarDays, type DailyHistoryResponse } from '@/lib/care';

export function HistoryWeekChart({data,onSelect}:{data:DailyHistoryResponse;onSelect:(date:string)=>void}){
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.now));
 const days=Array.from({length:7},(_,i)=>{
  const date=addCalendarDays(data.selected.date,i-6),day=data.days.find(d=>d.date===date);
  const upcoming=day?.coverage==='full'&&date===data.today?data.selected.tasks.filter(t=>t.status!=='done'&&t.status!=='cancelled'&&t.time>time).length:0;
  return {date,day,upcoming,unrecorded:Math.max(0,(day?.pending??0)-upcoming)};
 });
 const max=Math.max(1,...days.filter(d=>d.day?.coverage==='full').map(d=>d.day!.total));
 return <article className="panel history-chart-panel" aria-label="七天日常完成图表">
  <h2>七天日常完成情况</h2><p className="history-coverage">{days[0].date} — {days[6].date} · 点击日期查看明细 · 柱高表示事项数量</p>
  <div className="history-chart-legend"><span><i className="chart-done"/>已完成</span><span><i className="chart-unrecorded"/>到时未记录</span><span><i className="chart-upcoming"/>时间未到</span></div>
  <div className="history-week-chart">{days.map(({date,day,upcoming,unrecorded})=>{
   const full=day?.coverage==='full';
   const label=!day?'暂无记录':!full?'记录不全':!day.total?'无安排':`${day.done}/${day.total}`;
   return <button type="button" key={date} disabled={!day} aria-pressed={date===data.selected.date} aria-label={`${date}，${full?`已完成 ${day.done} 项，到时未记录 ${unrecorded} 项，时间未到 ${upcoming} 项`:label}，查看明细`} onClick={()=>onSelect(date)}>
    <b>{label}</b><div className="history-chart-track" aria-hidden="true">{full&&day.total>0?<div className="history-chart-stack" style={{height:`${day.total/max*100}%`}}>{[{key:'done',count:day.done},{key:'unrecorded',count:unrecorded},{key:'upcoming',count:upcoming}].filter(s=>s.count>0).map(s=><span key={s.key} className={`chart-${s.key}`} style={{flex:s.count}}/>)}</div>:<span className="history-chart-empty">—</span>}</div><span>{date.slice(5)}</span>
   </button>;
  })}</div>
  <p className="history-coverage">数字为已完成 / 当日安排。记录不全时不推算完成率；未记录完成不代表实际没有做。当日停用事项不计入柱状图。</p>
 </article>;
}
