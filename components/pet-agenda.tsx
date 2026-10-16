"use client";
import { Bell, Check, Clock3, PawPrint } from "lucide-react";
import { clockLabel, type CareState } from "@/lib/care";
import { UpcomingSchedules } from "@/components/upcoming-schedules";
import { PET_NUDGE_COOLDOWN_MS, PET_PROGRESS_LABELS, pendingPetTasks, petDueAt, petProgressSummary, petTaskProgress, taskFamilyNudge } from "@/lib/pet";

export function PetAgenda({ data, now, busy, onAction }: {
  data: CareState; now: number; busy: boolean;
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  const caregiver = data.role === "caregiver", counts = petProgressSummary(data.tasks, data.today, now);
  const pending = pendingPetTasks(data.tasks, data.today);
  const tasks = caregiver ? [...pending, ...data.tasks.filter(t => t.status === "done")] : pending;
  return <>
    {caregiver && <div className="pet-progress-grid" aria-label="老人今日日程进度" aria-live="polite">
      <div><b>{counts.done}<small>/{data.tasks.length}</small></b><span>已完成</span></div>
      <div><b>{counts.upcoming}</b><span>时间未到</span></div>
      <div className={counts.overdue ? "has-overdue" : ""}><b>{counts.overdue}</b><span>逾期未完成</span></div>
    </div>}
    <div className="pet-agenda"><h3 className="pet-today-heading">今天的安排</h3>{tasks.map(t => {
      const progress = petTaskProgress(t, data.today, now), nudge = taskFamilyNudge(data.nudges, t, data.today);
      const cooling = !!nudge && now < Date.parse(nudge.created) + PET_NUDGE_COOLDOWN_MS;
      return <article className={`pet-agenda-item ${progress === "done" ? "is-done" : ""}`} key={t.id} data-task-id={t.id}>
        <div><span className="pet-agenda-time"><Clock3 size={16} />{t.status === "snoozed" && t.snooze ? clockLabel(t.snooze) : t.time}
          {caregiver ? <span className={`pet-progress-status ${progress}`}>{PET_PROGRESS_LABELS[progress]}</span> : petDueAt(t, data.today) <= now && <small>已到时间</small>}
        </span><h3>{t.title}</h3>{t.note && <p className="muted">{t.note}</p>}
          {caregiver && t.status === "snoozed" && t.snooze && <p className="pet-task-detail">老人选择了稍后提醒，按 {clockLabel(t.snooze)} 判断是否逾期。</p>}
          {caregiver && progress === "done" && t.updated && <p className="pet-task-detail">老人于 {clockLabel(t.updated)} 记录完成</p>}
        </div>
        {!caregiver ? <div className="pet-agenda-actions">
          <button className="button primary" disabled={busy} onClick={() => void onAction({ action: "task", id: t.id, status: "done" }, "已经记下，做得很好！")}><Check size={18} />完成</button>
          <button className="text-button" disabled={busy} onClick={() => void onAction({ action: "task", id: t.id, status: "snoozed" }, "10 分钟后再提醒")}><Clock3 size={16} />稍后提醒</button>
        </div> : progress === "overdue" && <div className="pet-nudge-actions">
          <button className="button secondary" disabled={busy || cooling} aria-label={`提醒老人：${t.title}`} onClick={() => void onAction({ action: "nudge", id: t.id }, "提醒已保存，等待老人端打开查看；不会发送短信或微信。") }><Bell size={17} />{cooling ? "已提醒 · 请稍候" : "一键提醒老人"}</button>
          {nudge && <p className="pet-task-detail" role="status">{nudge.seen ? `${clockLabel(nudge.seen)} 老人已确认收到` : `${clockLabel(nudge.created)} 已发送，等待老人确认`}{cooling ? " · 5 分钟内不重复提醒" : ""}</p>}
        </div>}
      </article>;
    })}{!tasks.length && <div className="pet-all-done"><PawPrint size={30} /><p>{caregiver ? "今天还没有安排日程。" : "今天没有待办啦。"}</p></div>}<UpcomingSchedules plans={data.plans} today={data.today} compact /></div>
    {caregiver && <p className="pet-progress-help">状态以老人端记录为准，未记录完成不代表实际未做。提醒只在站内显示；家属不能代为完成。每 10 秒同步，最近同步 {clockLabel(data.now)}。</p>}
  </>;
}
