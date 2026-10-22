import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000', suffix = Date.now().toString(36), password = 'Demo2026Pass';
const elder = await browser.newContext({ viewport: { width: 1360, height: 960 } });
const care = await browser.newContext({ viewport: { width: 1360, height: 960 } });
const errors = [];
async function api(context, path, data) {
  const r = data ? await context.request.post(base + path, { data }) : await context.request.get(base + path);
  assert.equal(r.ok(), true, await r.text()); return r.json();
}
async function pageFor(context, username, preferences) {
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ username, preferences }) => localStorage.setItem('changban-pet-v2:' + username, JSON.stringify(preferences)), { username, preferences });
  await page.goto(base); return page;
}
try {
  const elderName = 'u_elder_' + suffix, careName = 'u_care_' + suffix;
  await api(elder, '/api/account', { action: 'register', username: elderName, password, role: 'elder', name: '联动测试阿姨' });
  let data = await api(elder, '/api/care');
  await api(care, '/api/account', { action: 'register', username: careName, password, role: 'caregiver' });
  await api(care, '/api/account', { action: 'bind', code: data.family.invite, name: '测试女儿', phone: '00000000000', relation: '子女' });
  for (const p of data.plans) await api(care, '/api/care', { action: 'archive', id: p.id });
  for (const title of ['已经完成测试', '逾期联动测试', '稍后提醒测试']) {
    data = await api(care, '/api/care', { action: 'plan', plan: { title, time: '00:00', kind: 'activity', frequency: 'daily', date: data.today, weekday: 4, note: '虚拟界面验收' } });
  }
  const done = data.tasks.find(t => t.title === '已经完成测试'), late = data.tasks.find(t => t.title === '逾期联动测试'), future = data.tasks.find(t => t.title === '稍后提醒测试');
  await api(elder, '/api/care', { action: 'task', id: done.id, status: 'done' });
  await api(elder, '/api/care', { action: 'task', id: future.id, status: 'snoozed' });
  const elderPage = await pageFor(elder, elderName, { enabled: false });
  const carePage = await pageFor(care, careName, { mode: 'fixed', greetings: true, reminders: false });
  await carePage.locator('.pet-touch').waitFor();
  await carePage.locator('.pet-bubble-message').waitFor();
  assert.match(await carePage.locator('.pet-bubble-message').innerText(), /关心联动测试阿姨|完成进度/);
  await carePage.locator('.pet-touch').click(); await carePage.waitForTimeout(500);
  assert.match(await carePage.locator('.pet-bubble-message').innerText(), /已记录完成 1\/3 项，1 项时间未到，1 项待确认完成/);
  await carePage.locator('.pet-touch').dblclick({ delay: 100 });
  await carePage.getByRole('heading', { name: '家人的日程进度' }).waitFor();
  const lateRow = carePage.locator(`[data-task-id="${late.id}"]`);
  const futureRow = carePage.locator(`[data-task-id="${future.id}"]`);
  const doneRow = carePage.locator(`[data-task-id="${done.id}"]`);
  assert.equal(await carePage.locator('.pet-agenda-item').count(), 3);
  assert.match(await doneRow.innerText(), /已完成.*|老人于/s);
  assert.match(await futureRow.innerText(), /时间未到/);
  assert.match(await futureRow.innerText(), /老人选择了稍后提醒/);
  assert.match(await lateRow.innerText(), /待确认完成/);
  assert.equal(await doneRow.getByRole('button').count(), 0);
  assert.equal(await futureRow.getByRole('button').count(), 0);
  assert.equal(await carePage.getByRole('button', { name: '完成', exact: true }).count(), 0);
  await carePage.waitForTimeout(300);
  await carePage.screenshot({ path: 'outputs/family-pet-desktop.png', fullPage: true });
  console.log('PASS: caregiver greeting, single-click progress, three status classes, completed task visibility and no proxy-completion controls.');

  await lateRow.getByRole('button', { name: '提醒老人：逾期联动测试' }).click();
  assert.equal(await lateRow.getByRole('button').isDisabled(), true);
  await elderPage.locator('.family-nudge-row').waitFor({ timeout: 20000 });
  assert.equal(await elderPage.locator('.pet-widget').count(), 0);
  assert.match(await elderPage.locator('.family-nudge-row').innerText(), /测试女儿（子女）/);
  await elderPage.reload(); await elderPage.locator('.family-nudge-row').waitFor();
  await elderPage.screenshot({ path: 'outputs/family-nudge-elder.png', fullPage: true });
  await elderPage.getByRole('button', { name: '知道了：逾期联动测试' }).click();
  await carePage.waitForFunction(id => document.querySelector(`[data-task-id="${id}"]`)?.textContent.includes('老人已确认收到'), late.id, { timeout: 20000 });
  assert.equal((await api(elder, '/api/care')).tasks.find(t => t.id === late.id).status, 'pending');
  console.log('PASS: one-click reminder reaches elder with pet disabled, survives refresh, and acknowledgement synchronizes without completing the task.');

  await carePage.keyboard.press('Escape');
  await elderPage.getByRole('button', { name: '完成逾期联动测试', exact: true }).click();
  await carePage.waitForFunction(() => document.querySelector('.pet-bubble-message')?.textContent.includes('刚刚记录完成“逾期联动测试”'), null, { timeout: 20000 });
  await carePage.locator('.pet-touch').dblclick({ delay: 100 });
  await carePage.getByRole('heading', { name: '家人的日程进度' }).waitFor();
  await carePage.waitForFunction(id => document.querySelector(`[data-task-id="${id}"] .pet-progress-status`)?.textContent === '已记录完成', late.id, { timeout: 20000 });
  assert.equal(await carePage.locator('.pet-progress-status.done').count(), 2);
  assert.equal(await lateRow.getByRole('button').count(), 0);
  await carePage.setViewportSize({ width: 390, height: 844 });
  await carePage.waitForTimeout(500);
  assert.equal(await carePage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const box = await carePage.getByRole('dialog').boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
  await carePage.screenshot({ path: 'outputs/family-pet-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: elder completion triggers caregiver feedback and updated panel; mobile dialog fits viewport; no runtime errors.');
} finally { await browser.close(); }
