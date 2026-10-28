import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{window.__mic=[];window.SpeechRecognition=class{constructor(){window.__mic.push(this);}start(){window.__recording=true;}stop(){window.__recording=false;this.onend?.();}abort(){window.__recording=false;}};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const network=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push(r.url());});
 await page.goto(base+'/?demo=elder');await page.locator('.pet-touch').press('ArrowDown');
 await page.getByRole('button',{name:'和团团说句话',exact:true}).click();
 const input=page.getByLabel('告诉团团您想做什么'),send=async text=>{await input.fill(text);await page.getByRole('button',{name:'下一步',exact:true}).click();};
 // Reproduce the reported stall: a title followed by "仅一次" must open the next question.
 await send('想吃螺蛳粉');await page.getByRole('heading',{name:'这件事提醒几次？'}).waitFor();assert.equal(await page.getByRole('button',{name:'确认保存',exact:true}).count(),0);
 assert.equal(await page.getByLabel('选择提醒时间').count(),0,'Later questions should not appear early.');
 await page.getByRole('button',{name:'仅一次',exact:true}).click();await page.getByRole('heading',{name:'安排在哪一天？'}).waitFor();
 await page.getByRole('button',{name:'下一步，选时间',exact:true}).click();await page.getByRole('alert').filter({hasText:'请选择今天或之后的日期'}).waitFor();
 await page.getByRole('button',{name:'明天',exact:true}).click();await page.getByRole('button',{name:'下一步，选时间',exact:true}).click();
 await page.getByLabel('选择提醒时间').fill('16:30');await page.getByRole('button',{name:'下一步，填备注',exact:true}).click();
 await page.getByLabel('备注（选填）').fill('和家人一起去，少放辣椒');
 await page.getByRole('button',{name:'上一步',exact:true}).click();assert.equal(await page.getByLabel('选择提醒时间').inputValue(),'16:30');
 await page.getByRole('button',{name:'下一步，填备注',exact:true}).click();assert.equal(await page.getByLabel('备注（选填）').inputValue(),'和家人一起去，少放辣椒');
 await page.getByRole('button',{name:'下一步，核对安排',exact:true}).click();assert.match(await page.locator('.pet-draft').innerText(),/吃螺蛳粉/);assert.match(await page.locator('.pet-draft').innerText(),/少放辣椒/);
 await page.getByRole('button',{name:'今天的安排',exact:true}).click();assert.equal(await page.getByRole('button',{name:'确认保存',exact:true}).isEnabled(),true,'Queries must preserve wizard state.');
 await page.getByRole('button',{name:'确认保存',exact:true}).click();await page.getByText(/记好啦/).waitFor();
 await page.getByRole('button',{name:'日程进度',exact:true}).click();await page.getByRole('dialog').getByText('吃螺蛳粉',{exact:true}).waitFor();await page.getByRole('dialog').getByText('和家人一起去，少放辣椒',{exact:true}).waitFor();
 await page.getByRole('button',{name:'和团团说句话',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__mic.length),0,'Mic must not start automatically.');
 await page.getByRole('button',{name:'同意并开始语音输入',exact:true}).click();
 await page.evaluate(()=>window.__mic.at(-1).onresult({results:[[{transcript:'明天下午五点买菜'}]]}));
 assert.equal(await page.getByRole('button',{name:'下一步',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'停止收音',exact:true}).click();assert.equal(await input.inputValue(),'明天下午五点买菜');
 await page.getByRole('button',{name:'同意并开始语音输入',exact:true}).click();await page.evaluate(()=>window.__mic.at(-1).onerror({error:'not-allowed'}));
 await page.getByText(/未获得麦克风权限/).waitFor();assert.equal(await input.inputValue(),'明天下午五点买菜');
 assert.equal(await page.evaluate(()=>window.__recording),false);
 // Daily schedule: back/edit preserves fields; past time is rejected, optional note can be skipped.
 await input.fill('喝水');await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'每天',exact:true}).click();
 await page.getByRole('button',{name:'今天',exact:true}).click();await page.getByRole('button',{name:'下一步，选时间',exact:true}).click();await page.getByLabel('选择提醒时间').fill('00:00');await page.getByRole('button',{name:'下一步，填备注',exact:true}).click();await page.getByRole('alert').filter({hasText:'过去'}).waitFor();
 await page.getByRole('button',{name:'上一步',exact:true}).click();await page.getByRole('button',{name:'后天',exact:true}).click();await page.getByRole('button',{name:'下一步，选时间',exact:true}).click();await page.getByLabel('选择提醒时间').fill('09:30');await page.getByRole('button',{name:'下一步，填备注',exact:true}).click();await page.getByRole('button',{name:'跳过备注',exact:true}).click();assert.match(await page.locator('.pet-draft').innerText(),/每天/);assert.match(await page.locator('.pet-draft').innerText(),/备注：无/);
 await page.getByRole('button',{name:'修改事项',exact:true}).click();assert.equal(await input.inputValue(),'喝水');await input.fill('喝温水');await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'取消草稿',exact:true}).click();assert.equal(await input.inputValue(),'');
 await page.screenshot({path:'outputs/schedule-conversation-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(network,[]);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'体验家属端',exact:true}).click();await page.locator('.pet-touch').press('ArrowDown');await page.getByRole('button',{name:'和团团说句话',exact:true}).click();
 await page.getByRole('button',{name:'明天的安排',exact:true}).click();await page.locator('.pet-conversation-reply').filter({hasText:'和家人一起逛街'}).waitFor();
 const unsupported=await browser.newContext();await unsupported.addInitScript(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});const p2=await unsupported.newPage();await p2.goto(base+'/?demo=elder');await p2.locator('.pet-touch').press('ArrowDown');await p2.getByRole('button',{name:'和团团说句话',exact:true}).click();await p2.getByText(/此浏览器不支持语音输入/).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: sequential questionnaire, reported title/frequency stall, date/time pickers, back/edit, notes saved, daily/once, past-time rejection, cancel, role queries, opt-in mock ASR and no real API traffic/browser errors.');
}finally{await browser.close();}
