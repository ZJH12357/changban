import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const registered=await context.request.post(base+'/api/account',{data:{action:'register',role:'elder',username:'ai_ui_'+Date.now(),password:'Test2026Password',name:'AI流程测试'}});assert.equal(registered.status(),200);
 const state=await (await context.request.get(base+'/api/care')).json();
 const day=new Date(Date.parse(state.today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const draft={title:'AI测试散步',date:day,time:'16:30',frequency:'once'};
 let calls=0,fail=false;
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/pet-chat',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{enabled:true}});
  calls++;const body=route.request().postDataJSON();assert.ok(!body.history.some(m=>m.role==='system'));assert.equal(body.petName,'团团');
  if(fail)return route.abort();
  await new Promise(resolve=>setTimeout(resolve,250));
  return route.fulfill({json:{mode:'ai',turn:{reply:'请检查日程卡片，再点确认保存。',draft,ready:true}}});
 });
 await page.goto(base);await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('button',{name:'和团团说句话',exact:true}).click();
 const opt=page.getByRole('button',{name:'同意并开启 AI 对话',exact:true});await opt.waitFor();assert.equal(calls,0);
 await opt.click();const input=page.getByLabel('告诉团团您想做什么');await input.fill('明天和老伴散步，下午四点半，一次');await page.getByRole('button',{name:'发送',exact:true}).click();
 await page.getByRole('button',{name:'正在思考…',exact:true}).waitFor();assert.equal(await input.isDisabled(),true);
 await page.getByRole('button',{name:'发送',exact:true}).waitFor();assert.equal(calls,1);
 assert.equal((await (await context.request.get(base+'/api/care')).json()).plans.some(p=>p.title===draft.title),false,'AI must not auto-save.');
 await page.getByRole('button',{name:'确认保存',exact:true}).click();await page.getByText(/记好啦/).waitFor();
 assert.equal((await (await context.request.get(base+'/api/care')).json()).plans.filter(p=>p.title===draft.title).length,1);
 fail=true;await input.fill('后天再去买菜');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByText(/连接暂时未成功/).waitFor();assert.equal(await input.inputValue(),'后天再去买菜');
 await page.getByRole('button',{name:'关闭 AI，使用基础规则',exact:true}).click();await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('heading',{name:'这件事提醒几次？'}).waitFor();assert.equal(calls,2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: mobile AI opt-in, request lock, draft-only generation, explicit save, network retry preservation, rule fallback and no browser errors (mock model).');
}finally{await browser.close();}
