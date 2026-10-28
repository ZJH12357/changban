"use client";
import { useEffect, useRef, useState } from 'react';
import { addCalendarDays } from '@/lib/care';
import { checkScheduleDraft, validDay, type ScheduleDraft } from '@/lib/schedule-conversation';

export type RuleStep='title'|'frequency'|'date'|'time'|'note'|'review';
const steps:RuleStep[]=['title','frequency','date','time','note','review'];
const questions:Record<RuleStep,string>={title:'您想做什么事？',frequency:'这件事提醒几次？',date:'安排在哪一天？',time:'几点提醒您？',note:'要补充什么备注吗？',review:'请核对这件安排'};
export function RuleScheduleSteps({step,onStep,draft,onChange,today,disabled,saving,onSave,onCancel}:{
 step:RuleStep;onStep:(step:RuleStep)=>void;draft:ScheduleDraft;onChange:(patch:ScheduleDraft)=>void;today:string;disabled:boolean;saving:boolean;onSave:()=>void;onCancel:()=>void;
}){
 const [error,setError]=useState('');const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{setError('');heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});},[step]);
 function next(){
  if(step==='date'){
   if(!draft.date||!validDay(draft.date)||draft.date<today){setError('请选择今天或之后的日期。');return;}
   onStep('time');
  }else if(step==='time'){
   const check=checkScheduleDraft(draft,today,new Date().toISOString());
   if(!check.ready){setError(check.reply);return;}onStep('note');
  }else if(step==='note')onStep('review');
 }
 return <section className="pet-questionnaire" aria-label="分步安排日程">
  <p className="pet-rule-label">第 {steps.indexOf(step)+1} / 6 步 · {step==='review'?'确认前不会保存':'一次填一项，慢慢来'}</p>
  <h3 ref={heading} tabIndex={-1}>{questions[step]}</h3>
  {step!=='title'&&step!=='review'&&<p className="pet-questionnaire-title">{draft.title}</p>}
  {step==='frequency'&&<div className="pet-conversation-shortcuts">
   <button type="button" disabled={disabled} aria-pressed={draft.frequency==='once'} onClick={()=>{onChange({frequency:'once'});onStep('date');}}>仅一次</button>
   <button type="button" disabled={disabled} aria-pressed={draft.frequency==='daily'} onClick={()=>{onChange({frequency:'daily'});onStep('date');}}>每天</button>
  </div>}
  {step==='date'&&<form onSubmit={e=>{e.preventDefault();next();}}>
   <label htmlFor="pet-rule-date">{draft.frequency==='daily'?'从哪一天开始':'选择日期'}</label>
   <input id="pet-rule-date" type="date" min={today} value={draft.date??''} disabled={disabled} onChange={e=>{onChange({date:e.target.value});setError('');}}/>
   <div className="pet-conversation-shortcuts">{['今天','明天','后天'].map((label,i)=><button type="button" key={label} disabled={disabled} aria-pressed={draft.date===addCalendarDays(today,i)} onClick={()=>{onChange({date:addCalendarDays(today,i)});setError('');}}>{label}</button>)}</div>
   <button className="primary-button" type="submit" disabled={disabled}>下一步，选时间</button>
  </form>}
  {step==='time'&&<form onSubmit={e=>{e.preventDefault();next();}}>
   <p>{draft.date} · {draft.frequency==='daily'?'每天提醒':'仅提醒一次'}</p>
   <label htmlFor="pet-rule-time">选择提醒时间</label>
   <input id="pet-rule-time" type="time" step="60" value={draft.time??''} disabled={disabled} onChange={e=>{onChange({time:e.target.value});setError('');}}/>
   <p className="pet-rule-label">时间按北京时间，可直接点击选择。</p>
   <button className="primary-button" type="submit" disabled={disabled}>下一步，填备注</button>
  </form>}
  {step==='note'&&<form onSubmit={e=>{e.preventDefault();next();}}>
   <label htmlFor="pet-rule-note">备注（选填）</label>
   <textarea id="pet-rule-note" maxLength={240} value={draft.note??''} disabled={disabled} placeholder="例如：和老伴一起去，记得带雨伞" onChange={e=>onChange({note:e.target.value})}/>
   <div className="pet-conversation-shortcuts"><button type="submit" disabled={disabled}>下一步，核对安排</button><button type="button" disabled={disabled} onClick={()=>{onChange({note:''});onStep('review');}}>跳过备注</button></div>
  </form>}
  {step==='review'&&<div className="pet-draft">
   <h4>待确认 · 尚未保存</h4><p>{draft.title}</p><p>{draft.date} · {draft.time} · {draft.frequency==='daily'?'每天':'仅一次'}</p><p>备注：{draft.note||'无'}</p>
   <button type="button" className="primary-button" disabled={disabled} onClick={onSave}>{saving?'正在保存…':'确认保存'}</button>
   <button type="button" className="text-button" disabled={disabled} onClick={()=>onStep('title')}>修改事项</button>
  </div>}
  {error&&<p className="pet-form-error" role="alert">{error}</p>}
  {step!=='title'&&<div className="pet-conversation-shortcuts"><button type="button" disabled={disabled} onClick={()=>onStep(steps[steps.indexOf(step)-1])}>上一步</button><button type="button" disabled={disabled} onClick={onCancel}>取消草稿</button></div>}
 </section>;
}
