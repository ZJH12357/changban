'use client';
import { useMemo, useState } from 'react';
import CareApp from '@/app/care-app';
import { createDemoStore } from '@/lib/demo';
import type { Role } from '@/lib/care';

export function DemoExperience({initialRole,onExit}:{initialRole:Role;onExit:()=>void}){
 const [role,setRole]=useState(initialRole),[generation,setGeneration]=useState(0),[confirm,setConfirm]=useState(false);
 const store=useMemo(()=>{void generation;return createDemoStore();},[generation]);
 const transport=useMemo(()=>store.transport(role),[store,role]);
 const exit=async()=>onExit();
 return <><section className="demo-banner" aria-label="体验模式"><div><strong>正在体验常伴 · 全部为虚拟数据</strong><p>可切换双端演示同一个家庭；不访问真实账号，刷新或重置后恢复样例。不用于跨设备真实同步。</p></div><div className="demo-actions"><button className="button secondary" aria-pressed={role==='elder'} onClick={()=>setRole('elder')}>体验老人端</button><button className="button secondary" aria-pressed={role==='caregiver'} onClick={()=>setRole('caregiver')}>体验家属端</button><button className="text-button" onClick={()=>setConfirm(true)}>重置体验</button><button className="text-button" onClick={onExit}>退出体验</button></div>{confirm&&<div className="demo-confirm"><p>只重置本次虚拟日程和记录，不影响真实账号。确定恢复样例？</p><button className="button primary" onClick={()=>{setGeneration(n=>n+1);setConfirm(false);}}>确认重置体验</button><button className="text-button" onClick={()=>setConfirm(false)}>取消</button></div>}</section><CareApp key={generation+role} onLogout={exit} transport={transport}/></>;
}
