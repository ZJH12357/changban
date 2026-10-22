'use client';
import { clockLabel, type CareState, type Reminder } from '@/lib/care';
import { PET_NUDGE_COOLDOWN_MS, petTaskProgress, taskFamilyNudge } from '@/lib/pet';

export function FamilyTaskFeedback({data,task,now,busy,onAction}:{data:CareState;task:Reminder;now:number;busy:boolean;onAction:(p:Record<string,unknown>,message:string)=>Promise<boolean>}){
 const nudge=taskFamilyNudge(data.nudges,task,data.today);
 const cooling=!!nudge&&now<Date.parse(nudge.created)+PET_NUDGE_COOLDOWN_MS;
 return <div className="family-task-feedback">{petTaskProgress(task,data.today,now)==='overdue'&&<button className="button secondary" disabled={busy||cooling} aria-label={`提醒老人：${task.title}`} onClick={()=>void onAction({action:'nudge',id:task.id},'提醒已保存，等待老人打开常伴查看。')}>{cooling?'已提醒 · 请稍候':'一键提醒老人'}</button>}{nudge&&<p role="status">{nudge.seen?`${clockLabel(nudge.seen)} 老人已确认收到`:`${clockLabel(nudge.created)} 已发送，等待老人确认`}。{task.status==='done'?'日程已记录完成。':'收到提醒不代表日程已完成。'}</p>}</div>;
}
