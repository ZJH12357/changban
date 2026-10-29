import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});
 await page.goto((process.env.TEST_ORIGIN||'http://127.0.0.1:3000')+'/?demo=elder');
 for(const role of ['elder','caregiver']){
  if(role==='caregiver')await page.getByRole('button',{name:'体验家属端',exact:true}).click();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'历史',exact:true}).click();
  const chart=page.getByRole('article',{name:'七天日常完成图表'});
  await chart.waitFor();assert.equal(await chart.locator('button').count(),7);
  const date=await chart.locator('button').nth(5).getAttribute('aria-label');
  await chart.locator('button').nth(5).click();await page.waitForFunction(d=>document.querySelector('input[aria-label="查看日期"]').value===d,date.slice(0,10));
  await page.getByRole('button',{name:'回到今天',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const title=role==='elder'?'七日生活洞察':'七日关怀研报';
  await page.getByRole('button',{name:'查看'+title,exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:title,exact:true}).first().waitFor();
  await dialog.getByRole('button',{name:'生成体验研报',exact:true}).waitFor();assert.equal(await dialog.locator('.insight-report').count(),0);
  await dialog.getByRole('button',{name:'生成体验研报',exact:true}).click();await dialog.getByRole('heading',{name:'观察与分析',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1360,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'outputs/history-chart-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/history-chart-mobile.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS: seven daily bars, date navigation, both role analysis entries, explicit report generation, mobile/desktop layout and no real API/model calls.');
}finally{await browser.close();}
