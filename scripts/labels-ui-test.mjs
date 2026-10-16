import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const base='http://127.0.0.1:3000',suffix=Date.now().toString(36),password='Demo2026Pass';
async function api(context,path,data){const r=await context.request.post(base+path,{data});assert.equal(r.ok(),true,await r.text());return r.json();}
try{
 const elder=await browser.newContext(),care=await browser.newContext();
 const eu='labels_e_'+suffix,cu='labels_c_'+suffix;
 await api(elder,'/api/account',{action:'register',username:eu,password,role:'elder',name:'陈阿姨'});
 const state=await (await elder.request.get(base+'/api/care')).json();
 await api(care,'/api/account',{action:'register',username:cu,password,role:'caregiver'});
 await api(care,'/api/account',{action:'bind',code:state.family.invite,name:'小林',phone:'00000000000',relation:'子女'});
 for(const [context,username,isElder] of [[elder,eu,true],[care,cu,false]]){
  const page=await context.newPage();
  await page.addInitScript(username=>localStorage.setItem('changban-pet-v2:'+username,JSON.stringify({enabled:false})),username);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'主导航'});
  await nav.getByRole('button',{name:isElder?'日常':'提醒',exact:true}).waitFor();
  assert.equal(await nav.getByRole('button',{name:isElder?'提醒':'日常',exact:true}).count(),0);
  await nav.getByRole('button',{name:'记录',exact:true}).click();
  await page.getByRole('heading',{name:'陈阿姨的生活记录',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'小林的生活记录',exact:true}).count(),0);
  if(isElder){await nav.getByRole('button',{name:'日常',exact:true}).click();await page.getByRole('heading',{name:'您好，陈阿姨',exact:true}).waitFor();}
  console.log('PASS: '+(isElder?'elder 日常 navigation':'caregiver 提醒 navigation')+' and elder-named record heading.');
 }
}finally{await browser.close();}
