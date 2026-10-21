"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Bell, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PetAvatar, type PetMood } from "@/components/pet-avatar";
import { PetAgenda } from "@/components/pet-agenda";
import { clockLabel, scheduleDateLabel, upcomingSchedules, type CareState } from "@/lib/care";
import { PET_DOUBLE_CLICK_MS, PET_SIZES, activeFamilyNudges, clampPet, clearPetPath, familyPetBrief, nearestPetTask, overlaps, pendingPetTasks, petDueAt, petOccurrenceKey, petSingleClickKind, type PetCue, type PetPreferences, type Point, type Rect } from "@/lib/pet";
import type { PetSpeech } from "@/hooks/use-pet-speech";

type Bubble = { text: string; until: number; priority: number };
export function CompanionPet({ data, preferences: p, update, cue, homeSignal, suspended, busy, onAction, onSettings, speech }: {
  data: CareState; preferences: PetPreferences; update: (patch: Partial<PetPreferences>) => void;
  cue: PetCue | null; homeSignal: number; suspended: boolean; busy: boolean;
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>; onSettings: () => void;
  speech: PetSpeech;
}) {
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [placed, setPlaced] = useState(false), [mood, setMood] = useState<PetMood>("idle");
  const [bubble, setBubble] = useState<Bubble | null>(null), [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false), [blocked, setBlocked] = useState(false), [clock, setClock] = useState(Date.now());
  const [bubblePosition, setBubblePosition] = useState<Point>({ x: -60, y: -130 });
  const positionRef = useRef(position), target = useRef<Point | null>(null), bubbleRef = useRef<Bubble | null>(null);
  const pauseUntil = useRef(0), nextMove = useRef(0), lastChat = useRef(Date.now());
  const drag = useRef<{ id: number; x: number; y: number; origin: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false), seen = useRef(new Set<string>()), lastCue = useRef(0);
  const greeted = useRef(false), greetingUntil = useRef(0), lastSingleClick = useRef<number | null>(null), chatIndex = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenNudges = useRef(new Set<string>());
  const previousCompletions = useRef<{ day: string; ids: Set<string> } | null>(null);
  const caregiver = data.role === "caregiver";
  const previousMode = useRef(p.mode);
  const size = PET_SIZES[p.size], active = p.enabled && placed && !suspended && !blocked;
  const current = useRef({ p, suspended, blocked, open, size, dragging });
  useEffect(() => { current.current = { p, suspended, blocked, open, size, dragging }; }, [p, suspended, blocked, open, size, dragging]);
  const place = useCallback((point: Point) => { positionRef.current = point; setPosition(point); }, []);
  const bounds = useCallback((): Rect => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
    const top = Math.max(8, Math.min(document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 90, height * 0.3) + 8);
    const bottom = document.querySelector(".bottom-nav")?.getBoundingClientRect().top ?? height - 16;
    return { x: 12, y: top, width: Math.max(0, width - size - 24), height: Math.max(0, Math.min(bottom - 12, height - 16) - top - size * 1.3) };
  }, [size]);
  const obstacles = useCallback((): Rect[] => Array.from(document.querySelectorAll("button,a,input,textarea,select,[role=button],[role=combobox]"))
    .filter(el => !el.closest(".pet-widget,.pet-sheet"))
    .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight)
    .map(r => ({ x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10 })), []);
  const home = useCallback(() => {
    const b = bounds(), obs = obstacles();
    const preferred = clampPet({ x: b.x + b.width * p.anchor.x, y: b.y + b.height * p.anchor.y }, b);
    // A pinned pet keeps the user's exact spot across page layouts; roaming pets find a clear home.
    let best = preferred, bestDistance = current.current.p.mode === "fixed" || !obs.some(o => overlaps({ ...preferred, width: size, height: size * 1.3 }, o)) ? 0 : Infinity;
    // Prefer a nearby clear resting spot, including narrow mobile side margins.
    for (let y = 0; y <= 8; y++) for (let x = 0; x <= 8; x++) {
      const point = { x: b.x + b.width * x / 8, y: b.y + b.height * y / 8 };
      if (obs.some(o => overlaps({ ...point, width: size, height: size * 1.3 }, o))) continue;
      const distance = Math.hypot(point.x - preferred.x, point.y - preferred.y);
      if (distance < bestDistance) { best = point; bestDistance = distance; }
    }
    place(best); target.current = null; setMood("idle"); nextMove.current = Date.now() + 4500; setPlaced(true);
  }, [bounds, obstacles, p.anchor.x, p.anchor.y, place, size]);
  useEffect(() => { home(); window.addEventListener("resize", home); window.visualViewport?.addEventListener("resize", home); return () => { window.removeEventListener("resize", home); window.visualViewport?.removeEventListener("resize", home); }; }, [home, homeSignal]);
  useEffect(() => {
    if (previousMode.current !== p.mode && p.mode === "fixed") {
      const b = bounds();
      update({ anchor: { x: b.width ? (positionRef.current.x - b.x) / b.width : 0, y: b.height ? (positionRef.current.y - b.y) / b.height : 0 } });
    }
    previousMode.current = p.mode;
    target.current = null; setMood("idle"); nextMove.current = Date.now() + 4500;
  }, [p.mode, p.enabled, bounds, update]);

  const say = useCallback((text: string, kind: PetCue["kind"] = "greeting", interrupt = false) => {
    const priority = kind === "greeting" ? 1 : 3;
    if (!interrupt && bubbleRef.current && bubbleRef.current.until > Date.now() && bubbleRef.current.priority > priority) return;
    const value = { text, until: Date.now() + (kind === "reminder" ? 18000 : 8500), priority };
    bubbleRef.current = value; setBubble(value); target.current = null;
    setMood(kind === "reminder" ? "alert" : kind === "encourage" ? "happy" : "greet");
    nextMove.current = value.until + 1200; lastChat.current = Date.now();
    speech.speak(text);
  }, [speech.speak]);
  useEffect(()=>{if(suspended||blocked||open||!p.enabled)speech.stop();},[suspended,blocked,open,p.enabled,speech.stop]);

  useEffect(() => {
    if (!bubble || !placed) return;
    const width = Math.min(255, window.innerWidth - 28), height = p.voice ? 240 : 190;
    const obs = obstacles(), viewport = window.visualViewport?.height ?? window.innerHeight;
    const bottom = document.querySelector(".bottom-nav")?.getBoundingClientRect().top ?? viewport;
    const candidates = [
      { x: position.x + size / 2 - width / 2, y: position.y - height - 12 },
      { x: position.x - width - 12, y: position.y },
      { x: position.x + size + 12, y: position.y },
      { x: position.x + size / 2 - width / 2, y: position.y + size * 1.5 + 12 },
    ].map(point => ({ x: Math.max(14, Math.min(window.innerWidth - width - 14, point.x)), y: Math.max(12, Math.min(bottom - height - 12, point.y)) }));
    const penalty = (point: Point) => obs.reduce((total, o) => total + Math.max(0, Math.min(point.x + width, o.x + o.width) - Math.max(point.x, o.x)) * Math.max(0, Math.min(point.y + height, o.y + o.height) - Math.max(point.y, o.y)), 0);
    candidates.sort((a, b) => penalty(a) - penalty(b));
    setBubblePosition({ x: candidates[0].x - position.x, y: candidates[0].y - position.y });
  }, [bubble, position, size, obstacles, placed, p.voice]);

  useEffect(() => {
    const focus = () => setBlocked(document.activeElement instanceof Element && !!document.activeElement.closest("input,textarea,select,[role=combobox],[contenteditable=true]"));
    const scroll = () => { pauseUntil.current = Date.now() + 1300; target.current = null; };
    const visibility = () => { setClock(Date.now()); target.current = null; nextMove.current = Date.now() + 3000; };
    document.addEventListener("focusin", focus); document.addEventListener("focusout", focus);
    document.addEventListener("visibilitychange", visibility); window.addEventListener("scroll", scroll, { passive: true });
    const timer = setInterval(() => { if (!document.hidden) setClock(Date.now()); }, 5000);
    return () => { document.removeEventListener("focusin", focus); document.removeEventListener("focusout", focus); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("scroll", scroll); clearInterval(timer); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const c = current.current, now = Date.now();
      if (!c.p.enabled || document.hidden || c.suspended || c.blocked || c.open || c.dragging || now < pauseUntil.current) { target.current = null; return; }
      if (bubbleRef.current && now >= bubbleRef.current.until) { bubbleRef.current = null; setBubble(null); setMood("idle"); }
      if (target.current) {
        const delta = { x: target.current.x - positionRef.current.x, y: target.current.y - positionRef.current.y };
        const distance = Math.hypot(delta.x, delta.y), step = c.p.activity === "lively" ? 5 : c.p.activity === "quiet" ? 2.4 : 3.5;
        if (distance <= step) { place(target.current); target.current = null; setMood("look"); nextMove.current = now + (c.p.activity === "lively" ? 3500 : c.p.activity === "quiet" ? 18000 : 8000) + Math.random() * 6000; }
        else place({ x: positionRef.current.x + delta.x / distance * step, y: positionRef.current.y + delta.y / distance * step });
        return;
      }
      if (now < nextMove.current || bubbleRef.current) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (c.p.mode === "fixed" || reduce || Math.random() < (c.p.activity === "quiet" ? 0.6 : 0.25)) {
        setMood(Math.random() > 0.5 ? "sleep" : "look"); nextMove.current = now + 9000 + Math.random() * 12000; return;
      }
      const b = bounds(), obs = obstacles();
      for (let i = 0; i < 30; i++) {
        const candidate = clampPet({ x: positionRef.current.x + (Math.random() - 0.5) * 480, y: positionRef.current.y + (Math.random() - 0.5) * 280 }, b);
        if (Math.hypot(candidate.x - positionRef.current.x, candidate.y - positionRef.current.y) < 35) continue;
        if (clearPetPath(positionRef.current, candidate, c.size, obs)) { target.current = candidate; setMood("walk"); return; }
      }
      setMood("look"); nextMove.current = now + 5000;
    }, 100);
    return () => clearInterval(timer);
  }, [bounds, obstacles, place]);

  useEffect(() => {
    if (!active || document.hidden || open || greeted.current) return;
    greeted.current = true;
    if (p.greetings) {
      say(caregiver ? `您好，${data.self.name}！团团陪您关心${data.family.name}。单击了解日程完成进度，双击查看详情、提醒老人。` : `您好，${data.self.name}！团团来陪您啦。记得看看今天的日程，单击我提醒最近一件，双击展开日程面板。`);
      greetingUntil.current = Date.now() + 8500;
    }
  }, [active, open, p.greetings, data.account.username, data.self.name, data.family.name, caregiver, say]);
  useEffect(() => {
    if (!active || document.hidden || open || !p.greetings) return;
    const interval = p.interaction === "high" ? 120000 : p.interaction === "low" ? 600000 : 300000;
    if (clock - lastChat.current > interval) {
      const words = caregiver ? ["我陪您一起关心家人。单击我，就能看看今天的完成进度。", "有些安排还没到时间，不用着急。给家人留一点自己的节奏。", "比起催促，一句温柔的问候也很有力量。"] : ["我在这里陪着您，慢慢来就好。", "今天的小安排，单击我提醒，双击我展开。", "我刚刚散了会儿步，现在来陪陪您。"];
      say(words[Math.floor(Math.random() * words.length)]);
    }
  }, [clock, active, open, p.greetings, p.interaction, caregiver, say]);
  useEffect(() => {
    if (!cue || cue.id === lastCue.current || !active || document.hidden) return;
    lastCue.current = cue.id;
    if (cue.kind === "encourage" && !p.encouragement) return;
    say(cue.text, cue.kind);
  }, [cue, active, p.encouragement, say]);
  useEffect(() => {
    if (!caregiver) return;
    const ids = new Set(data.tasks.filter(t => t.status === "done").map(t => t.id));
    const previous = previousCompletions.current;
    previousCompletions.current = { day: data.today, ids };
    if (!previous || previous.day !== data.today || !active || open || document.hidden || !p.encouragement) return;
    const completed = data.tasks.filter(t => ids.has(t.id) && !previous.ids.has(t.id));
    if (completed.length) say(`${data.family.name}刚刚记录完成${completed.length > 1 ? ` ${completed.length} 件日程` : `“${completed[0].title}”`}，团团替您记下这份安心。`, "encourage");
  }, [caregiver, data.tasks, data.today, data.family.name, active, open, p.encouragement, say]);

  useEffect(() => {
    try { seen.current = new Set(JSON.parse(sessionStorage.getItem(`changban-pet-seen:${data.account.username}`) || "[]")); } catch { seen.current = new Set(); }
  }, [data.account.username]);
  useEffect(() => {
    if (p.enabled && (!placed || !greeted.current)) return;
    if (document.hidden || suspended || blocked || open || Date.now() < greetingUntil.current) return;
    if (bubbleRef.current && bubbleRef.current.until > Date.now() && bubbleRef.current.priority >= 3) return;
    const nudge = !caregiver && activeFamilyNudges(data).find(n => !seenNudges.current.has(n.id));
    if (nudge) {
      seenNudges.current.add(nudge.id);
      const task = data.tasks.find(t => t.id === nudge.reminder)!;
      const text = `${nudge.senderName}（${nudge.senderRelation}）提醒您：${task.title}。收到后可以在上方“家人的小提醒”里点“知道了”。`;
      if (p.enabled && p.reminders) say(text, "reminder");
      else toast("家人的小提醒", { description: text, duration: 12000 });
      return;
    }
    const due = pendingPetTasks(data.tasks, data.today).filter(t => petDueAt(t, data.today) <= Date.now() && !seen.current.has(petOccurrenceKey(t, data.today)));
    if (!due.length) return;
    for (const task of due) seen.current.add(petOccurrenceKey(task, data.today));
    try { sessionStorage.setItem(`changban-pet-seen:${data.account.username}`, JSON.stringify([...seen.current].slice(-100))); } catch { /* In-memory deduplication remains available. */ }
    const text = caregiver ? `${data.family.name}有 ${due.length} 件日程逾期未记录完成，双击查看进度，也可以一键提醒老人。` : due.length > 1 ? `${due.length} 件日程已经到时间，双击我一起看看吧。` : `到时间啦：${due[0].title}。按自己的节奏来。`;
    if (p.enabled && p.reminders) say(text, "reminder");
    else toast("到时间了", { description: text, duration: 12000 });
    if (p.enabled && p.sound && navigator.userActivation?.hasBeenActive) {
      try {
        const audio = new AudioContext(), oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = "sine"; oscillator.frequency.setValueAtTime(660, audio.currentTime); oscillator.frequency.setValueAtTime(880, audio.currentTime + 0.16);
        gain.gain.setValueAtTime(0.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.55);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.6); oscillator.onended = () => { void audio.close(); };
      } catch { /* Visual reminders do not depend on audio support. */ }
    }
  }, [clock, data, p.enabled, p.reminders, p.sound, suspended, blocked, open, say, placed]);

  const cancelClick = useCallback(() => {
    if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    clickTimer.current = null;
  }, []);
  useEffect(() => {
    if (!active || open) cancelClick();
    return cancelClick;
  }, [active, open, cancelClick]);
  function openPanel() {
    cancelClick(); target.current = null; setMood("happy"); setOpen(true);
  }
  function singleClick() {
    if (!current.current.p.enabled || current.current.suspended || current.current.blocked || current.current.open || document.hidden) return;
    const now = Date.now(), kind = petSingleClickKind(lastSingleClick.current, now);
    lastSingleClick.current = now;
    if (kind === "chat") {
      const words = caregiver ? ["照顾家人的同时，也记得照顾自己。团团陪您一起惦记着。", "还没记录完成，不一定就是没做。可以先温柔问问家人。", "一句问候，也能让家人感到安心。今天要不要聊聊近况？"] : ["您一叫我，我就来啦。今天有什么开心的小事吗？", "能陪着您，我就很开心。累了就歇一会儿，我在呢。", "刚才散步时，我一直想着回来陪您。我们慢慢聊，不着急。", "今天也给自己一点小小的奖励吧，比如听首喜欢的歌。"];
      say(words[chatIndex.current++ % words.length], "greeting", true);
      return;
    }
    const task = nearestPetTask(data.tasks, data.today, now);
    const next = upcomingSchedules(data.plans, data.today)[0];
    const preview = next ? `接下来：${scheduleDateLabel(next.day, data.today)} ${next.plan.time} ${next.plan.title}。双击可查看未来安排。` : "";
    if (caregiver) { say(familyPetBrief(data, now) + (!task ? preview : ""), "reminder", true); return; }
    if (!task) { say("今天没有待办啦，" + (preview || "团团陪您放松一会儿。"), "greeting", true); return; }
    const time = task.status === "snoozed" && task.snooze ? clockLabel(task.snooze) : task.time;
    say(`最近的一件日程：${time} ${task.title}。${petDueAt(task, data.today) <= now ? "已经到时间了，按自己的节奏来。" : "还没到时间，我陪您记着。"}`, "reminder", true);
  }
  function clickPet(detail: number) {
    speech.activate();
    if (suppressClick.current) { suppressClick.current = false; cancelClick(); return; }
    // Delay a single tap so a double tap opens only the panel (also works on touch screens).
    if (clickTimer.current !== null || detail > 1) { openPanel(); return; }
    if (detail === 0) { singleClick(); return; } // Keyboard Enter / Space.
    clickTimer.current = setTimeout(() => { clickTimer.current = null; singleClick(); }, PET_DOUBLE_CLICK_MS);
  }
  function pointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    speech.activate();
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, origin: positionRef.current, moved: false };
    target.current = null; pauseUntil.current = Date.now() + 1500; suppressClick.current = false; setMood("look");
  }
  function pointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { d.moved = true; cancelClick(); setDragging(true); }
    if (d.moved) place(clampPet({ x: d.origin.x + e.clientX - d.x, y: d.origin.y + e.clientY - d.y }, bounds()));
  }
  function pointerEnd(e: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    suppressClick.current = d.moved || cancelled;
    if (cancelled) cancelClick();
    if (d.moved) { const b = bounds(); update({ anchor: { x: b.width ? (positionRef.current.x - b.x) / b.width : 0, y: b.height ? (positionRef.current.y - b.y) / b.height : 0 } }); }
    drag.current = null; setDragging(false); setMood("idle"); nextMove.current = Date.now() + 10000;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const pending = pendingPetTasks(data.tasks, data.today), completed = data.tasks.length - pending.length;
  return <>
    {p.enabled && placed && <div className={`pet-widget ${dragging ? "pet-dragging" : ""}`} data-pet-state={mood} data-pet-mode={p.mode} data-pet-paused={!active || open ? "true" : "false"} style={{ left: position.x, top: position.y, "--pet-size": `${size}px`, visibility: suspended ? "hidden" : "visible" } as CSSProperties}>
      {bubble && active && !open && <div className="pet-bubble" style={{ left: bubblePosition.x, top: bubblePosition.y }} role="status" aria-live="polite"><button className="pet-bubble-close" aria-label="收起团团的话" onClick={() => { speech.stop();bubbleRef.current = null; setBubble(null); setMood("idle"); }}><X size={15} /></button><p className="pet-bubble-message">{bubble.text}</p>{p.voice&&speech.supported&&<div className="pet-bubble-speech"><button onClick={()=>{speech.activate();speech.speak(bubble.text);}}>再听一遍</button><button disabled={!speech.speaking} onClick={speech.stop}>停止播报</button></div>}</div>}
      <button className="pet-touch" aria-label={caregiver ? "团团，单击了解老人日程进度，15 秒内再单击闲聊，双击展开面板，可拖动位置" : "团团，单击提醒最近日程，15 秒内再单击闲聊，双击展开面板，可拖动位置"} title={`${caregiver ? "单击看进度" : "单击提醒"} · 15 秒内再点闲聊 · 双击展开（键盘方向下键展开）`} aria-haspopup="dialog" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e => pointerEnd(e)} onPointerCancel={e => pointerEnd(e, true)} onClick={e => clickPet(e.detail)} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); openPanel(); } }}><PetAvatar mood={!active || open ? "idle" : mood} /><span className="pet-name">团团{pending.length > 0 && <small>{pending.length}</small>}</span></button>
    </div>}
    <Dialog open={open && p.enabled} onOpenChange={value => { setOpen(value); nextMove.current = Date.now() + 5000; }}><DialogContent className="care-dialog pet-sheet"><div className="pet-sheet-heading"><div className="pet-mini"><PetAvatar mood="happy" /></div><div><p className="eyebrow">{caregiver ? "团团陪您关心家人" : "团团陪您记着"}</p><DialogTitle>{caregiver ? "家人的日程进度" : "今天的小安排"}</DialogTitle></div></div><DialogDescription>{caregiver ? `${data.family.name}今天已完成 ${completed} 项，还有 ${pending.length} 项。` : pending.length ? `今天已完成 ${completed} 项，还有 ${pending.length} 件小事，慢慢来。` : "今天没有待办啦，做点自己喜欢的事吧。"}</DialogDescription>
      <PetAgenda data={data} now={clock} busy={busy} onAction={onAction} />
      <div className="pet-sheet-footer"><span><Bell size={15} />常伴打开时提供提醒</span><button className="text-button" onClick={() => { setOpen(false); onSettings(); }}><Settings size={17} />陪伴设置</button></div>
    </DialogContent></Dialog>
  </>;
}
