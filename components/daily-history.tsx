"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, History, RefreshCw } from "lucide-react";
import { addCalendarDays, clockLabel, kindLabels, type DailyHistoryResponse } from "@/lib/care";
import { liveTransport, type CareTransport } from "@/lib/care-transport";

export function DailyHistory({ today, onSessionExpired, transport=liveTransport }: { today:string; onSessionExpired:()=>Promise<void>;transport?:CareTransport }) {
  const [date,setDate]=useState(today),[range,setRange]=useState("7"),[reload,setReload]=useState(0);
  const [data,setData]=useState<DailyHistoryResponse|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();let running=false;
    setData(previous=>previous?.selected.date===date?previous:null);
    async function load(){
      if(running)return;running=true;setLoading(true);
      try{
        const r=await transport(`/api/history?date=${encodeURIComponent(date)}&range=${range}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
        const result=await r.json() as DailyHistoryResponse&{error?:string};if(controller.signal.aborted)return;
        if(r.status===401){await onSessionExpired();return;}
        if(!r.ok)throw new Error(result.error||"暂时无法加载记录。");
        setData(result);setError("");
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"连接中断，请重试。");}
      finally{running=false;if(!controller.signal.aborted)setLoading(false);}
    }
    void load();const timer=setInterval(()=>{if(date===today&&!document.hidden)void load();},10000);
    return()=>{controller.abort();clearInterval(timer);};
  },[date,range,reload,today,onSessionExpired,transport]);
  const selected=data?.selected;
  return <section className="daily-history" aria-label="每日日程历史">
    <article className="panel history-controls">
      <div className="section-heading"><div><p className="eyebrow">每天的小事，都留有记录</p><h2><History size={23}/>日程历史</h2></div><button className="text-button" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={17}/>刷新记录</button></div>
      <div className="history-filter-row"><label>查看日期<input type="date" aria-label="查看日期" value={date} min={data?.earliestDate} max={today} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>
        <div className="history-date-actions"><button className="button secondary" disabled={!!data&&date<=data.earliestDate} onClick={()=>setDate(addCalendarDays(date,-1))}><ChevronLeft size={18}/>前一天</button><button className="button secondary" disabled={date>=today} onClick={()=>setDate(addCalendarDays(date,1))}>后一天<ChevronRight size={18}/></button><button className="text-button" disabled={date===today} onClick={()=>setDate(today)}>回到今天</button></div>
      </div>
      <div className="history-range" role="group" aria-label="历史汇总范围">{["7","30"].map(v=><button key={v} className={range===v?"selected":""} aria-pressed={range===v} onClick={()=>setRange(v)}>近 {v} 天</button>)}</div>
      {data&&<p className="history-coverage">完整日程追踪从 {data.trackingStart} 开始；更早仅展示已有操作，不推算完成率。日期按北京时间。最近同步 {clockLabel(data.now)}。</p>}
    </article>
    {error&&<div className="error-banner" role="alert"><span>{error}</span><button className="button secondary" onClick={()=>setReload(n=>n+1)}>重试</button></div>}
    {!selected?<div className="panel empty" role="status">{loading?"正在整理每天的记录…":"暂无可显示的记录，请重试。"}</div>:<>
      <article className="panel"><div className="section-heading"><h2><CalendarDays size={22}/>按天查看</h2><span className="muted">截至 {date}</span></div>
        <div className="history-day-list" aria-label="每日完成汇总">{data.days.map(d=><button key={d.date} className={date===d.date?"selected":""} aria-pressed={date===d.date} aria-label={`查看 ${d.date} 的日程`} onClick={()=>setDate(d.date)}><span>{d.date.slice(5)}</span><b>{d.coverage==="full"?`${d.done}/${d.total}`:`${d.done} 项`}</b><small>{d.coverage==="legacy"?"旧操作记录":d.total?"已完成":"无日程安排"}</small></button>)}</div>
      </article>
      <article className="panel history-detail" aria-busy={loading}>
        <div className="section-heading"><div><h2>{date===today?"今天":date}的日程明细</h2><p className="muted">{date===today?"今天尚未结束，状态会持续更新。":"保留当日安排与老人端最后记录的状态。"}</p></div><span className="badge">{selected.coverage==="full"?"完整日程":"旧操作记录"}</span></div>
        <div className="daily-history-stats"><div><span>{selected.coverage==="full"?"当日安排":"已知记录"}</span><b>{selected.total}<small> 项</small></b></div><div><span>已完成</span><b>{selected.done}<small> 项</small></b></div><div><span>{date===today?"待完成":"未记录完成"}</span><b>{selected.pending}<small> 项</small></b></div></div>
        {selected.rate!==null&&<div className="history-rate"><span>完成率 {selected.rate}%</span><progress value={selected.done} max={selected.total} aria-label="所选日期日程完成率"/></div>}
        {selected.cancelled>0&&<p className="history-coverage">另有 {selected.cancelled} 项当日停用，不计入完成率。</p>}
        <div className="daily-history-task-list">{selected.tasks.map(t=><article className={`daily-history-task ${t.status}`} key={t.reminder} data-history-reminder={t.reminder}>
          <span className="history-task-icon">{t.status==="done"?<Check size={23}/>:<Clock3 size={23}/>}</span><div className="task-body"><strong>{t.title}</strong><p className="muted">{t.time} · {kindLabels[t.kind]??t.kind}</p>{t.note&&<p className="task-note">{t.note}</p>}
            {t.status==="done"&&t.updated&&<p className="history-time">{clockLabel(t.updated)} 记录完成</p>}
            {t.status==="snoozed"&&t.snooze&&<p className="history-time">曾选择稍后提醒至 {clockLabel(t.snooze)}{date<today?"，当日未记录完成":""}</p>}
            {t.legacy&&<p className="history-legacy-note">启用前的旧操作，内容按首次追踪时的资料展示。</p>}
          </div><span className={`badge ${t.status==="done"?"success":""}`}>{t.status==="done"?"已完成":t.status==="cancelled"?"当日停用":date===today?(t.status==="snoozed"?"稍后提醒":"待完成"):"未记录完成"}</span>
        </article>)}</div>
        {!selected.tasks.length&&<div className="empty"><CalendarDays/><h3>{selected.coverage==="full"?"这一天没有安排日程":"这一天没有可还原的旧操作记录"}</h3><p className="muted">{selected.coverage==="full"?"没有安排的日期不会算作未完成。":"旧数据不足以判断当天的完整安排，不能视为没有日程或全部完成。"}</p></div>}
        <p className="history-coverage">“未记录完成”只表示没有在常伴中确认，不代表老人实际没有做。历史为只读；今天的事项请回主页操作。</p>
      </article>
    </>}
  </section>;
}
