"use client";
import { useEffect, useRef, useState } from 'react';
import { addCalendarDays, clockLabel, type CareState, type DailyHistoryResponse } from '@/lib/care';
import type { CareTransport } from '@/lib/care-transport';
import { basicInsightReport, buildInsightSnapshot, type InsightResult, type InsightSnapshot } from '@/lib/life-insights';

export function PetInsights({data,transport}:{data:CareState;transport:CareTransport}){
 const demo=data.family.id.startsWith('demo:'),family=data.role==='caregiver',title=family?'七日关怀研报':'七日生活洞察';
 const [snapshot,setSnapshot]=useState<InsightSnapshot|null>(null),[result,setResult]=useState<InsightResult|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[available,setAvailable]=useState(false),[includeLife,setIncludeLife]=useState(true);
 const alive=useRef(true),locked=useRef(false),controller=useRef<AbortController|null>(null);
 async function readDemo(include:boolean){
  const history=await Promise.all(Array.from({length:7},async(_,i)=>{const r=await transport('/api/history?date='+addCalendarDays(data.today,-i));if(!r.ok)throw new Error('读取失败');return (await r.json() as DailyHistoryResponse).selected;}));
  return buildInsightSnapshot({today:data.today,now:new Date().toISOString(),role:data.role,days:history,records:data.records,includeLife:include,lifeShared:!!data.family.share});
 }
 async function load(){
  setLoading(true);setError('');const c=new AbortController();controller.current=c;
  try{
   if(demo){const s=await readDemo(true);if(alive.current)setSnapshot(s);}
   else {const r=await transport('/api/life-insights',{signal:c.signal,cache:'no-store'});const p=await r.json() as {snapshot:InsightSnapshot;aiAvailable:boolean;error?:string};if(!r.ok)throw new Error(p.error);if(alive.current){setSnapshot(p.snapshot);setAvailable(p.aiAvailable);}}
  }catch{if(alive.current&&!c.signal.aborted)setError('暂时没有读到记录，请重试。');}finally{if(alive.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;setResult(null);setSnapshot(null);void load();return()=>{alive.current=false;controller.current?.abort();};
 // Snapshot is refreshed on request; no automatic AI calls during the app's polling.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[data.account.username,data.family.share]);
 async function generate(mode:'ai'|'rules'){
  if(locked.current||loading)return;locked.current=true;setLoading(true);setError('');
  const c=new AbortController();controller.current=c;const timeout=setTimeout(()=>c.abort(),25000);
  try{
   let p:InsightResult;
   if(demo){const s=await readDemo(includeLife);p={snapshot:s,report:basicInsightReport(s),mode:'demo'};}
   else {const r=await transport('/api/life-insights',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({mode,includeLife,consent:mode==='ai'})});const body=await r.json() as InsightResult&{error?:string};if(!r.ok)throw new Error(body.error);p=body;}
   if(alive.current){setResult(p);setSnapshot(p.snapshot);}
  }catch{if(alive.current)setError('这次没有生成成功，已有报告已保留。可以重试，或选择基础解读。');}
  finally{clearTimeout(timeout);locked.current=false;if(alive.current)setLoading(false);}
 }
 const active=result?.snapshot??snapshot;
 function evidence(ids:string[]){return <details className="insight-evidence"><summary>查看分析依据</summary><ul>{ids.map(id=><li key={id}>{active?.facts.find(f=>f.id===id)?.text}</li>)}</ul></details>;}
 return <section className="pet-insights" aria-label={title}>
  <header><p className="eyebrow">椿萱 · 生活节律与关怀建议</p><h3>{title}</h3><p className="muted">{family?'从日程、休息和心情线索出发，让每一次关心更有依据。':'看看这七天的生活节奏，给努力一点肯定，也给自己一点建议。'}</p></header>
  {active&&<><p className="pet-rule-label">{active.start} — {active.end} · 含今天，按北京时间 · 截至 {clockLabel(active.generatedAt)}</p><div className="insight-metrics"><div><b>{active.summary.done}</b><span>已记录完成</span></div><div><b>{active.summary.unrecorded}</b><span>已到时间待确认</span></div><div><b>{active.summary.coveredDays}/7</b><span>完整日程覆盖</span></div></div><p className="pet-rule-label">未记录完成不代表实际没做。未跟踪的日期和时间未到的事项不会算作逾期。</p></>}
  <div className="insight-consent"><label><input type="checkbox" checked={includeLife&&(!family||!!data.family.share)} disabled={loading||(family&&!data.family.share)} onChange={e=>{setIncludeLife(e.target.checked);setResult(null);}}/>纳入已授权的睡眠与心情记录</label><p className="pet-rule-label">{family&&!data.family.share?'老人未共享生活记录，本报告仅分析已授权的日程。':'AI 仅接收选定范围的聚合记录，不自动上传姓名、家庭码、联系方式、血压、日程标题或文字备注。'} {demo?'体验模式使用虚拟数据，不调用在线 AI。':'只有点击“同意并生成 AI 分析”才会交由已配置的模型服务处理。'}</p></div>
  <div className="pet-conversation-shortcuts">{!demo&&available&&<button type="button" disabled={loading||!snapshot} onClick={()=>void generate('ai')}>{loading?'正在整理分析…':'同意并生成 AI 分析'}</button>}<button type="button" disabled={loading||!snapshot} onClick={()=>void generate('rules')}>{demo?'生成体验研报':'生成基础解读'}</button>{!snapshot&&!loading&&<button type="button" onClick={()=>void load()}>重新读取记录</button>}</div>
  {!demo&&!available&&!loading&&<p className="pet-rule-label">AI 暂未配置或不可用，可先查看基础解读。</p>}
  {loading&&<p role="status">正在整理七日记录，请稍候…</p>}{error&&<p role="alert" className="pet-form-error">{error}</p>}
  {result&&<article className="insight-report"><p className="insight-source">{result.mode==='ai'?'AI 分析 · 基于已授权记录':result.mode==='demo'?'虚拟样例 · 基础分析示范':'基础解读 · 由程序根据记录生成'}</p>{result.notice&&<p role="status">{result.notice}</p>}<p className="insight-opening">{result.report.opening}</p><h4>观察与分析</h4>{result.report.insights.map((item,i)=><section className="insight-card" key={i}><h5>{item.title}</h5><p><strong>记录显示：</strong>{item.observation}</p><p><strong>如何理解：</strong>{item.interpretation}</p>{evidence(item.evidenceIds)}</section>)}<p className="insight-encouragement">{result.report.encouragement}</p><h4>{family?'关怀行动建议':'给您的行动建议'}</h4>{result.report.suggestions.map((item,i)=><section className="insight-card" key={i}><h5>{i+1}. {item.title}</h5><p>{item.action}</p><p className="pet-rule-label">{item.reason}</p>{evidence(item.evidenceIds)}</section>)}</article>}
  <p className="pet-rule-label">这是一份生活关怀参考，不能据此判断疾病或心理状态；建议不会自动修改日程或通知家人。报告仅在当前面板保留，重新生成会读取最新记录。</p>
 </section>;
}
