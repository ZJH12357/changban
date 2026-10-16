import { database, localPreview } from "@/db/runtime";

export type AccountRole="elder"|"caregiver";
export type Account={id:string;username:string;role:AccountRole};
const cookieName="changban_session";
const encoder=new TextEncoder();
export { hashPassword, verifyPassword } from "./password";

function hex(bytes:ArrayBuffer|Uint8Array){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("")}
function randomHex(size:number){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return hex(bytes)}
export function normalizeUsername(value:string){return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN")}
export function newSalt(){return randomHex(16)}
export function newSessionToken(){return randomHex(32)}
export async function hashToken(token:string){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(token)))}
export function readSessionToken(req:Request){return req.headers.get("cookie")?.match(new RegExp("(?:^|;\\s*)"+cookieName+"=([a-f0-9]{64})(?:;|$)"))?.[1]??null}
export function sessionCookie(token:string){return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${localPreview?"":"; Secure"}`}
export function expiredSessionCookie(){return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${localPreview?"":"; Secure"}`}
export function expectedOrigin(req:Request){return localPreview?new URL(req.url).protocol+"//"+req.headers.get("host"):new URL(req.url).origin}
export function assertSameOrigin(req:Request){const origin=req.headers.get("origin");if(origin&&origin!==expectedOrigin(req))throw new Error("ORIGIN_MISMATCH")}
export async function getAccount(req:Request):Promise<Account|null>{
 const token=readSessionToken(req);if(!token)return null;
 const tokenHash=await hashToken(token),now=new Date().toISOString();
 return database().prepare("SELECT u.id,u.username,u.role FROM sessions s JOIN app_users u ON u.id=s.user WHERE s.token_hash=? AND s.expires>?").bind(tokenHash,now).first<Account>();
}
export async function createSession(user:string){
 const token=newSessionToken(),tokenHash=await hashToken(token),created=new Date(),expires=new Date(created.getTime()+604800000);
 await database().prepare("INSERT INTO sessions (token_hash,user,expires,created) VALUES (?,?,?,?)").bind(tokenHash,user,expires.toISOString(),created.toISOString()).run();
 return token;
}
export async function deleteSession(req:Request){const token=readSessionToken(req);if(token)await database().prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashToken(token)).run()}
