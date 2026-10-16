import { database, localPreview } from "@/db/runtime";
import { getAccount } from "@/lib/app-auth";
import { scheduled, shanghaiDate, type FamilyNudge, type Reminder, type Role } from "@/lib/care";
import { PET_NUDGE_COOLDOWN_MS, petDueAt } from "@/lib/pet";
import { ensureHistoryTracking, reminderRevisionStatement } from "@/lib/history-store";
import { z } from "zod";
export const dynamic="force-dynamic";
const clean=z.string().trim().min(1).max(80);
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>!Number.isNaN(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d);
const plan=z.object({id:z.string().max(160).optional(),title:clean,kind:z.enum(["medicine","visit","activity","other"]),time,frequency:z.enum(["once","daily","weekly"]),date,weekday:z.number().int().min(0).max(6),note:z.string().trim().max(240)});
class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
const all=async<T,>(q:D1PreparedStatement)=>(await q.all<T>()).results;
async function context(req:Request){
 const db=database(),account=await getAccount(req);
 if(!account)throw new ApiError(401,"请先登录，再进入您的家庭。");
 return {db,user:account.id,account};
}
async function memberContext(req:Request){
 const ctx=await context(req);const {db,user,account}=ctx;
 const m=await db.prepare("SELECT * FROM members WHERE user=?").bind(user).first<{user:string;family:string;role:Role;name:string;phone:string;relation:string}>();
 if(!m)throw new ApiError(account.role==="caregiver"?409:503,account.role==="caregiver"?"请先使用家庭码绑定一位老人。":"暂时无法加载家庭，请重试。");
 if(m.role!==account.role)throw new ApiError(403,"账号角色与家庭成员身份不匹配。");
 const family=await db.prepare("SELECT * FROM families WHERE id=?").bind(m.family).first<{id:string;owner:string;name:string;city:string;share:number;check_time:string;invite:string}>();
 if(!family)throw new ApiError(403,"无法访问这个家庭。");
 return {...ctx,m,family,role:account.role};
}
async function state(c:Awaited<ReturnType<typeof memberContext>>){
 const {db,family,role}=c, day=shanghaiDate(), canSee=role==="elder"||!!family.share;
 await ensureHistoryTracking(db,family.id);
 const [plans,occs,members,checkins,requests,records,history,nudges]=await Promise.all([
 all<Reminder>(db.prepare("SELECT * FROM reminders WHERE family=? AND active=1 ORDER BY time,id").bind(family.id)),
 all<{reminder:string;status:string;snooze:string|null;updated:string}>(db.prepare("SELECT * FROM occurrences WHERE family=? AND date=?").bind(family.id,day)),
 all<{user:string;role:Role;name:string;phone:string;relation:string}>(db.prepare("SELECT user,role,name,phone,relation FROM members WHERE family=? ORDER BY role DESC,name").bind(family.id)),
 all(db.prepare("SELECT date,mood,updated FROM checkins WHERE family=? ORDER BY date DESC LIMIT 30").bind(family.id)),
 all(db.prepare("SELECT * FROM requests WHERE family=? ORDER BY created DESC LIMIT 30").bind(family.id)),
 canSee?all(db.prepare("SELECT * FROM records WHERE family=? ORDER BY date DESC LIMIT 30").bind(family.id)):Promise.resolve([]),
 all(db.prepare("SELECT o.date,o.status,o.updated,r.title FROM occurrences o JOIN reminders r ON o.reminder=r.id WHERE o.family=? ORDER BY o.updated DESC LIMIT 50").bind(family.id)),
 all<FamilyNudge>(db.prepare("SELECT id,reminder,date,sender_name AS senderName,sender_relation AS senderRelation,due,created,seen FROM family_nudges WHERE family=? AND date=? ORDER BY created DESC LIMIT 100").bind(family.id,day))
 ]);
 const tasks=plans.filter(r=>scheduled(r,day)).map(r=>{const o=occs.find(o=>o.reminder===r.id);return {...r,status:o?.status??"pending",snooze:o?.snooze,updated:o?.updated}});
 const {owner,invite,...publicFamily}=family;void owner;
 const familyView=role==="elder"?{...publicFamily,invite}:publicFamily;
 const memberView=members.map(m=>({role:m.role,name:m.name,phone:m.phone,relation:m.relation,isSelf:m.user===c.user}));
 return {today:day,now:new Date().toISOString(),role,account:{username:c.account.username,role:c.account.role},self:{name:c.m.name,phone:c.m.phone,relation:c.m.relation},family:familyView,members:memberView,plans,tasks,checkins,requests,nudges,records,history};
}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}})}
function failure(e:unknown){if(e instanceof ApiError)return response({error:e.message},e.status);if(e instanceof z.ZodError)return response({error:"请检查填写内容，时间、日期或数值格式不正确。"},400);console.error(e);return response({error:"暂时无法保存，请稍后重试。填写内容会保留。"},503)}
export async function GET(req:Request){try{const c=await memberContext(req);return response(await state(c))}catch(e){return failure(e)}}
export async function POST(req:Request){
 try{
  const origin=req.headers.get("origin");
  const expectedOrigin=localPreview?new URL(req.url).protocol+"//"+req.headers.get("host"):new URL(req.url).origin;
  if(origin&&origin!==expectedOrigin)throw new ApiError(403,"请求来源不匹配。");
  if(Number(req.headers.get("content-length")??0)>20000)throw new ApiError(413,"提交内容过长。");
  let body:Record<string,unknown>;try{body=z.record(z.unknown()).parse(await req.json())}catch{throw new ApiError(400,"提交格式不正确。")}
  const c=await memberContext(req);const {db,family,role}=c;const id=family.id,day=shanghaiDate(),now=new Date().toISOString();
  const action=z.string().parse(body.action);
  const elder=()=>{if(role!=="elder")throw new ApiError(403,"请由老人本人操作。")};
  const caregiver=()=>{if(role!=="caregiver")throw new ApiError(403,"请切换到家属端管理提醒。")};
  async function contact(){
   await db.prepare("INSERT INTO requests (id,family,status,created) SELECT ?,?,'pending',? WHERE NOT EXISTS (SELECT 1 FROM requests WHERE family=? AND status!='resolved')").bind(crypto.randomUUID(),id,now,id).run();
  }
  if(action==="plan"){
   caregiver();const p=plan.parse(body.plan);
   await ensureHistoryTracking(db,id,now);
   if(p.id){const found=await db.prepare("SELECT id FROM reminders WHERE id=? AND family=? AND active=1").bind(p.id,id).first();if(!found)throw new ApiError(404,"找不到这条提醒。");
    await db.batch([db.prepare("UPDATE reminders SET title=?,kind=?,time=?,frequency=?,date=?,weekday=?,note=? WHERE id=? AND family=?").bind(p.title,p.kind,p.time,p.frequency,p.date,p.weekday,p.note,p.id,id),reminderRevisionStatement(db,id,p.id,now)]);
   }else{const rid=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO reminders (id,family,title,kind,time,frequency,date,weekday,note,active) VALUES (?,?,?,?,?,?,?,?,?,1)").bind(rid,id,p.title,p.kind,p.time,p.frequency,p.date,p.weekday,p.note),reminderRevisionStatement(db,id,rid,now)]);}
  }else if(action==="archive"){
   caregiver();const reminder=z.string().parse(body.id);await ensureHistoryTracking(db,id,now);
   const found=await db.prepare("SELECT id FROM reminders WHERE id=? AND family=? AND active=1").bind(reminder,id).first();if(!found)throw new ApiError(404,"找不到这条提醒。");
   await db.batch([db.prepare("UPDATE reminders SET active=0 WHERE id=? AND family=? AND active=1").bind(reminder,id),reminderRevisionStatement(db,id,reminder,now)]);
  }else if(action==="task"){
   elder();const reminder=z.string().parse(body.id);const status=z.enum(["done","pending","snoozed"]).parse(body.status);
   await ensureHistoryTracking(db,id,now);
   const r=await db.prepare("SELECT * FROM reminders WHERE id=? AND family=? AND active=1").bind(reminder,id).first<Reminder>();if(!r||!scheduled(r,day))throw new ApiError(404,"这条提醒不属于今天。");
   await db.prepare("INSERT INTO occurrences (id,family,reminder,date,status,snooze,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(reminder,date) DO UPDATE SET status=excluded.status,snooze=excluded.snooze,updated=excluded.updated").bind(reminder+":"+day,id,reminder,day,status,status==="snoozed"?new Date(Date.now()+600000).toISOString():null,now).run();
  }else if(action==="nudge"){
   caregiver();const reminder=z.string().min(1).max(160).parse(body.id);
   const r=await db.prepare("SELECT * FROM reminders WHERE id=? AND family=? AND active=1").bind(reminder,id).first<Reminder>();
   if(!r||!scheduled(r,day))throw new ApiError(404,"这条提醒不属于今天或当前家庭。");
   const o=await db.prepare("SELECT status,snooze FROM occurrences WHERE reminder=? AND family=? AND date=?").bind(reminder,id,day).first<{status:string;snooze:string|null}>();
   if(o?.status==="done")throw new ApiError(409,"老人已记录完成，无需再次提醒。");
   const due=petDueAt({...r,status:o?.status,snooze:o?.snooze??undefined},day);
   if(due>Date.now())throw new ApiError(409,"尚未到提醒时间，请尊重老人的日程安排。");
   // A single conditional upsert enforces the family-wide cooldown even for concurrent clicks.
   const result=await db.prepare(`INSERT INTO family_nudges (id,family,reminder,date,sender_name,sender_relation,due,created)
    SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM occurrences WHERE reminder=? AND date=? AND (status='done' OR (status='snoozed' AND snooze>?)))
    AND EXISTS (SELECT 1 FROM reminders WHERE id=? AND family=? AND active=1)
    ON CONFLICT(reminder,date) DO UPDATE SET id=excluded.id,sender_name=excluded.sender_name,sender_relation=excluded.sender_relation,due=excluded.due,created=excluded.created,seen=NULL
    WHERE family_nudges.created<=?`).bind(crypto.randomUUID(),id,reminder,day,c.m.name,c.m.relation,new Date(due).toISOString(),now,reminder,day,now,reminder,id,new Date(Date.now()-PET_NUDGE_COOLDOWN_MS).toISOString()).run();
   if(!result.meta.changes)throw new ApiError(409,"刚刚已提醒过，或老人已更新日程。请刷新后查看，同一事项 5 分钟内不重复提醒。");
  }else if(action==="nudgeSeen"){
   elder();const nid=z.string().min(1).max(160).parse(body.id);
   const result=await db.prepare("UPDATE family_nudges SET seen=COALESCE(seen,?) WHERE id=? AND family=? AND date=?").bind(now,nid,id,day).run();
   if(!result.meta.changes)throw new ApiError(404,"找不到这条家属提醒。");
  }else if(action==="checkin"){
   elder();const mood=z.enum(["good","contact"]).parse(body.mood);
   await db.prepare("INSERT INTO checkins (id,family,date,mood,updated) VALUES (?,?,?,?,?) ON CONFLICT(family,date) DO UPDATE SET mood=excluded.mood,updated=excluded.updated").bind(id+":"+day,id,day,mood,now).run();
   if(mood==="contact")await contact();
  }else if(action==="contact"){elder();await contact();
  }else if(action==="request"){
   caregiver();const status=z.enum(["seen","resolved"]).parse(body.status),rid=z.string().parse(body.id);
   const r=await db.prepare("UPDATE requests SET status=?,seen=COALESCE(seen,?),resolved=CASE WHEN ?='resolved' THEN ? ELSE resolved END WHERE id=? AND family=? AND status!='resolved'").bind(status,now,status,now,rid,id).run();
   if(!r.meta.changes){const exists=await db.prepare("SELECT id FROM requests WHERE id=? AND family=?").bind(rid,id).first();if(!exists)throw new ApiError(404,"请求不存在。")}
  }else if(action==="record"){
   elder();const r=z.object({mood:z.enum(["开心","平静","低落"]),sleep:z.number().min(0).max(24),systolic:z.number().int().min(30).max(300).nullable(),diastolic:z.number().int().min(20).max(200).nullable(),note:z.string().trim().max(300)}).refine(r=>(r.systolic===null)===(r.diastolic===null)).parse(body.record);
   await db.prepare("INSERT INTO records (id,family,date,mood,sleep,systolic,diastolic,note,created) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(family,date) DO UPDATE SET mood=excluded.mood,sleep=excluded.sleep,systolic=excluded.systolic,diastolic=excluded.diastolic,note=excluded.note,created=excluded.created").bind(id+":"+day,id,day,r.mood,r.sleep,r.systolic,r.diastolic,r.note,now).run();
  }else if(action==="profile"){
   elder();if(family.owner!==c.user)throw new ApiError(403,"只有老人本人可以修改资料。");
   const p=z.object({name:clean,city:z.string().trim().max(40),check_time:time}).parse(body.profile);
   await db.batch([db.prepare("UPDATE families SET name=?,city=?,check_time=? WHERE id=?").bind(p.name,p.city,p.check_time,id),db.prepare("UPDATE members SET name=? WHERE user=?").bind(p.name,c.user)]);
  }else if(action==="share"){
   elder();await db.prepare("UPDATE families SET share=? WHERE id=?").bind(z.boolean().parse(body.share)?1:0,id).run();
  }else if(action==="member"){
   const m=z.object({name:clean,phone:z.string().trim().max(25).refine(p=>p===""||/^\+?[\d ()-]{6,25}$/.test(p)),relation:z.enum(["配偶","子女","兄弟姐妹","亲属","护工","朋友","其他"]).optional()}).parse(body.member);
   if(role==="caregiver"&&(!m.phone||!m.relation))throw new ApiError(400,"家属需要填写联系电话和与老人的关系。");
   await db.prepare("UPDATE members SET name=?,phone=?,relation=? WHERE user=?").bind(m.name,m.phone,role==="caregiver"?(m.relation??c.m.relation):"",c.user).run();
  }else if(action==="rotateInvite"){
   elder();if(family.owner!==c.user)throw new ApiError(403,"只有老人本人可以更换家庭码。");
   await db.prepare("UPDATE families SET invite=? WHERE id=?").bind(crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase(),id).run();
  }else throw new ApiError(400,"不支持的操作。");
  const updated=await memberContext(req);
  return response(await state(updated));
 }catch(e){return failure(e)}
}
