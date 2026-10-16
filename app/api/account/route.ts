import { database } from "@/db/runtime";
import { assertSameOrigin, createSession, deleteSession, expiredSessionCookie, getAccount, hashPassword, newSalt, normalizeUsername, verifyPassword, sessionCookie, type AccountRole } from "@/lib/app-auth";
import { shanghaiDate } from "@/lib/care";
import { z } from "zod";

export const dynamic="force-dynamic";
const username=z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_-]+$/u);
const password=z.string().min(8).max(72).refine(v=>/[A-Za-z]/.test(v)&&/\d/.test(v));
const name=z.string().trim().min(1).max(80);
const phone=z.string().trim().min(6).max(25).regex(/^\+?[\d ()-]+$/);
const relation=z.enum(["配偶","子女","兄弟姐妹","亲属","护工","朋友","其他"]);
class ApiError extends Error{constructor(public status:number,message:string,public code?:string){super(message)}}
function response(data:unknown,status=200,cookie?:string){return Response.json(data,{status,headers:{"Cache-Control":"no-store",...(cookie?{"Set-Cookie":cookie}:{})}})}
function failure(e:unknown){if(e instanceof ApiError)return response({error:e.message,code:e.code},e.status);if(e instanceof z.ZodError)return response({error:"请检查填写内容。用户名为 3–24 位，密码至少 8 位并同时包含字母和数字。"},400);if(e instanceof Error&&e.message==="ORIGIN_MISMATCH")return response({error:"请求来源不匹配。"},403);console.error(e);return response({error:"暂时无法完成操作，请稍后重试。"},503)}
async function status(req:Request){
 const account=await getAccount(req);if(!account)return {authenticated:false};
 const member=await database().prepare("SELECT family,name,phone,relation FROM members WHERE user=?").bind(account.id).first<{family:string;name:string;phone:string;relation:string}>();
 return {authenticated:true,account:{username:account.username,role:account.role},needsBinding:account.role==="caregiver"&&!member,profile:member?{name:member.name,phone:member.phone,relation:member.relation}:null};
}
export async function GET(req:Request){try{return response(await status(req))}catch(e){return failure(e)}}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);if(Number(req.headers.get("content-length")??0)>12000)throw new ApiError(413,"提交内容过长。");
  const body=z.record(z.unknown()).parse(await req.json()),action=z.enum(["register","login","logout","bind"]).parse(body.action),db=database();
  if(action==="logout"){await deleteSession(req);return response({authenticated:false},200,expiredSessionCookie())}
  if(action==="register"){
   const form=z.object({username,password,role:z.enum(["elder","caregiver"]),name:z.string().trim().max(80).optional(),phone:z.string().trim().max(25).optional(),city:z.string().trim().max(40).optional()}).parse(body);
   const normalized=normalizeUsername(form.username);if(await db.prepare("SELECT id FROM app_users WHERE username=?").bind(normalized).first())throw new ApiError(409,"这个用户名已经被使用。");
   const id=crypto.randomUUID(),salt=newSalt(),passwordHash=await hashPassword(form.password,salt),now=new Date().toISOString();
   const statements=[db.prepare("INSERT INTO app_users (id,username,password_hash,salt,role,created) VALUES (?,?,?,?,?,?)").bind(id,normalized,passwordHash,salt,form.role,now)];
   if(form.role==="elder"){
    const elderName=name.parse(form.name),elderPhone=form.phone?phone.parse(form.phone):"",family="f:"+id,invite=crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase(),today=shanghaiDate();
    statements.push(db.prepare("INSERT INTO families (id,owner,name,city,share,check_time,invite,created) VALUES (?,?,?,?,1,'10:00',?,?)").bind(family,id,elderName,form.city??"",invite,now),db.prepare("INSERT INTO members (user,family,role,name,phone,relation) VALUES (?,?,'elder',?,?,'')").bind(id,family,elderName,elderPhone));
    const defaults=[["visit","去社区复诊","09:00","visit","once","带上医保卡和检查单"],["walk","到楼下散散步","16:30","activity","daily","按自己的节奏，轻松活动一下"],["water","喝一杯温水","10:30","other","daily","记得补充水分"]];
    for(const [key,title,time,kind,frequency,note] of defaults)statements.push(db.prepare("INSERT INTO reminders (id,family,title,kind,time,frequency,date,weekday,note,active) VALUES (?,?,?,?,?,?,?,?,?,1)").bind(family+":"+key,family,title,kind,time,frequency,today,4,note));
   }
   try{await db.batch(statements)}catch{throw new ApiError(409,"这个用户名已经被使用。");}
   const token=await createSession(id);
   return response(await status(new Request(req.url,{headers:{cookie:"changban_session="+token}})),200,sessionCookie(token));
  }
  if(action==="login"){
   const form=z.object({username,password}).parse(body),normalized=normalizeUsername(form.username);
   const found=await db.prepare("SELECT id,username,password_hash,salt,role FROM app_users WHERE username=?").bind(normalized).first<{id:string;username:string;password_hash:string;salt:string;role:AccountRole}>();
   if(!found||!await verifyPassword(form.password,found.salt,found.password_hash))throw new ApiError(401,"用户名或密码不正确。");
   const token=await createSession(found.id);return response(await status(new Request(req.url,{headers:{cookie:"changban_session="+token}})),200,sessionCookie(token));
  }
  const account=await getAccount(req);if(!account)throw new ApiError(401,"请先登录。","AUTH_REQUIRED");if(account.role!=="caregiver")throw new ApiError(403,"只有家属账号需要绑定老人。");
  if(await db.prepare("SELECT user FROM members WHERE user=?").bind(account.id).first())throw new ApiError(409,"这个家属账号已经完成绑定。");
  const form=z.object({code:z.string().trim().toUpperCase().length(16),name,phone,relation}).parse(body),family=await db.prepare("SELECT id FROM families WHERE invite=?").bind(form.code).first<{id:string}>();
  if(!family)throw new ApiError(404,"家庭码不正确或已失效。");
  await db.prepare("INSERT INTO members (user,family,role,name,phone,relation) VALUES (?,?,'caregiver',?,?,?)").bind(account.id,family.id,form.name,form.phone,form.relation).run();
  return response(await status(req));
 }catch(e){return failure(e)}
}
