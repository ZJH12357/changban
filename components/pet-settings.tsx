"use client";
import { useState } from "react";
import { PawPrint, RotateCcw, LocateFixed, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PetAvatar } from "@/components/pet-avatar";
import { DEFAULT_PET, type PetPreferences } from "@/lib/pet";
import type { Role } from "@/lib/care";
import type { PetSpeech } from "@/hooks/use-pet-speech";

export function PetSettings({ role, preferences: p, update, find, preview, storageError, speech }: {
  role: Role;
  preferences: PetPreferences; update: (patch: Partial<PetPreferences>) => void;
  find: () => void; preview: () => void; storageError: boolean;
  speech: PetSpeech;
}) {
  const [resetting, setResetting] = useState(false);
  const toggle = (key: "enabled" | "greetings" | "encouragement" | "reminders" | "sound" | "voice", title: string, detail: string) =>
    <div className="setting-row"><div><strong>{title}</strong><p className="muted">{detail}</p></div><Switch aria-label={title} checked={p[key]} onCheckedChange={value => update({ [key]: value })} /></div>;
  return <article className="panel pet-settings" id="pet-settings">
    <div className="section-heading"><div><p className="eyebrow">V2 · 陪伴多一点</p><h2><PawPrint size={23} />桌宠与陪伴</h2></div><span className="badge success">{p.enabled ? "团团在这里" : "已关闭"}</span></div>
    <div className="pet-intro"><div className="pet-preview"><PetAvatar mood={p.enabled ? "greet" : "sleep"} /></div><div><h3>{role === "caregiver" ? "团团 · 家属关怀模式" : "认识一下，我叫团团"}</h3><p className="muted">{role === "caregiver" ? "单击了解老人日程完成进度，区分已完成、时间未到和逾期未完成；双击查看全部日程，对已到时间的未完成事项一键提醒老人。" : "我会散散步、打个盹，也会记得您的小安排。单击提醒最近一件日程，双击展开面板。"}15 秒内再单击陪您闲聊，拖动我换个地方。</p></div></div>
    {toggle("enabled", "开启桌宠", "让团团出现在常伴里，随时陪着您")}
    <fieldset disabled={!p.enabled} className="pet-controls">
      <legend className="sr-only">团团的行为设置</legend>
      <div className="pet-setting-block"><strong>活动方式</strong><div className="pet-mode-options" role="group" aria-label="桌宠活动方式">
        <button type="button" aria-pressed={p.mode === "roam"} className={p.mode === "roam" ? "selected" : ""} onClick={() => update({ mode: "roam" })}><PawPrint size={22} /><span><b>自由活动</b><small>走走停停，有自己的节奏</small></span></button>
        <button type="button" aria-pressed={p.mode === "fixed"} className={p.mode === "fixed" ? "selected" : ""} onClick={() => update({ mode: "fixed" })}><LocateFixed size={22} /><span><b>固定位置</b><small>留在身边，互动照常</small></span></button>
      </div></div>
      <div className="form-grid pet-selects"><label>活跃程度<select value={p.activity} onChange={e => update({ activity: e.target.value as PetPreferences["activity"] })}><option value="quiet">安静 · 多休息一会儿</option><option value="balanced">适中 · 散步和休息交替</option><option value="lively">活泼 · 更爱到处走走</option></select></label><label>主动互动频率<select value={p.interaction} onChange={e => update({ interaction: e.target.value as PetPreferences["interaction"] })}><option value="low">少一些 · 约 10 分钟</option><option value="normal">适中 · 约 5 分钟</option><option value="high">多一些 · 约 2 分钟</option></select></label></div>
      <label className="pet-size-control">团团的大小<select value={p.size} onChange={e => update({ size: e.target.value as PetPreferences["size"] })}><option value="small">小巧</option><option value="medium">标准</option><option value="large">大一点</option></select></label>
      {toggle("greetings", "主动打招呼", role === "caregiver" ? "进入时问候并提示查看老人日程进度，偶尔说说关怀的话" : "每次进入常伴立刻问候并提醒查看日程，偶尔说说陪伴的话")}
      {toggle("encouragement", "完成后鼓励", role === "caregiver" ? "老人新记录完成日程时，告诉您这份安心；首次打开不重复播报旧记录" : "完成事项、报平安或记下生活后，给您回应")}
      {toggle("reminders", "桌宠日程气泡", role === "caregiver" ? "关注老人逾期未记录完成的日程；关闭后仍保留普通站内提示" : "到点或收到家属提醒时由团团提示；关闭后仍保留普通站内提示与家属提醒卡片")}
      {toggle("sound", "轻声提示音", "点击页面后，到点提醒可播放短提示音")}
      <section className="pet-voice-controls" aria-label="桌宠语音陪伴">
        {toggle('voice','桌宠语音陪伴','默认关闭。开启并主动点击后，朗读团团的问候、最近日程、进度和鼓励。')}
        <label>语音速度<select aria-label="语音速度" value={p.voiceRate} onChange={e=>update({voiceRate:Number(e.target.value)})}><option value={0.75}>更慢一点</option><option value={0.85}>舒缓（默认）</option><option value={1}>正常</option><option value={1.15}>稍快</option></select></label>
        <div className="actions"><button className="button secondary" disabled={!p.voice||!speech.supported} onClick={speech.preview}>允许播放并试听</button><button className="button secondary" disabled={!speech.speaking} onClick={speech.stop}>停止播报</button></div>
        <p role="status">{speech.status}</p><p>只朗读屏幕上的内容，不使用麦克风。语音由浏览器和设备提供，音色、中文支持及是否联网取决于设备；切换角色、退出或隐藏页面时停止。刷新后需再次主动允许播放。</p>
      </section>
    </fieldset>
    <div className="pet-settings-actions"><button className="button secondary" onClick={find}><LocateFixed size={18} />找回团团</button><button className="button secondary" disabled={!p.enabled} onClick={preview}><Sparkles size={18} />试试互动</button><button className="text-button" onClick={() => setResetting(true)}><RotateCcw size={16} />恢复默认</button></div>
    {resetting && <div className="pet-reset-confirm"><p>恢复自由活动、活泼、约 2 分钟主动互动一次、标准大小及其他默认设置？</p><button className="button primary" onClick={() => { update(DEFAULT_PET); find(); setResetting(false); }}>确认恢复</button><button className="text-button" onClick={() => setResetting(false)}>取消</button></div>}
    <p className="field-help">偏好按当前账号保存在这台浏览器。页面隐藏时团团会休息；填写表单或打开弹窗时会安静等候。</p>
    {storageError && <p className="pet-storage-error" role="status">浏览器暂时无法保存偏好，本次设置仍然生效。</p>}
    <details className="pet-credits"><summary>素材来源</summary><p>角色头部来自 <a href="https://kenney.nl/assets/animal-pack-remastered" target="_blank" rel="noreferrer">Kenney · Animal Pack Remastered</a>，CC0。身体、动作与常伴交互为本项目适配制作。</p></details>
  </article>;
}
