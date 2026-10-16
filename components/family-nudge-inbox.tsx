"use client";
import { Bell } from "lucide-react";
import { clockLabel, type CareState } from "@/lib/care";
import { activeFamilyNudges } from "@/lib/pet";

export function FamilyNudgeInbox({ data, busy, onAction }: {
  data: CareState; busy: boolean;
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  if (data.role !== "elder") return null;
  const nudges = activeFamilyNudges(data);
  if (!nudges.length) return null;
  return <section className="panel family-nudge-inbox" aria-label="家属发来的日程提醒">
    <div className="section-heading"><h2><Bell size={22} />家人的小提醒</h2><span className="badge">{nudges.length} 条待确认</span></div>
    <p className="muted">家人惦记着您。点“知道了”只确认收到，做完后还需要记录完成。</p>
    {nudges.map(n => {
      const task = data.tasks.find(t => t.id === n.reminder)!;
      return <article className="family-nudge-row" key={n.id}><div><strong>{task.title}</strong><p>{n.senderName}（{n.senderRelation}）提醒您，按自己的节奏安排。</p><span className="pet-task-detail">日程时间 {clockLabel(n.due)} · {clockLabel(n.created)} 发来</span></div>
        <button className="button primary" disabled={busy} aria-label={`知道了：${task.title}`} onClick={() => void onAction({ action: "nudgeSeen", id: n.id }, "已告诉家人您收到提醒了，日程完成状态没有改变。")}>知道了</button>
      </article>;
    })}
  </section>;
}
