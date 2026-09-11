const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { SpeechService, validateSettings } = require('../electron/speech-service.cjs');
// Node uses -u for an unrelated flag, so run the fixture through a small launcher.
function service(t, timeout = 2000) {
  const value = new SpeechService({ python: process.execPath, worker: path.join(__dirname, 'fixtures/worker.cjs'), cache: '.', timeout });
  // Keep the real subprocess/protocol implementation, adapting only Python's -u flag.
  value.workerArgs = [value.worker];
  t.after(() => value.dispose());
  return value;
}
test('settings reject unsupported engine input', () => {
  assert.equal(validateSettings().device, 'cpu');
  assert.throws(() => validateSettings({ model: '../bad' }));
  assert.throws(() => validateSettings({ device: 'shell' }));
  assert.throws(() => validateSettings({ offline: 'false' }));
});
test('Unicode segments and repeated requests use the same worker', async t => {
  const value = service(t);
  const events = [];
  value.on('progress', data => events.push(data));
  assert.equal((await value.request('check')).text, '你好，Vico');
  const child = value.child;
  await value.request('load');
  assert.equal(value.child, child);
  assert.equal(events.length, 2);
});
test('engine errors do not block the next request', async t => {
  const value = service(t);
  await assert.rejects(value.request('fail'), /模型加载失败/);
  assert.equal((await value.request('check')).command, 'check');
});
test('concurrent requests are rejected; cancellation allows restart', async t => {
  const value = service(t);
  const first = assert.rejects(value.request('hang'), /取消/);
  await assert.rejects(value.request('check'), /正在运行/);
  value.cancel();
  await first;
  assert.equal((await value.request('check')).command, 'check');
});
test('worker crashes report failure and can restart', async t => {
  const value = service(t);
  await assert.rejects(value.request('crash'), /退出/);
  await value.request('check');
});
test('timeout ends a stuck process', async t => {
  const value = service(t, 120);
  await assert.rejects(value.request('hang'), /超时/);
  assert.equal(value.child, null);
});
test('missing Python reports actionable error', async t => {
  const value = new SpeechService({ python: 'nonexistent-vico-python-executable', worker: 'worker.py', cache: '.' });
  t.after(() => value.dispose());
  await assert.rejects(value.request('check'), /setup:engine/);
});
