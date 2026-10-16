import assert from 'node:assert/strict';
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:3000', suffix = Date.now().toString(36), password = 'Demo2026Pass';
function client() {
  let cookie = '';
  return async (path, data, expected = 200) => {
    const r = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: { Cookie: cookie, ...(data ? { 'Content-Type': 'application/json', Origin: base } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const next = r.headers.get('set-cookie'); if (next) cookie = next.split(';')[0];
    const result = await r.json(); assert.equal(r.status, expected, JSON.stringify(result)); return result;
  };
}
const elder = client(), care = client(), care2 = client(), stranger = client(), anonymous = client();
await anonymous('/api/care', { action: 'nudge', id: 'nope' }, 401);
await elder('/api/account', { action: 'register', username: 'n_elder_' + suffix, password, role: 'elder', name: '提醒测试老人' });
let state = await elder('/api/care');
for (const [c, username] of [[care, 'n_care_' + suffix], [care2, 'n_care2_' + suffix]]) {
  await c('/api/account', { action: 'register', username, password, role: 'caregiver' });
  await c('/api/account', { action: 'bind', code: state.family.invite, name: '测试家属', phone: '00000000000', relation: '子女' });
}
await stranger('/api/account', { action: 'register', username: 'n_other_' + suffix, password, role: 'elder', name: '其他家庭' });
const p = { title: '一键提醒验收', kind: 'activity', time: '00:00', frequency: 'daily', date: state.today, weekday: 4, note: '虚拟测试' };
state = await care('/api/care', { action: 'plan', plan: p });
const task = state.tasks.find(t => t.title === p.title);
await elder('/api/care', { action: 'nudge', id: task.id }, 403);
await care('/api/care', { action: 'nudge', id: 'other-family-id' }, 404);
await care('/api/care', { action: 'nudge' }, 400);
state = await care('/api/care', { action: 'nudge', id: task.id });
let nudge = state.nudges.find(n => n.reminder === task.id);
assert.ok(nudge); assert.equal(nudge.senderName, '测试家属'); assert.equal(nudge.seen, null);
assert.equal(state.family.invite, undefined);
assert.equal((await elder('/api/care')).nudges[0].id, nudge.id);
assert.equal((await stranger('/api/care')).nudges.length, 0);
await care2('/api/care', { action: 'nudge', id: task.id }, 409);
await care('/api/care', { action: 'nudgeSeen', id: nudge.id }, 403);
await stranger('/api/care', { action: 'nudgeSeen', id: nudge.id }, 404);
state = await elder('/api/care', { action: 'nudgeSeen', id: nudge.id });
assert.ok(state.nudges.find(n => n.id === nudge.id).seen);
assert.equal(state.tasks.find(t => t.id === task.id).status, 'pending', 'Acknowledging must never complete the task.');
assert.ok((await care('/api/care')).nudges.find(n => n.id === nudge.id).seen);
await care('/api/care', { action: 'task', id: task.id, status: 'done' }, 403);
await elder('/api/care', { action: 'task', id: task.id, status: 'done' });
await care('/api/care', { action: 'nudge', id: task.id }, 409);
await elder('/api/care', { action: 'task', id: task.id, status: 'snoozed' });
await care('/api/care', { action: 'nudge', id: task.id }, 409);
// Concurrent caregivers must not generate two new notifications for one occurrence.
state = await care('/api/care', { action: 'plan', plan: { ...p, title: '并发提醒验收' } });
const concurrent = state.tasks.find(t => t.title === '并发提醒验收');
const results = await Promise.allSettled([care('/api/care', { action: 'nudge', id: concurrent.id }), care2('/api/care', { action: 'nudge', id: concurrent.id })]);
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
assert.equal(results.find(r => r.status === 'rejected').reason.actual, 409);
assert.equal((await elder('/api/care')).nudges.filter(n => n.reminder === concurrent.id).length, 1);
state = await care('/api/care', { action: 'plan', plan: { ...p, title: '已停用事项' } });
const archived = state.tasks.find(t => t.title === '已停用事项');
await care('/api/care', { action: 'archive', id: archived.id });
await care('/api/care', { action: 'nudge', id: archived.id }, 404);
console.log('PASS: cross-account persisted reminders, elder acknowledgement without completion, role/family isolation, done/snoozed/archived rejection, shared cooldown and concurrent deduplication.');
