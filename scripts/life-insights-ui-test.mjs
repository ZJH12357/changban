import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),base=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),network=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push(r.url());});
 await page.goto(base+'/?demo=elder');
 await page.getByLabel('选择体验情境').selectOption('rest');await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.getByLabel('选择体验情境').inputValue(),'week');
 await page.getByLabel('选择体验情境').selectOption('rest');await page.getByRole('button',{name:'确认重置体验',exact:true}).click();assert.equal(await page.getByLabel('选择体验情境').inputValue(),'rest');
 await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('button',{name:'七日生活洞察',exact:true}).click();
 await page.getByRole('button',{name:'生成体验研报',exact:true}).waitFor();assert.equal(await page.locator('.insight-report').count(),0,'No report should be generated automatically.');
 await page.getByRole('button',{name:'生成体验研报',exact:true}).click();await page.getByRole('heading',{name:'观察与分析',exact:true}).waitFor();await page.getByRole('heading',{name:'给您的行动建议',exact:true}).waitFor();assert.match(await page.locator('.insight-report').innerText(),/共有 7 天生活记录/);assert.doesNotMatch(await page.locator('.insight-report').innerText(),/当前记录不作前后趋势比较/);
 await page.locator('.insight-evidence summary').first().click();assert.match(await page.locator('.insight-report').innerText(),/不代表|多种|实际|核对/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'outputs/seven-day-insight-mobile.png'});
 await page.getByLabel('纳入已授权的睡眠与心情记录').uncheck();assert.equal(await page.locator('.insight-report').count(),0);await page.getByRole('button',{name:'生成体验研报',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'休息与心情线索',exact:true}).count(),0);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'体验家属端',exact:true}).click();await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('button',{name:'七日关怀研报',exact:true}).click();await page.getByRole('button',{name:'生成体验研报',exact:true}).click();await page.getByRole('heading',{name:'关怀行动建议',exact:true}).waitFor();await page.getByRole('heading',{name:'先聊感受，再问进度',exact:false}).waitFor();
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);console.log('PASS: mobile role-specific reports, explicit generation, observations/advice/evidence, privacy toggle, no real API/model traffic and no browser errors.');
}finally{await browser.close();}
