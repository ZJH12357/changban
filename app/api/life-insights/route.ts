import { assertSameOrigin, getAccount } from '@/lib/app-auth';
import { aiConfig, allowAIRequest } from '@/lib/ai-schedule-server';
import { basicInsightReport } from '@/lib/life-insights';
import { generateAIInsight, insightContext } from '@/lib/life-insights-server';
import { z } from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{
 const account=await getAccount(req);if(!account)return json({error:'请先登录。'},401);
 const snapshot=await insightContext(account.id,account.role,true);if(!snapshot)return json({error:'请先完成家庭绑定。'},403);
 return json({snapshot,aiAvailable:!!aiConfig()});
}catch{return json({error:'暂时无法读取七日记录，请稍后重试。'},503);}}
export async function POST(req:Request){
 try{assertSameOrigin(req);}catch{return json({error:'请求来源不匹配。'},403);}
 try{
  const account=await getAccount(req);if(!account)return json({error:'请先登录。'},401);
  if(Number(req.headers.get('content-length')??0)>1000)return json({error:'提交内容过长。'},413);
  const raw=await req.text();if(raw.length>1000)return json({error:'提交内容过长。'},413);
  const body=z.object({mode:z.enum(['ai','rules']),includeLife:z.boolean(),consent:z.boolean().optional()}).strict().parse(JSON.parse(raw));
  if(body.mode==='ai'&&body.consent!==true)return json({error:'请先同意将选定的聚合记录交由 AI 分析。'},400);
  const snapshot=await insightContext(account.id,account.role,body.includeLife);if(!snapshot)return json({error:'请先完成家庭绑定。'},403);
  const fallback=(notice?:string)=>json({snapshot,report:basicInsightReport(snapshot),mode:'rules',...(notice?{notice}:{})});
  if(body.mode==='rules')return fallback();
  const config=aiConfig();if(!config)return fallback('尚未配置 AI，以下为基于记录的基础解读。');
  if(!allowAIRequest('insight:'+account.id))return fallback('生成较频繁，本次提供基础解读，请稍后再试 AI。');
  try{return json({snapshot,report:await generateAIInsight(snapshot,config),mode:'ai'});}catch{return fallback('AI 暂时未能生成报告，以下为基于记录的基础解读。');}
 }catch(e){return json({error:e instanceof z.ZodError||e instanceof SyntaxError?'提交格式不正确。':'暂时无法生成，请稍后重试。'},e instanceof z.ZodError||e instanceof SyntaxError?400:503);}
}
