"use client";
import { useEffect, useRef, useState } from 'react';
import { checkScheduleDraft, draftPlan, scheduleTurn, type ScheduleDraft } from '@/lib/schedule-conversation';
import { RuleScheduleSteps, type RuleStep } from '@/components/rule-schedule-steps';
import { scheduled, type CareState } from '@/lib/care';
import type { PetSpeech } from '@/hooks/use-pet-speech';
import { z } from 'zod';

const chatResponse=z.object({reason:z.string().optional(),turn:z.object({reply:z.string().max(600),ready:z.boolean(),draft:z.object({title:z.string().max(80).optional(),date:z.string().optional(),time:z.string().optional(),frequency:z.enum(['once','daily']).optional(),note:z.string().max(240).optional()}).strict()})});

type Recognition = {lang:string;interimResults:boolean;continuous:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type RecognitionConstructor = new()=>Recognition;
export function PetConversation({data,busy,onAction,speech,petName}:{data:CareState;busy:boolean;onAction:(p:Record<string,unknown>,message:string)=>Promise<boolean>;speech:PetSpeech;petName:string}) {
 const [input,setInput]=useState(''),[draft,setDraft]=useState<ScheduleDraft>({}),[ready,setReady]=useState(false);
 const [reply,setReply]=useState(`我是${petName}，先告诉我您想做什么，比如“吃螺蛳粉”。接下来我们一步一步选频率、日期和时间，最后核对保存。`);
 const [ruleStep,setRuleStep]=useState<RuleStep>('title');
 const [ruleNotice,setRuleNotice]=useState(false);
 const [listening,setListening]=useState(false),[voiceStatus,setVoiceStatus]=useState(''),[supported,setSupported]=useState(false),[saving,setSaving]=useState(false);
 const demo=data.family.id.startsWith('demo:');
 const [aiAvailable,setAIAvailable]=useState(false),[useAI,setUseAI]=useState(false),[thinking,setThinking]=useState(false),[modeNote,setModeNote]=useState('');
 const history=useRef<{role:'user'|'assistant';content:string}[]>([]),chatRequest=useRef<AbortController|null>(null);
 const recognition=useRef<Recognition|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),lock=useRef(false),alive=useRef(true),requestId=useRef<string|null>(null);
 const latestInput=useRef(input);latestInput.current=input;
 useEffect(()=>{if(demo)return;const controller=new AbortController();void fetch('/api/pet-chat',{signal:controller.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(!controller.signal.aborted)setAIAvailable(z.object({enabled:z.boolean()}).parse(v).enabled);}).catch(()=>{});return()=>controller.abort();},[demo]);
 function abort(){if(timer.current)clearTimeout(timer.current);timer.current=null;const r=recognition.current;recognition.current=null;if(r){r.onresult=null;r.onend=null;r.onerror=null;r.abort();}}
 useEffect(()=>{alive.current=true;const w=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};setSupported(!!(w.SpeechRecognition||w.webkitSpeechRecognition));const hidden=()=>{if(document.hidden){abort();setListening(false);setVoiceStatus('已停止收音，输入内容已保留。');}};document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;abort();chatRequest.current?.abort();document.removeEventListener('visibilitychange',hidden);};},[]);
 function say(text:string){setReply(text);speech.activate();speech.speak(text);}
 function cancelDraft(){history.current=[];setDraft({});setReady(false);setRuleStep('title');setRuleNotice(false);requestId.current=null;setInput('');say('好的，刚才的草稿已取消，没有保存。');}
 function changeDraft(patch:ScheduleDraft){setDraft(previous=>({...previous,...patch}));setReady(false);requestId.current=null;}
 function changeStep(step:RuleStep){setRuleStep(step);setRuleNotice(false);setReady(step==='review');if(step==='title')setInput(draft.title??'');}
 async function send(text=input){
  if(lock.current||listening||busy)return;
  text=text.trim();if(!text)return;
  if(/^(今天|明天)(有什么(日程|安排)?|什么安排|的?(日程|安排))[？?。！!]*$|^(查看|看看|查询)(今天|明天)?的?(日程|安排)[？?。！!]*$/.test(text.trim())){
   const day=text.includes('明天')?new Date(Date.parse(data.today+'T00:00:00Z')+86400000).toISOString().slice(0,10):data.today;
   const items=data.plans.filter(p=>scheduled(p,day)).sort((a,b)=>a.time.localeCompare(b.time));
   setRuleNotice(true);say(items.length?`${day} 有 ${items.length} 件事：`+items.map(p=>`${p.time} ${p.title}${day===data.today?(data.tasks.find(t=>t.id===p.id)?.status==='done'?'（已记录完成）':Date.parse(day+'T'+p.time+':00+08:00')<=Date.now()?'（已到时间，未记录完成）':'（时间未到）'):''}`).join('；'):'这一天还没有安排。');setInput('');return;
  }
  if(/^(取消|不记了|算了|重新开始)[。！!]*$/.test(text)){cancelDraft();return;}
  if(useAI&&!demo){
   lock.current=true;setThinking(true);setModeNote('');const controller=new AbortController();chatRequest.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
   try {
    const response=await fetch('/api/pet-chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({input:text,draft,history:history.current,petName})});
    if(!response.ok)throw new Error('CHAT_FAILED');const result=chatResponse.parse(await response.json());if(!alive.current)return;
    setDraft(result.turn.draft);setReady(result.turn.ready);requestId.current=null;say(result.turn.reply);setInput('');setModeNote(result.reason??'');
    history.current=[...history.current,{role:'user' as const,content:text},{role:'assistant' as const,content:result.turn.reply}].slice(-12);
   }catch{if(alive.current){setModeNote('连接暂时未成功，文字和草稿已保留。可以重试，或关闭 AI 使用基础规则。');}}
   finally{clearTimeout(timeout);chatRequest.current=null;lock.current=false;if(alive.current)setThinking(false);}
   return;
  }
  const result=scheduleTurn({},text,data.today,new Date().toISOString());
  if(!result.draft.title){say(result.reply);return;}
  setDraft(previous=>({...previous,...result.draft}));setReady(false);setRuleStep('frequency');setRuleNotice(false);requestId.current=null;say('记下这件事了。接下来请选择仅提醒一次，还是每天提醒。');setInput('');
 }
 function startVoice(){
  speech.stop();abort();const w=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};const C=w.SpeechRecognition||w.webkitSpeechRecognition;if(!C)return;
  const base=latestInput.current;try{const r=new C();recognition.current=r;r.lang='zh-CN';r.interimResults=true;r.continuous=true;
   r.onresult=e=>{if(recognition.current!==r)return;setInput((base+' '+Array.from(e.results).map(v=>v[0]?.transcript??'').join('')).trim().slice(0,300));};
   r.onerror=e=>{if(recognition.current!==r)return;setVoiceStatus(e.error==='not-allowed'?'未获得麦克风权限，可以继续打字。':'没有识别成功，可以重试或直接打字。');abort();setListening(false);};
   r.onend=()=>{if(recognition.current!==r)return;recognition.current=null;if(timer.current)clearTimeout(timer.current);setListening(false);setVoiceStatus('收音已结束，请检查文字，再点击发送。');};
   r.start();setListening(true);setVoiceStatus('正在收音，最多 60 秒。识别结果不会自动发送。');timer.current=setTimeout(stopVoice,60000);
  }catch{abort();setListening(false);setVoiceStatus('无法启动语音输入，请直接打字。');}
 }
 function stopVoice(){
  const r=recognition.current;if(!r)return;
  if(timer.current)clearTimeout(timer.current);
  setVoiceStatus('正在结束收音，请稍候核对文字。');
  try{r.stop();timer.current=setTimeout(()=>{if(recognition.current===r){abort();setListening(false);setVoiceStatus('收音已停止，内容已保留，请核对后发送。');}},2500);}catch{abort();setListening(false);}
 }
 async function save(){
  if(!ready||lock.current||busy||listening)return;
  if(input.trim()){say('输入框里还有未发送的内容，请先发送并核对日程卡片，再确认保存。');return;}
  const check=checkScheduleDraft(draft,data.today,new Date().toISOString());if(!check.ready){setReady(false);if(!useAI){setRuleStep(draft.date&&draft.date>=data.today?'time':'date');setRuleNotice(true);}say(check.reply);return;}
  lock.current=true;setSaving(true);requestId.current??=crypto.randomUUID();
  try{const ok=await onAction({action:data.role==='elder'?'elderPlan':'plan',plan:draftPlan(draft),requestId:requestId.current},'日程已保存');if(!alive.current)return;if(ok){setDraft({});setReady(false);setRuleStep('title');requestId.current=null;history.current=[];say('记好啦！您可以在日常和桌宠日程面板里查看。还想记点什么？');}else{setRuleNotice(true);say('没有确认保存成功，草稿已保留。请先查看日程是否已出现；未出现时可以重试。');}}finally{lock.current=false;if(alive.current)setSaving(false);}
 }
 return <section className="pet-conversation" aria-label="桌宠日程对话">
  <p className="pet-rule-label">{useAI?'AI 对话模式':demo?'体验模式 · 使用基础规则，不调用在线 AI':aiAvailable?'基础规则模式 · 可开启 AI 对话':'基础规则模式 · AI 尚未配置或暂不可用'}。草稿仅在当前对话内保留，关闭面板或切换标签会清除。</p>
  {aiAvailable&&!demo&&<div className="pet-conversation-shortcuts"><button type="button" disabled={busy||saving||thinking||listening} aria-pressed={useAI} onClick={()=>{setUseAI(!useAI);history.current=[];setModeNote('');setRuleStep(draft.title?'frequency':'title');setReady(false);}}>{useAI?'关闭 AI，使用基础规则':'同意并开启 AI 对话'}</button><p className="pet-rule-label">开启后，您发送的文字、当前草稿和最近对话会交由已配置的 AI 服务处理。家庭码、联系电话和生活记录不会自动发送。</p></div>}
  {modeNote&&<p className="pet-rule-label" role="status">{modeNote}</p>}
  {(useAI||ruleStep==='title'||ruleNotice)&&<p className="pet-conversation-reply" role="status" aria-live="polite">{reply}</p>}
  <div className="pet-conversation-shortcuts"><button type="button" disabled={busy||saving||thinking||listening} onClick={()=>send('今天有什么日程')}>今天的安排</button><button type="button" disabled={busy||saving||thinking||listening} onClick={()=>send('明天有什么日程')}>明天的安排</button></div>
  {!useAI&&<RuleScheduleSteps step={ruleStep} onStep={changeStep} draft={draft} onChange={changeDraft} today={data.today} disabled={busy||saving||thinking||listening} saving={saving} onSave={()=>void save()} onCancel={cancelDraft}/>}
  {useAI&&Object.keys(draft).length>0&&<div className="pet-draft"><h3>待确认 · 尚未保存</h3><p>{draft.title||'事情待补充'}</p><p>{draft.date||'日期待补充'} · {draft.time||'时间待补充'} · {draft.frequency==='daily'?'每天':draft.frequency==='once'?'仅一次':'重复方式待补充'}</p>{draft.note&&<p>备注：{draft.note}</p>}<p>时间按北京时间。可继续输入修改。</p>{!draft.frequency&&<div className="pet-conversation-shortcuts"><button disabled={busy||saving||thinking||listening} onClick={()=>send('只提醒一次')}>仅一次</button><button disabled={busy||saving||thinking||listening} onClick={()=>send('每天')}>每天</button></div>}<button className="primary-button" disabled={!ready||busy||saving||thinking||listening} onClick={()=>void save()}>{saving?'正在保存…':'确认保存'}</button><button className="text-button" disabled={busy||saving||thinking||listening} onClick={cancelDraft}>取消草稿</button></div>}
  {(useAI||ruleStep==='title')&&<><form onSubmit={e=>{e.preventDefault();if(input.trim())send();}}><label htmlFor="pet-schedule-input">告诉{petName}您想做什么</label><textarea id="pet-schedule-input" value={input} maxLength={300} disabled={saving||thinking||listening} placeholder={useAI?'例如：明天下午四点去公园散步':'例如：吃螺蛳粉、去公园散步'} onChange={e=>setInput(e.target.value)}/><div className="pet-conversation-shortcuts"><button type="submit" disabled={!input.trim()||busy||saving||thinking||listening}>{thinking?'正在思考…':useAI?'发送':'下一步'}</button>{supported&&<button type="button" disabled={saving||thinking||busy} onClick={()=>{if(listening)stopVoice();else startVoice();}}>{listening?'停止收音':'同意并开始语音输入'}</button>}</div></form>
  <p className="pet-rule-label">{supported?'语音由浏览器提供，可能通过其在线服务处理音频。仅点击同意后收音，不保存录音；请核对识别文字。':'此浏览器不支持语音输入，可使用文字和上方按钮。'} {voiceStatus}</p></>}
 </section>;
}
