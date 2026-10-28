import { addCalendarDays, type Reminder } from './care';

export type ScheduleDraft = Partial<Pick<Reminder, 'title'|'date'|'time'|'frequency'|'note'>>;
export type ScheduleTurn = { draft: ScheduleDraft; reply: string; ready: boolean };
const numbers: Record<string, number> = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
function number(s: string): number {
 if (/^\d+$/.test(s)) return Number(s);
 if (s.includes('十')) {const [a,b] = s.split('十');return (a ? numbers[a] : 1)*10+(b ? numbers[b] : 0);}
 return numbers[s] ?? NaN;
}
export function validDay(day: string) {return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day+'T12:00:00Z')) && new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;}

export function checkScheduleDraft(draft:ScheduleDraft,today:string,now:string):ScheduleTurn {
 const result=(reply:string,ready=false):ScheduleTurn=>({draft,reply,ready});
 if(!draft.title?.trim())return result('想让我提醒您做什么事？例如“去公园散步”。');
 if(draft.title.length>80)return result('事情名称请控制在 80 个字以内。');
 if(!draft.date)return result(`“${draft.title}”安排在哪一天？可以说今天、明天、后天。`);
 if(!validDay(draft.date))return result('这个日期不存在，请重新选择日期。');
 if(draft.date<today)return result('这个日期已经过去了，请告诉我新的日期。');
 if(!draft.time)return result('几点提醒您？可以说“下午四点半”，或输入 16:30。');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))return result('时间不正确，请重新选择时间。');
 if(Date.parse(draft.date+'T'+draft.time+':00+08:00')<=Date.parse(now))return result('这个时间已经过去了，请换一个日期或时间；我不会自动替您改到明天。');
 if(!draft.frequency)return result('只提醒这一次，还是每天提醒？');
 if(!['once','daily'].includes(draft.frequency))return result('请选择仅一次或每天提醒。');
 if((draft.note?.length??0)>240)return result('备注请控制在 240 个字以内。');
 return result('请检查下面的日程卡片。没问题再点“确认保存”；也可以继续说“改成后天”或“改成下午五点”。',true);
}

/** Deliberately bounded rules, not a language model. Produces drafts only, never writes. */
export function scheduleTurn(previous: ScheduleDraft, input: string, today: string, now: string): ScheduleTurn {
 const text=input.trim(),draft={...previous};
 const result=(reply:string,ready=false):ScheduleTurn=>({draft,reply,ready});
 if (!text) return result('可以慢慢说，您想记什么事？');
 if (text.length>300) return result('这句话有些长，请一次告诉我一件事。');
 if (/取消|不记了|算了|重新开始/.test(text)) return {draft:{},reply:'好的，刚才的草稿已取消，没有保存。想记新事情时再告诉我。',ready:false};
 if (/^(删除|修改|完成|取消日程|查历史)/.test(text)) return result('这轮对话只支持新增和查询安排。修改、完成或删除已有日程，请使用日程面板；这里不会执行这些操作。');
 if ((text.match(/\d{1,2}[:：]\d{1,2}|[零一二两三四五六七八九十\d]{1,3}[点时]/g)||[]).length>1 || (text.match(/今天|明天|后天|\d{4}-\d{1,2}-\d{1,2}/g)||[]).length>1) return result('这句话里有多个日期或时间，请一次只安排一件事，并告诉我最终采用的日期和时间。');
 // Do not silently guess ambiguous relative dates or invalid times.
 const explicit=text.match(/\d{4}-\d{1,2}-\d{1,2}/);
 if (explicit) {const parts=explicit[0].split('-');const day=parts[0]+'-'+parts[1].padStart(2,'0')+'-'+parts[2].padStart(2,'0');if(!validDay(day))return result('这个日期不存在，请换一个日期，例如 2026-11-02。');draft.date=day;}
 else if (/后天/.test(text)) draft.date=addCalendarDays(today,2);
 else if (/明天/.test(text)) draft.date=addCalendarDays(today,1);
 else if (/今天/.test(text)||(/每天/.test(text)&&!draft.date)) draft.date=today;
 else if (/下周|星期|周[一二三四五六日天]|下个月|过几天|周末/.test(text)) return result('我还不能准确理解这个日期，请告诉我是今天、明天、后天，或填写具体日期。');
 if (/每天/.test(text)) draft.frequency='daily';
 else if (/一次|不重复|仅这次/.test(text)) draft.frequency='once';
 const colon=text.match(/(\d{1,2})[:：](\d{1,2})/);
 const chinese=text.match(/([零一二两三四五六七八九十\d]{1,3})[点时](半|一刻|三刻|[零一二两三四五六七八九十\d]{1,3}分?)?/);
 if(colon||chinese){
  let hour=number((colon??chinese)![1]);const raw=chinese?.[2];
  const minute=colon?Number(colon[2]):raw==='半'?30:raw==='一刻'?15:raw==='三刻'?45:raw?number(raw.replace('分','')):0;
  if(hour>23||minute>59||!Number.isFinite(hour+minute))return result('时间不正确，请说例如“下午四点半”，或填写 16:30。');
  if(/下午|晚上|傍晚|中午/.test(text)&&hour<12)hour+=12;
  if(/凌晨|早上|上午/.test(text)&&hour===12)hour=0;
  if(!colon && hour<12 && !/下午|晚上|傍晚|中午|凌晨|早上|上午/.test(text))return result('您说的是上午还是下午？请补充完整时间，例如“下午四点”。');
  draft.time=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 }
 let title=text.replace(/\d{4}-\d{1,2}-\d{1,2}/g,'').replace(/今天|明天|后天|每天|下午|晚上|傍晚|中午|凌晨|早上|上午/g,'').replace(/\d{1,2}[:：]\d{1,2}/g,'').replace(/([零一二两三四五六七八九十\d]{1,3})[点时](半|一刻|三刻|[零一二两三四五六七八九十\d]{1,3}分?)?/g,'').replace(/^(不对[，,]?|改成|改为|帮我|请|我想|我要|想|记一下|记个|提醒我|安排|添加|日程)+/g,'').replace(/只提醒一次|仅这次|不重复|一次/g,'').replace(/[，。！？,!?\s]/g,'').trim();
 if(title && !/^(是的|好的|确认|就这样|对|嗯|改一下|不对|重复|日程|提醒)$/.test(title)) {
  if(title.length>80)return result('事情名称请控制在 80 个字以内。');
  draft.title=title;
 }
 return checkScheduleDraft(draft,today,now);
}

export function draftPlan(draft: ScheduleDraft): Omit<Reminder,'id'> {
 if(!draft.title?.trim()||draft.title.length>80||!draft.date||!validDay(draft.date)||!draft.time||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)||!draft.frequency||!['once','daily'].includes(draft.frequency)||(draft.note?.length??0)>240)throw new Error('日程信息不完整或格式不正确。');
 return {title:draft.title.trim(),date:draft.date,time:draft.time,frequency:draft.frequency,weekday:new Date(draft.date+'T12:00:00Z').getUTCDay(),kind:'other',note:draft.note?.trim()??''};
}
