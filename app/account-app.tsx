'use client';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Heart, LogIn, ShieldCheck, UserRound, Users, LogOut } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import CareApp from "@/app/care-app";
import { DemoExperience } from "@/components/demo-experience";
import type { Role } from "@/lib/care";

type Session={authenticated:boolean;account?:{username:string;role:"elder"|"caregiver"};needsBinding?:boolean;profile?:{name:string;phone:string;relation:string}|null;error?:string};
async function post(payload:Record<string,unknown>){const r=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await r.json() as Session;if(!r.ok)throw new Error(data.error||"操作失败，请重试。");return data}

export default function AccountApp(){
 const [demo,setDemo]=useState<Role|null>(null);
 const [session,setSession]=useState<Session|null>(null),[error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/account",{cache:"no-store"}),data=await r.json() as Session;if(!r.ok)throw new Error(data.error||"无法读取账号信息");setSession(data);setError("")}catch(e){setError(e instanceof Error?e.message:"连接中断")}},[]);
 useEffect(()=>{const role=new URLSearchParams(window.location.search).get('demo');if(role==='elder'||role==='caregiver'){setDemo(role);return;}void load()},[load]);
 function enterDemo(role:Role){const url=new URL(window.location.href);url.searchParams.set('demo',role);window.history.replaceState(null,'',url);setDemo(role);}
 function exitDemo(){const url=new URL(window.location.href);url.searchParams.delete('demo');window.history.replaceState(null,'',url);setDemo(null);void load();}
 async function logout(){try{setSession(await post({action:"logout"}));toast.success("已退出账号")}catch(e){toast.error(e instanceof Error?e.message:"退出失败")}}
 if(demo)return <DemoExperience initialRole={demo} onExit={exitDemo}/>;
 const demoEntry=<section className="demo-entry"><h2>先看看常伴是什么样</h2><p>免注册 · 虚拟家庭 · 不写入真实数据</p><div><button className="button secondary" onClick={()=>enterDemo('elder')}>免注册体验老人端</button><button className="button secondary" onClick={()=>enterDemo('caregiver')}>免注册体验家属端</button></div></section>;
 if(error)return <AccountShell>{demoEntry}<div className="auth-card"><h1>暂时无法加载</h1><p className="muted spaced">{error}</p><button className="button primary full" onClick={()=>void load()}>重新加载</button></div></AccountShell>;
 if(!session)return <AccountShell>{demoEntry}<div className="auth-card auth-loading">正在打开常伴…</div></AccountShell>;
 if(!session.authenticated)return <AccountShell>{demoEntry}<AuthPanel success={setSession}/></AccountShell>;
 if(session.account?.role==="caregiver"&&session.needsBinding)return <AccountShell><BindingPanel account={session.account.username} success={setSession} logout={logout}/></AccountShell>;
 return <CareApp onLogout={logout}/>;
}

function AccountShell({children}:{children:ReactNode}){return <div className="auth-shell"><Toaster position="top-center" richColors/><header className="auth-brand"><span className="brand-mark"><Heart fill="currentColor"/></span><span>常伴</span><small>家庭关怀</small></header>{children}<p className="auth-footnote"><ShieldCheck size={17}/>账号资料与家庭记录分开保存</p></div>}

function AuthPanel({success}:{success:(s:Session)=>void}){
 const [mode,setMode]=useState("login"),[role,setRole]=useState<"elder"|"caregiver">("elder"),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const values=Object.fromEntries(new FormData(e.currentTarget));try{const data=await post({action:mode,...values,...(mode==="register"?{role}:{})});success(data);toast.success(mode==="login"?"欢迎回来":"账号创建成功")}catch(err){toast.error(err instanceof Error?err.message:"操作失败")}finally{setBusy(false)}}
 return <main className="auth-card"><div className="auth-heading"><span className="round-icon"><Heart/></span><p className="eyebrow">安心相伴，从一个账号开始</p><h1>{mode==="login"?"登录常伴":"创建常伴账号"}</h1><p className="muted">老人和家属拥有各自独立的账号与使用界面。</p></div><Tabs value={mode} onValueChange={setMode}><TabsList className="auth-tabs"><TabsTrigger value="login">登录</TabsTrigger><TabsTrigger value="register">注册</TabsTrigger></TabsList></Tabs>{mode==="register"&&<div className="role-choice" role="group" aria-label="选择账号身份"><button type="button" className={role==="elder"?"selected":""} onClick={()=>setRole("elder")}><UserRound/><strong>我是老人</strong><span>获取家庭码，记录日常</span></button><button type="button" className={role==="caregiver"?"selected":""} onClick={()=>setRole("caregiver")}><Users/><strong>我是家属</strong><span>使用家庭码绑定老人</span></button></div>}<form onSubmit={submit}><label>用户名<input name="username" required minLength={3} maxLength={24} autoComplete="username" placeholder="3–24 位中文、字母或数字"/></label><label>密码<input name="password" type="password" required minLength={8} maxLength={72} autoComplete={mode==="login"?"current-password":"new-password"} placeholder="至少 8 位，同时包含字母和数字"/></label>{mode==="register"&&role==="elder"&&<><label>您的称呼<input name="name" required maxLength={80} placeholder="例如：林阿姨"/></label><div className="form-grid"><label>联系电话（选填）<input name="phone" type="tel" maxLength={25} placeholder="方便家人联系"/></label><label>所在城市（选填）<input name="city" maxLength={40} placeholder="例如：广州"/></label></div></>}<button className="button primary full" disabled={busy}><LogIn size={20}/>{busy?"请稍候…":mode==="login"?"登录":"创建账号"}</button></form><p className="field-help auth-note">这是比赛原型账号系统；暂不提供短信验证与找回密码功能。</p></main>
}

function BindingPanel({account,success,logout}:{account:string;success:(s:Session)=>void;logout:()=>Promise<void>}){
 const [relation,setRelation]=useState("子女"),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const values=Object.fromEntries(new FormData(e.currentTarget));try{success(await post({action:"bind",...values,relation}));toast.success("绑定成功，欢迎加入家庭")}catch(err){toast.error(err instanceof Error?err.message:"绑定失败")}finally{setBusy(false)}}
 return <main className="auth-card binding-card"><div className="account-line"><span>当前账号：<b>{account}</b></span><button className="text-button" onClick={()=>void logout()}><LogOut size={18}/>换一个账号</button></div><div className="auth-heading"><span className="round-icon"><Users/></span><p className="eyebrow">家属账号 · 首次设置</p><h1>加入老人的家庭</h1><p className="muted">请向老人获取家庭码，并完善您的联系信息。</p></div><form onSubmit={submit}><label>家庭码<input name="code" required minLength={16} maxLength={16} autoComplete="off" placeholder="输入老人提供的 16 位家庭码"/></label><label>您的称呼<input name="name" required maxLength={80} placeholder="例如：女儿 · 小林"/></label><label>联系电话<input name="phone" type="tel" required minLength={6} maxLength={25} placeholder="填写可以联系到您的号码"/></label><label>与老人的关系<Select value={relation} onValueChange={setRelation}><SelectTrigger className="form-select" aria-label="与老人的关系"><SelectValue/></SelectTrigger><SelectContent>{["配偶","子女","兄弟姐妹","亲属","护工","朋友","其他"].map(item=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></label><button className="button primary full" disabled={busy}><ShieldCheck size={20}/>{busy?"正在绑定…":"确认并加入家庭"}</button></form><p className="field-help auth-note">绑定后，此账号只能进入家属端。家庭码只由老人查看和管理。</p></main>
}
