import { shanghaiDate } from "@/lib/care";

export async function ensureHistoryTracking(db:D1Database,family:string,now=new Date().toISOString()){
 const existing=await db.prepare("SELECT start_date AS startDate FROM history_tracking WHERE family=?").bind(family).first<{startDate:string}>();
 if(existing)return existing.startDate;
 const day=shanghaiDate(new Date(now));
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO history_tracking (family,start_date,started_at) VALUES (?,?,?)").bind(family,day,now),
  db.prepare(`INSERT INTO reminder_revisions (family,reminder,effective,title,kind,time,frequency,date,weekday,note,active)
   SELECT family,id,?,title,kind,time,frequency,date,weekday,note,active FROM reminders r
   WHERE family=? AND NOT EXISTS (SELECT 1 FROM reminder_revisions v WHERE v.reminder=r.id)`).bind(now,family),
 ]);
 const saved=await db.prepare("SELECT start_date AS startDate FROM history_tracking WHERE family=?").bind(family).first<{startDate:string}>();
 return saved!.startDate;
}

export function reminderRevisionStatement(db:D1Database,family:string,reminder:string,now:string){
 return db.prepare(`INSERT INTO reminder_revisions (family,reminder,effective,title,kind,time,frequency,date,weekday,note,active)
  SELECT family,id,?,title,kind,time,frequency,date,weekday,note,active FROM reminders WHERE id=? AND family=?`).bind(now,reminder,family);
}
