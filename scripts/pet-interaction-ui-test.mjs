import assert from 'node:assert/strict';
import { nearestPetTask } from '../lib/pet.ts';

// Use an installed Playwright package; no browser installation or real accounts required.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000';
const username = 'pet_click_' + Date.now(), password = 'Demo2026Pass';
const context = await browser.newContext({ viewport: { width: 1360, height: 960 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
async function api(path, data) {
  const r = data ? await context.request.post(base + path, { data }) : await context.request.get(base + path);
  assert.equal(r.ok(), true, await r.text()); return r.json();
}
const preferences = { mode: 'fixed', greetings: true, reminders: false };
async function prepare(target, prefs = preferences) {
  await target.addInitScript(({ username, prefs }) => localStorage.setItem('changban-pet-v2:' + username, JSON.stringify(prefs)), { username, prefs });
  await target.goto(base);
  await target.locator('.pet-touch').waitFor();
}
const bubble = () => page.locator('.pet-bubble-message');
const pet = () => page.locator('.pet-touch');
const panel = () => page.getByRole('heading', { name: '今天的小安排' });
try {
  await api('/api/account', { action: 'register', username, password, role: 'elder', name: '交互测试' });
  const data = await api('/api/care');
  await page.clock.install();
  await prepare(page);
  await page.waitForFunction(() => document.querySelector('.pet-bubble-message')?.textContent.includes('您好'));
  assert.match(await bubble().innerText(), /看看今天的日程/);
  const initial = await bubble().innerText();
  await page.waitForTimeout(1000);
  assert.equal(await bubble().innerText(), initial, 'Overdue tasks must not immediately replace the entry greeting.');
  console.log('PASS: immediate entry greeting includes schedule guidance and is not overwritten.');

  await page.getByRole('button', { name: '收起团团的话' }).click();
  await pet().click();
  await page.waitForTimeout(500);
  const nearest = nearestPetTask(data.tasks, data.today, Date.now());
  assert.match(await bubble().innerText(), /最近的一件日程/);
  assert.ok((await bubble().innerText()).includes(nearest.title));
  assert.equal(await panel().count(), 0);
  await pet().click(); await page.waitForTimeout(500);
  assert.match(await bubble().innerText(), /您一叫我/);
  await pet().click(); await page.waitForTimeout(500);
  assert.match(await bubble().innerText(), /能陪着您/);
  assert.equal(await panel().count(), 0);
  await page.clock.fastForward(15100);
  await pet().click(); await page.waitForTimeout(500);
  assert.match(await bubble().innerText(), /最近的一件日程/);
  console.log('PASS: single click reminds one nearest task; repeated clicks chat; 15 seconds resets.');

  const beforeDouble = await bubble().innerText();
  await pet().dblclick({ delay: 90 }); await panel().waitFor();
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  assert.equal(await bubble().innerText(), beforeDouble, 'Double click must not also execute a single click.');
  await pet().focus(); await page.keyboard.press('ArrowDown'); await panel().waitFor();
  await page.keyboard.press('Escape');
  const box = await pet().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x - 90, box.y + 20, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(600);
  assert.equal(await panel().count(), 0);
  assert.equal(await bubble().innerText(), beforeDouble);
  console.log('PASS: double click opens only the panel; keyboard access and drag suppression work.');

  await page.reload(); await page.locator('.pet-bubble-message').waitFor();
  assert.match(await bubble().innerText(), /您好/);
  await pet().click(); await page.waitForTimeout(500);
  const reminder = await bubble().innerText();
  await page.getByRole('button', { name: '打开桌宠与陪伴设置' }).click();
  assert.equal(await bubble().innerText(), reminder, 'Switching app sections must not repeat the greeting.');
  console.log('PASS: refresh greets again; internal navigation does not repeat the entry greeting.');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await context.storageState() });
  try {
    const touch = await mobile.newPage(); touch.on('pageerror', e => errors.push(e.message));
    await prepare(touch);
    await touch.locator('.pet-bubble-message').waitFor();
    const greeting = await touch.locator('.pet-bubble-message').innerText();
    await touch.locator('.pet-touch').tap(); await touch.waitForTimeout(100); await touch.locator('.pet-touch').tap();
    await touch.getByRole('heading', { name: '今天的小安排' }).waitFor();
    await touch.keyboard.press('Escape'); await touch.waitForTimeout(600);
    assert.equal(await touch.locator('.pet-bubble-message').innerText(), greeting);
    await touch.locator('.pet-touch').tap(); await touch.waitForTimeout(500);
    assert.match(await touch.locator('.pet-bubble-message').innerText(), /最近的一件日程/);
    assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log('PASS: mobile double tap opens only the panel; single tap reminds; no horizontal overflow.');
  } finally { await mobile.close(); }

  for (const task of data.tasks) await api('/api/care', { action: 'task', id: task.id, status: 'done' });
  await page.reload(); await pet().waitFor(); await pet().click(); await page.waitForTimeout(500);
  assert.match(await bubble().innerText(), /今天没有待办/);
  assert.deepEqual(errors, []);
  console.log('PASS: completed agenda has a friendly empty state; no browser runtime errors.');
} finally { await browser.close(); }
