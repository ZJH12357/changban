import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:3101';
const prefix=process.env.TEST_ORIGIN?'/pets':'';
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await page.goto(base+prefix+'/cat-preview.html');
 await page.waitForFunction(()=>!document.querySelector('#pet').disabled);
 const names=['安静待机','慢慢走路','歪头张望','伸个懒腰','打个小盹','抬爪招呼','开心一下','温柔提醒'];
 const states=['idle','walk','look','stretch','sleep','greet','happy','alert'];
 for(let i=0;i<states.length;i++){
  await page.getByRole('button',{name:names[i],exact:true}).click();
  assert.equal(await page.locator('#stage').getAttribute('data-state'),states[i]);
  assert.equal(await page.evaluate(()=>document.querySelector('#cat').contentDocument.documentElement.dataset.state),states[i]);
  assert.equal(await page.locator('button[data-state][aria-pressed=true]').count(),1);
 }
 await page.getByRole('button',{name:'打个小盹',exact:true}).click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#cat').contentDocument.querySelector('.closed-eyes')).opacity),'1');
 await page.getByRole('button',{name:'抬爪招呼',exact:true}).click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#cat').contentDocument.querySelector('.paw-right')).animationName),'wave');
 await page.getByRole('button',{name:'暂停动画',exact:true}).click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#cat').contentDocument.querySelector('.paw-right')).animationPlayState),'paused');
 await page.getByRole('button',{name:'继续动画',exact:true}).click();
 await page.getByRole('button',{name:'轮播动作',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#stage').dataset.state==='happy',{},{timeout:8000});
 await page.getByRole('button',{name:'停止轮播',exact:true}).click();
 await page.getByRole('button',{name:'安静待机',exact:true}).click();
 await page.screenshot({path:'outputs/cat-preview-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 for(const size of ['小','标准','大']){await page.getByRole('button',{name:size,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.getByRole('button',{name:'标准',exact:true}).click();
 await page.getByRole('button',{name:'摸摸小猫，让慢慢打个招呼',exact:true}).press('Enter');
 assert.equal(await page.locator('#stage').getAttribute('data-state'),'greet');
 await page.screenshot({path:'outputs/cat-preview-mobile.png',fullPage:true});
 await page.setViewportSize({width:320,height:740});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#cat').contentDocument.querySelector('.cat')).animationName),'none');
 await page.waitForFunction(()=>document.querySelector('#motion-note').textContent.includes('减少动态'));
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
 console.log('PASS: 8 SVG action states, waving/sleep poses, pause/resume, autoplay, keyboard interaction, 3 sizes, 320/390px mobile, reduced motion and no account/API traffic.');
}finally{await browser.close();}
