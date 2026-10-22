import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.endsWith('/lib/demo.ts')&&specifier==='./care')return {url:new URL('../lib/care.ts',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {createDemoStore}=await import('../lib/demo.ts');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],api=[];
 await context.addInitScript(()=>{window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',localService:true}],speak(u){window.__spoken.push(u.text);u.onstart?.();},cancel(){}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await page.goto(base+'/?demo=elder');await page.getByRole('button',{name:'跳过引导',exact:true}).click();
 await page.getByRole('button',{name:'切换桌宠',exact:true}).click();
 assert.equal(await page.locator('.pet-companion-options>button').count(),3);
 await page.getByRole('button',{name:'固定位置',exact:false}).click();
 await page.getByRole('switch',{name:'桌宠语音陪伴',exact:true}).click();
 await page.getByRole('button',{name:'选择豆豆 · 小狗',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.pet-widget[data-pet-companion=dog] object')?.contentDocument?.documentElement.localName==='svg');
 assert.match(await page.locator('.pet-widget .pet-name').innerText(),/^豆豆/);
 assert.equal(await page.locator('.pet-widget').getAttribute('data-pet-mode'),'fixed');
 assert.equal(await page.evaluate(()=>window.__spoken.length),0);
 await page.getByRole('button',{name:'允许播放并试听',exact:true}).click();
 assert.match(await page.evaluate(()=>window.__spoken.at(-1)),/我是豆豆/);
 await page.locator('.pet-touch').press('Enter');await page.locator('.pet-bubble-message').filter({hasText:'最近的一件日程'}).waitFor();
 await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('heading',{name:'今天的小安排',exact:true}).waitFor();
 assert.equal(await page.locator('.pet-sheet .dog-avatar').count(),1);assert.match(await page.locator('.pet-sheet .eyebrow').innerText(),/豆豆/);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'豆豆先休息一下',exact:true}).click();assert.equal(await page.locator('.pet-widget').count(),0);
 await page.getByRole('button',{name:'找回豆豆',exact:true}).first().click();await page.locator('.pet-widget[data-pet-companion=dog]').waitFor();
 for(const name of ['选择慢慢 · 小猫','选择团团 · 小兔','选择豆豆 · 小狗'])await page.getByRole('button',{name,exact:true}).click();
 await page.locator('.pet-companion-picker').screenshot({path:'outputs/dog-picker-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'体验家属端',exact:true}).click();await page.locator('.pet-widget[data-pet-companion=rabbit]').waitFor();
 await page.getByRole('button',{name:'切换桌宠',exact:true}).click();await page.getByRole('button',{name:'选择豆豆 · 小狗',exact:true}).click();
 await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('heading',{name:'家人的日程进度',exact:true}).waitFor();assert.equal(await page.locator('.pet-sheet .dog-avatar').count(),1);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'体验老人端',exact:true}).click();await page.locator('.pet-widget[data-pet-companion=dog]').waitFor();
 const complete=page.getByRole('button',{name:'完成做一会儿轻松伸展',exact:true});await complete.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await complete.click();
 try{await page.waitForFunction(()=>document.querySelector('.pet-bubble-message')?.textContent.includes('豆豆给您点个赞'),null,{timeout:5000});}catch(e){console.log(await page.evaluate(()=>({bubble:document.querySelector('.pet-bubble-message')?.textContent,pet:document.querySelector('.pet-widget')?.outerHTML.slice(0,350),focus:document.activeElement?.tagName,tasks:[...document.querySelectorAll('.task-row')].map(t=>t.textContent),prefs:Object.entries(localStorage).filter(([k])=>k.startsWith('changban-pet'))})));throw e;}
 const stable=await browser.newContext(),fixture=createDemoStore().view('elder');fixture.account.username='dog_fixture';
 await stable.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/account'?{authenticated:true,account:fixture.account}:fixture}));
 const saved=await stable.newPage();await saved.goto(base);await saved.getByRole('button',{name:'切换桌宠',exact:true}).click();await saved.getByRole('button',{name:'选择豆豆 · 小狗',exact:true}).click();await saved.reload();await saved.locator('.pet-widget[data-pet-companion=dog]').waitFor();
 const art=await browser.newPage({viewport:{width:360,height:380}});await art.goto(base+'/pets/dog.svg');
 for(const state of ['idle','walk','look','stretch','sleep','greet','happy','alert']){await art.evaluate(s=>document.documentElement.dataset.state=s,state);assert.ok(await art.locator('.dog').count());}
 await art.evaluate(()=>document.documentElement.dataset.state='greet');assert.equal(await art.locator('.paw-right').evaluate(el=>getComputedStyle(el).animationName),'wave');
 await art.screenshot({path:'outputs/dog-avatar.png'});
 await art.evaluate(()=>document.documentElement.dataset.paused='true');assert.equal(await art.locator('.tail').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
 await art.emulateMedia({reducedMotion:'reduce'});assert.equal(await art.locator('.tail').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
 console.log('PASS: three companions; dog SVG actions, reminders/panels/voice name, rest/find, role isolation, saved choice after reload, mobile layout, pause/reduced motion and no real data writes.');
}finally{await browser.close();}
