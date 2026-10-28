import { getAccount, assertSameOrigin } from '@/lib/app-auth';
import { aiConfig, allowAIRequest, askScheduleAI, cleanDraft, inputSchema } from '@/lib/ai-schedule-server';
import { scheduleTurn } from '@/lib/schedule-conversation';
import { shanghaiDate } from '@/lib/care';
import { database } from '@/db/runtime';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 try {if(!await getAccount(req))return json({error:'请先登录。'},401);return json({enabled:!!aiConfig()});}
 catch{return json({enabled:false});}
}
export async function POST(req:Request){
 try {assertSameOrigin(req);}catch{return json({error:'请求来源不匹配。'},403);}
 try {
  const account=await getAccount(req);if(!account)return json({error:'请先登录。'},401);
  const member=await database().prepare('SELECT role FROM members WHERE user=?').bind(account.id).first<{role:string}>();
  if(!member||member.role!==account.role)return json({error:'请先完成家庭绑定。'},403);
  if(Number(req.headers.get('content-length')??0)>14000)return json({error:'内容过长。'},413);
  const raw=await req.text();if(raw.length>14000)return json({error:'内容过长。'},413);
  const parsed=inputSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'请检查输入内容。'},400);
  const body=parsed.data,now=new Date(),context={role:account.role,today:shanghaiDate(now),now:now.toISOString()};
  const fallback=(reason:string)=>json({mode:'rules',reason,turn:scheduleTurn(cleanDraft(body.draft),body.input,context.today,context.now)});
  const config=aiConfig();if(!config)return fallback('未配置 AI，使用基础规则。');
  if(!allowAIRequest(account.id))return fallback('操作较频繁，本次使用基础规则，请稍后再试。');
  try {return json({mode:'ai',turn:await askScheduleAI(body,context,config)});}
  catch {return fallback('AI 暂时未能回复，本次使用基础规则，草稿已保留。');}
 }catch(error){return json({error:error instanceof SyntaxError?'提交格式不正确。':'暂时无法处理，请稍后重试。'},error instanceof SyntaxError?400:503);}
}
