import type { CareState, FamilyNudge, Reminder } from "./care";

export type PetPreferences = {
  enabled: boolean;
  mode: "roam" | "fixed";
  activity: "quiet" | "balanced" | "lively";
  interaction: "low" | "normal" | "high";
  greetings: boolean;
  encouragement: boolean;
  reminders: boolean;
  sound: boolean;
  size: "small" | "medium" | "large";
  anchor: { x: number; y: number };
};
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type PetCue = { id: number; kind: "greeting" | "encourage" | "reminder"; text: string };

export const DEFAULT_PET: PetPreferences = {
  enabled: true, mode: "roam", activity: "lively", interaction: "high",
  greetings: true, encouragement: true, reminders: true, sound: false,
  size: "medium", anchor: { x: 0.92, y: 0.86 },
};
export const PET_SIZES = { small: 76, medium: 100, large: 126 };
export const PET_DOUBLE_CLICK_MS = 400;
export const PET_CHAT_WINDOW_MS = 15000;
export const PET_NUDGE_COOLDOWN_MS = 5 * 60 * 1000;
export function petSingleClickKind(previous: number | null, now: number): "reminder" | "chat" {
  return previous !== null && now >= previous && now - previous < PET_CHAT_WINDOW_MS ? "chat" : "reminder";
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function parsePetPreferences(value: unknown): PetPreferences {
  const p = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_PET, anchor: { ...DEFAULT_PET.anchor } };
  for (const key of ["enabled", "greetings", "encouragement", "reminders", "sound"] as const) {
    if (typeof p[key] === "boolean") result[key] = p[key];
  }
  if (p.mode === "roam" || p.mode === "fixed") result.mode = p.mode;
  if (p.activity === "quiet" || p.activity === "balanced" || p.activity === "lively") result.activity = p.activity;
  if (p.interaction === "low" || p.interaction === "normal" || p.interaction === "high") result.interaction = p.interaction;
  if (p.size === "small" || p.size === "medium" || p.size === "large") result.size = p.size;
  const a = p.anchor as Partial<Point> | undefined;
  if (a && typeof a.x === "number" && Number.isFinite(a.x) && typeof a.y === "number" && Number.isFinite(a.y)) {
    result.anchor = { x: clamp(a.x, 0, 1), y: clamp(a.y, 0, 1) };
  }
  return result;
}

export function clampPet(point: Point, bounds: Rect): Point {
  return { x: clamp(point.x, bounds.x, bounds.x + bounds.width), y: clamp(point.y, bounds.y, bounds.y + bounds.height) };
}
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function petDueAt(task: Reminder, day: string): number {
  return task.status === "snoozed" && task.snooze ? Date.parse(task.snooze) : Date.parse(`${day}T${task.time}:00+08:00`);
}
export function pendingPetTasks(tasks: Reminder[], day: string): Reminder[] {
  return tasks.filter(t => t.status !== "done").sort((a, b) => petDueAt(a, day) - petDueAt(b, day));
}
export function nearestPetTask(tasks: Reminder[], day: string, now: number): Reminder | undefined {
  return pendingPetTasks(tasks, day).reduce<Reminder | undefined>((nearest, task) =>
    !nearest || Math.abs(petDueAt(task, day) - now) < Math.abs(petDueAt(nearest, day) - now) ? task : nearest, undefined);
}
export type PetTaskProgress = "done" | "upcoming" | "overdue";
export const PET_PROGRESS_LABELS = { done: "已完成", upcoming: "时间未到", overdue: "逾期未完成" };
export function petTaskProgress(task: Reminder, day: string, now: number): PetTaskProgress {
  return task.status === "done" ? "done" : petDueAt(task, day) > now ? "upcoming" : "overdue";
}
export function petProgressSummary(tasks: Reminder[], day: string, now: number) {
  const counts = { done: 0, upcoming: 0, overdue: 0 };
  for (const task of tasks) counts[petTaskProgress(task, day, now)]++;
  return counts;
}
export function familyPetBrief(data: Pick<CareState, "tasks" | "today" | "family">, now: number): string {
  if (!data.tasks.length) return `${data.family.name}今天没有日程安排，团团陪您一起关心家人。`;
  const c = petProgressSummary(data.tasks, data.today, now);
  const task = nearestPetTask(data.tasks, data.today, now);
  const summary = `${data.family.name}今天已完成 ${c.done}/${data.tasks.length} 项，${c.upcoming} 项时间未到，${c.overdue} 项逾期未完成。`;
  return task ? `${summary}最近一件：${task.title}，${PET_PROGRESS_LABELS[petTaskProgress(task, data.today, now)]}。双击查看详情。` : `${summary}今天的安排全部完成啦！`;
}
export function taskFamilyNudge(nudges: FamilyNudge[], task: Reminder, day: string): FamilyNudge | undefined {
  return nudges.find(n => n.reminder === task.id && n.date === day && Date.parse(n.due) === petDueAt(task, day));
}
export function activeFamilyNudges(data: Pick<CareState, "tasks" | "today" | "nudges">): FamilyNudge[] {
  return data.nudges.filter(n => !n.seen && data.tasks.some(t => t.status !== "done" && taskFamilyNudge([n], t, data.today)));
}
export function petOccurrenceKey(task: Reminder, day: string): string {
  return `${day}:${task.id}:${petDueAt(task, day)}`;
}

// Check the whole route, not just its destination, so the pet walks around controls.
export function clearPetPath(from: Point, to: Point, size: number, obstacles: Rect[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 18));
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, width: size, height: size * 1.3 };
    if (obstacles.some(o => overlaps(p, o))) return false;
  }
  return true;
}
