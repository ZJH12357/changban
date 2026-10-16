"use client";
import { CalendarDays } from "lucide-react";
import { scheduleDateLabel, upcomingSchedules, type Reminder } from "@/lib/care";

export function UpcomingSchedules({ plans, today, compact = false }: { plans: Reminder[]; today: string; compact?: boolean }) {
  const upcoming = upcomingSchedules(plans, today);
  if (!upcoming.length) return null;
  const title = <>接下来的安排 <span className="count">{upcoming.length}</span></>;
  return <section className={compact ? "pet-upcoming" : "panel upcoming-schedules"} aria-label="接下来的安排">
    <div className="section-heading">{compact ? <h3>{title}</h3> : <h2>{title}</h2>}</div>
    <p className="upcoming-help">未来日程预告，不计入今天的完成进度。重复日程显示下一次时间。</p>
    <div className="upcoming-list">{upcoming.map(({ plan, day }) => <article className="upcoming-row" key={plan.id} data-upcoming-id={plan.id}>
      <p className="upcoming-time"><CalendarDays size={16} /><time dateTime={`${day}T${plan.time}:00+08:00`}>{scheduleDateLabel(day, today)} {plan.time}</time></p>
      <strong>{plan.title}</strong><p className="upcoming-frequency">{plan.frequency === "once" ? "仅一次" : plan.frequency === "daily" ? "每天 · 下次安排" : "每周 · 下次安排"}</p>
      {plan.note && <p className="muted">{plan.note}</p>}
    </article>)}</div>
  </section>;
}
