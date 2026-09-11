const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { DoubaoService, normalizeResult } = require('../electron/doubao-service.cjs');

function response(code, body = {}, message = 'OK', httpStatus = 200) {
  return new Response(JSON.stringify(body), { status: httpStatus, headers: { 'X-Api-Status-Code': code, 'X-Api-Message': message, 'X-Tt-Logid': 'log-123' } });
}
async function fixture(t, extension = '.wav') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vico-doubao-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, `audio${extension}`);
  await fs.writeFile(file, Buffer.from('RIFF fake audio'));
  return file;
}

test('submits Base64 audio and polls until result', async t => {
  const file = await fixture(t);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/submit')) return response('20000000');
    if (calls.length === 2) return response('20000001');
    return response('20000000', { audio_info: { duration: 2500 }, result: { text: '你好，豆包。', utterances: [{ start_time: 100, end_time: 2400, text: '你好，豆包。' }] } });
  };
  const service = new DoubaoService({ fetchImpl, pollInterval: 1 });
  const progress = [];
  service.onProgress = value => progress.push(value.message);
  const result = await service.transcribe(file, 'secret-key', { enableDdc: true });
  assert.equal(result.text, '你好，豆包。');
  assert.equal(result.duration, 2.5);
  assert.deepEqual(result.segments[0], { start: 0.1, end: 2.4, text: '你好，豆包。', speaker: null });
  const submit = JSON.parse(calls[0].options.body);
  assert.equal(submit.audio.format, 'wav');
  assert.equal(Buffer.from(submit.audio.data, 'base64').toString(), 'RIFF fake audio');
  assert.equal(calls[0].options.headers['X-Api-Key'], 'secret-key');
  assert.equal(calls[0].options.headers['X-Api-Resource-Id'], 'volc.seedasr.auc');
  assert.equal(progress.length, 2);
});

test('reports submit errors without exposing key', async t => {
  const file = await fixture(t);
  const service = new DoubaoService({ fetchImpl: async () => response('45000001', {}, 'invalid request') });
  await assert.rejects(service.transcribe(file, 'never-print-this-secret'), error => {
    assert.match(error.message, /45000001/);
    assert.doesNotMatch(error.message, /never-print/);
    return true;
  });
});

test('rejects unsupported files and missing credentials', async t => {
  const file = await fixture(t, '.webm');
  const service = new DoubaoService({ fetchImpl: async () => response('20000000') });
  await assert.rejects(service.transcribe(file, 'key'), /暂不支持/);
  await assert.rejects(service.transcribe(file, ''), /API Key/);
});

test('cancels a polling request', async t => {
  const file = await fixture(t);
  const service = new DoubaoService({ fetchImpl: async url => response(url.endsWith('/submit') ? '20000000' : '20000001'), pollInterval: 1000 });
  const pending = service.transcribe(file, 'key');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(service.cancel(), true);
  await assert.rejects(pending, /取消/);
  assert.equal(service.cancel(), false);
});

test('normalizes absent utterances', () => {
  const result = normalizeResult({ result: { text: '只有整段文字', additions: { duration: '1234' } } }, 0.4);
  assert.equal(result.text, '只有整段文字');
  assert.equal(result.duration, 1.234);
  assert.deepEqual(result.segments, []);
});
