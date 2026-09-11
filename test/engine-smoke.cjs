const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { SpeechService, validateSettings } = require('../electron/speech-service.cjs');
const root = path.join(__dirname, '..');
const service = new SpeechService({ python: path.join(root, '.venv/Scripts/python.exe'), worker: path.join(root, 'engine/worker.py'), cache: path.join(process.env.APPDATA, 'vico-whisper-test/models'), timeout: 180000 });
service.on('progress', event => console.log(JSON.stringify(event)));
(async () => {
  try {
    console.log(await service.request('check'));
    const chinese = process.argv.includes('--zh');
    const result = await service.request('transcribe', { path: path.join(root, chinese ? 'output/sample-zh.wav' : 'output/sample.wav'), settings: validateSettings({ model: 'base', language: chinese ? 'zh' : 'en', offline: true }) });
    assert.match(result.text.toLowerCase(), chinese ? /语音|文字|测试|測試/ : /voice|speech|keyboard/);
    assert.ok(result.segments.length > 0);
    await fs.writeFile(path.join(root, chinese ? 'output/engine-result-zh.json' : 'output/engine-result.json'), JSON.stringify(result, null, 2));
    console.log('PASS actual CPU transcription:', result.text);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { service.dispose(); }
})();
