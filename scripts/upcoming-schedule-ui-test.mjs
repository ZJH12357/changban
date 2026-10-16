import assert from 'node:assert/strict';
import { addCalendarDays } from '../lib/care.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000', suffix = Date.now().toString(36), password = 'Demo2026Pass';
const elder = await browser.newContext({ viewport: { width: 1360, height: 960 } });
const care = await browser.newContext({ viewport: { width: 1360, height: 960 } });
const errors = [];
async function api(context, path, data, expected = 200) {
  const r = data ? await context.request.post(base + path, { data }) : await context.request.get(base + path);
  assert.equal(r.status(), expected, await r.text()); return r.json();
}
async function pageFor(context, username) {
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(username => localStorage.setItem('changban-pet-v2:' + username, JSON.stringify({ mode: 'fixed', greetings: false, reminders: false })), username);
  await p.goto(base); await p.locator('.pet-touch').waitFor(); return p;
}
try {
  const elderName = 'f_elder_' + suffix, careName = 'f_care_' + suffix;
  await api(elder, '/api/account', { action: 'register', username: elderName, password, role: 'elder', name: '未来日程测试' });
  let data = await api(elder, '/api/care');
  const tomorrow = addCalendarDays(data.today, 1);
  await api(care, '/api/account', { action: 'register', username: careName, password, role: 'caregiver' });
  await api(care, '/api/account', { action: 'bind', code: data.family.invite, name: '测试家属', phone: '00000000000', relation: '子女' });
  for (const task of data.tasks) await api(elder, '/api/care', { action: 'task', id: task.id, status: 'done' });
  const elderPage = await pageFor(elder, elderName), carePage = await pageFor(care, careName);
  await carePage.getByRole('button', { name: '添加提醒', exact: true }).click();
  const form = carePage.getByRole('dialog');
  await form.locator('input[name="title"]').fill('一起逛街');
  await form.locator('input[name="time"]').fill('16:00');
  await form.getByRole('combobox', { name: '重复方式' }).click();
  await carePage.getByRole('option', { name: '仅一次', exact: true }).click();
  await form.locator('input[name="date"]').fill(tomorrow);
  assert.match(await form.locator('.schedule-preview').innerText(), /明天.*16:00.*不计入今天/s);
  await form.getByRole('button', { name: '保存提醒', exact: true }).click();
  await carePage.getByRole('dialog').waitFor({ state: 'hidden' });
  data = await api(care, '/api/care');
  const shopping = data.plans.find(p => p.title === '一起逛街'); assert.ok(shopping); assert.equal(shopping.date, tomorrow);
  assert.equal(data.tasks.length, 3); assert.ok(data.tasks.every(t => t.status === 'done'));
  assert.equal(data.tasks.some(t => t.id === shopping.id), false);
  await elderPage.locator(`.upcoming-schedules [data-upcoming-id="${shopping.id}"]`).waitFor({ timeout: 20000 });
  assert.match(await elderPage.locator(`.upcoming-schedules [data-upcoming-id="${shopping.id}"]`).innerText(), /明天.*16:00/s);
  console.log('PASS: creating a tomorrow-only schedule shows a date preview and synchronizes to elder home without changing today\'s 3/3 completion.');

  await carePage.getByRole('button', { name: '提醒', exact: true }).click();
  assert.ok((await carePage.locator('.task-row').filter({ hasText: '一起逛街' }).innerText()).includes(tomorrow));
  await carePage.locator('.pet-touch').dblclick({ delay: 100 });
  const careDialog = carePage.getByRole('dialog');
  await carePage.getByRole('heading', { name: '家人的日程进度' }).waitFor();
  assert.equal(await careDialog.locator('.pet-agenda-item').count(), 3);
  assert.equal(await careDialog.locator('.pet-progress-status.done').count(), 3);
  const future = careDialog.locator(`[data-upcoming-id="${shopping.id}"]`);
  await future.scrollIntoViewIfNeeded();
  assert.match(await future.innerText(), /明天.*16:00/s);
  assert.equal(await future.getByRole('button').count(), 0);
  await carePage.waitForTimeout(300); await carePage.screenshot({ path: 'outputs/upcoming-caregiver.png', fullPage: true });
  await elderPage.locator('.pet-touch').dblclick({ delay: 100 });
  const elderDialog = elderPage.getByRole('dialog');
  await elderPage.getByRole('heading', { name: '今天的小安排' }).waitFor();
  await elderDialog.locator(`[data-upcoming-id="${shopping.id}"]`).scrollIntoViewIfNeeded();
  assert.ok((await elderDialog.innerText()).includes('一起逛街'));
  assert.equal(await elderDialog.locator('.pet-agenda-item').count(), 0);
  await api(elder, '/api/care', { action: 'task', id: shopping.id, status: 'done' }, 404);
  await api(care, '/api/care', { action: 'nudge', id: shopping.id }, 404);
  console.log('PASS: both pet panels show the future schedule and its date, management shows the date, and future items cannot be completed or nudged today.');

  await elderPage.setViewportSize({ width: 390, height: 844 }); await elderPage.waitForTimeout(500);
  await elderDialog.locator(`[data-upcoming-id="${shopping.id}"]`).scrollIntoViewIfNeeded();
  assert.equal(await elderPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await elderPage.screenshot({ path: 'outputs/upcoming-elder-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: future previews fit mobile, remain separate from today, and produce no browser runtime errors.');
} finally { await browser.close(); }
