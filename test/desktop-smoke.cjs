const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const errors = [];
// Exercise real MediaRecorder/IPC with a deterministic virtual microphone.
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-file-for-fake-audio-capture', path.join(__dirname, '../output/sample.wav'));
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
});
require('../electron/main.cjs');
const timer = setTimeout(() => { console.error('Desktop smoke test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  try {
    const window = BrowserWindow.getAllWindows()[0];
    if (window.webContents.isLoading()) await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    for (let i = 0; i < 100; i++) {
      const body = await window.webContents.executeJavaScript('document.body.innerText');
      if (body.includes('环境就绪') || body.includes('识别引擎尚未就绪')) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    const result = await window.webContents.executeJavaScript(`({ text: document.body.innerText, node: typeof window.require, bridge: typeof window.speech, overflow: document.documentElement.scrollWidth > innerWidth })`);
    assert.ok(result.text.includes('环境就绪'), result.text);
    assert.equal(result.node, 'undefined');
    assert.equal(result.bridge, 'object');
    assert.equal(result.overflow, false);
    assert.deepEqual(errors, []);
    await fs.mkdir(path.join(__dirname, '../output'), { recursive: true });
    await fs.writeFile(path.join(__dirname, '../output/desktop.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`{
      const select = [...document.querySelectorAll('select')].find(el => [...el.options].some(option => option.value === 'zh'));
      select.value = 'en'; select.dispatchEvent(new Event('change', { bubbles: true }));
    }`);
    await window.webContents.executeJavaScript(`document.querySelector('.primary').click()`);
    await new Promise(resolve => setTimeout(resolve, 8200));
    assert.ok(await window.webContents.executeJavaScript(`document.body.innerText.includes('结束录音并识别')`), 'Recording did not start');
    await window.webContents.executeJavaScript(`document.querySelector('.primary').click()`);
    let text = '';
    for (let i = 0; i < 180; i++) {
      const body = await window.webContents.executeJavaScript('document.body.innerText');
      if (body.includes('识别完成')) { text = await window.webContents.executeJavaScript(`document.querySelector('textarea').value`); break; }
      if (body.includes('操作未完成')) throw new Error(body);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.match(text.toLowerCase(), /voice|speech|keyboard/);
    await fs.writeFile(path.join(__dirname, '../output/desktop-result.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`localStorage.removeItem('vico-speech-settings')`);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop, permissions, virtual microphone → MediaRecorder → IPC → Whisper → result, renderer isolation.');
    clearTimeout(timer);
    app.quit();
  } catch (error) { console.error(error); clearTimeout(timer); app.exit(1); }
});
