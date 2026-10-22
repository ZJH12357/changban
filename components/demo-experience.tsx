'use client';
import { useMemo, useState } from 'react';
import CareApp from '@/app/care-app';
import { createDemoStore } from '@/lib/demo';
import type { Role } from '@/lib/care';
import type { CareTransport } from '@/lib/care-transport';

export function DemoExperience({initialRole,onExit}:{initialRole:Role;onExit:()=>void}){
 const [role,setRole]=useState(initialRole),[generation,setGeneration]=useState(0),[confirm,setConfirm]=useState(false);
 const [guide,setGuide]=useState(true),[step,setStep]=useState(0);
 const store=useMemo(()=>{void generation;return createDemoStore();},[generation]);
 const transport=useMemo<CareTransport>(()=>{
  const send=store.transport(role);
  return async(path,init)=>{
   const response=await send(path,init);
   if(response.ok&&init?.method==='POST'&&typeof init.body==='string'){
    const action=JSON.parse(init.body);
    if(action.action==='task'&&action.status==='done')setStep(n=>Math.max(n,1));
    if(action.action==='nudge')setStep(n=>n>=1?Math.max(n,2):n);
    if(action.action==='nudgeSeen')setStep(n=>n>=2?3:n);
   }
   return response;
  };
 },[store,role]);
 const exit=async()=>onExit();
 return <><section className="demo-banner" aria-label="体验模式"><div><strong>正在体验常伴 · 全部为虚拟数据</strong><p>可切换双端演示同一个家庭；不访问真实账号，刷新或重置后恢复样例。不用于跨设备真实同步。</p></div><div className="demo-actions"><button className="button secondary" aria-pressed={role==='elder'} onClick={()=>setRole('elder')}>体验老人端</button><button className="button secondary" aria-pressed={role==='caregiver'} onClick={()=>setRole('caregiver')}>体验家属端</button><button className="text-button" onClick={()=>setConfirm(true)}>重置体验</button><button className="text-button" onClick={onExit}>退出体验</button></div>
 {guide?<section className="demo-guide" aria-label="三步体验引导"><div className="section-heading"><strong>{step===3?'三步体验已完成':'三步体验 · '+(step+1)+'/3'}</strong><button className="text-button" onClick={()=>setGuide(false)}>{step===3?'收起引导':'跳过引导'}</button></div><ol><li aria-current={step===0?'step':undefined}>老人端完成一件日程</li><li aria-current={step===1?'step':undefined}>家属端查看进度，提醒另一件待确认事项</li><li aria-current={step===2?'step':undefined}>老人端点“知道了”，家属端查看回执</li></ol><p role="status">{['请在老人端完成“到楼下散散步”，保留“做一会儿轻松伸展”用于演示家属提醒。','切到家属端，找到“做一会儿轻松伸展”，点击“一键提醒老人”。','切回老人端，在“家人的小提醒”中点击“知道了”。确认收到不会把日程标成完成。','您已走完完成、提醒、确认的流程。可切回家属端查看“老人已确认收到”，也可以继续自由体验。'][step]}</p><button className="button secondary" onClick={()=>setRole(step===1||step===3?'caregiver':'elder')}>{step===1?'前往家属端查看并提醒':step===3?'查看家属端回执':'前往老人端操作'}</button></section>:<button className="text-button" onClick={()=>setGuide(true)}>展开三步体验引导</button>}
 {confirm&&<div className="demo-confirm"><p>只重置本次虚拟日程和记录，不影响真实账号。确定恢复样例？</p><button className="button primary" onClick={()=>{setGeneration(n=>n+1);setStep(0);setGuide(true);setConfirm(false);}}>确认重置体验</button><button className="text-button" onClick={()=>setConfirm(false)}>取消</button></div>}</section><CareApp key={generation+role} onLogout={exit} transport={transport}/></>;
}
