import { database } from "@/db/runtime";
import { getAccount } from "@/lib/app-auth";
import { addCalendarDays, buildDailyHistory, shanghaiDate, type HistoryOccurrence, type ReminderRevision } from "@/lib/care";
import { ensureHistoryTracking } from "@/lib/history-store";
import { z } from "zod";
export const dynamic="force-dynamic";
const daySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v);
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
 try{
  const account=await getAccount(req);if(!account)return response({error:"请先登录，再查看日程历史。"},401);
  const db=database();
  const member=await db.prepare("SELECT m.family,m.role,f.created FROM members m JOIN families f ON f.id=m.family WHERE m.user=?").bind(account.id).first<{family:string;role:string;created:string}>();
  if(!member)return response({error:"请先绑定家庭。"},409);
  if(member.role!==account.role)return response({error:"账号角色与家庭身份不匹配。"},403);
  const today=shanghaiDate(),params=new URL(req.url).searchParams;
  const date=daySchema.parse(params.get("date")??today),range=z.enum(["7","30"]).parse(params.get("range")??"7");
  if(date>today)return response({error:"只能查看今天和过去的记录。"},400);
  const trackingStart=await ensureHistoryTracking(db,member.family);
  const earliestDate=shanghaiDate(new Date(member.created));
  if(date<earliestDate)return response({error:"所选日期早于家庭建立日期。"},400);
  const first=[addCalendarDays(date,1-Number(range)),earliestDate].sort().at(-1)!;
  const [v,o]=await Promise.all([
   db.prepare("SELECT sequence,reminder,effective,title,kind,time,frequency,date,weekday,note,active FROM reminder_revisions WHERE family=? ORDER BY effective,sequence").bind(member.family).all<ReminderRevision>(),
   db.prepare("SELECT o.reminder,o.date,o.status,o.snooze,o.updated,r.title,r.time,r.kind,r.note FROM occurrences o JOIN reminders r ON r.id=o.reminder WHERE o.family=? AND o.date>=? AND o.date<=?").bind(member.family,first,date).all<HistoryOccurrence>(),
  ]);
  const selected=buildDailyHistory(date,trackingStart,v.results,o.results),days=[];
  for(let d=date;d>=first;d=addCalendarDays(d,-1)){const {tasks,...summary}=buildDailyHistory(d,trackingStart,v.results,o.results);void tasks;days.push(summary);}
  return response({today,now:new Date().toISOString(),trackingStart,earliestDate,selected,days});
 }catch(e){if(e instanceof z.ZodError)return response({error:"日期无效，范围请选择近 7 天或近 30 天。"},400);console.error(e);return response({error:"暂时无法加载日程历史，请稍后重试。"},503);}
}
