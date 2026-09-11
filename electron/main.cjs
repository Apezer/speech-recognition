const { app, BrowserWindow, ipcMain, dialog, clipboard, session, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DoubaoService, FORMAT_BY_EXTENSION } = require('./doubao-service.cjs');
const { CredentialStore } = require('./credential-store.cjs');

app.setName('Vico Speech Recognition');
app.setPath('userData', path.join(app.getPath('appData'), 'vico-speech-recognition'));
let window;
let service;
let credentials;
let busy = false;
const dev = !app.isPackaged && process.argv.includes('--dev');
const page = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
const trusted = url => dev ? url.startsWith('http://127.0.0.1:5183/') : url === page;

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || !trusted(event.senderFrame.url)) throw new Error('不允许的请求来源');
      return { ok: true, data: await fn(...args) };
    } catch (error) { return { ok: false, error: error.message }; }
  });
}
async function exclusive(fn) {
  if (busy) throw new Error('已有任务正在运行');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}
function validateOptions(value = {}) {
  return {
    enableDdc: value.enableDdc !== false,
    enablePunc: value.enablePunc !== false,
    enableItn: value.enableItn !== false,
    enableSpeakerInfo: Boolean(value.enableSpeakerInfo),
    enableChannelSplit: Boolean(value.enableChannelSplit)
  };
}
async function transcribePath(audioPath, options) {
  const key = credentials.get();
  if (!key) throw new Error('请先在识别设置中保存豆包 API Key');
  return service.transcribe(audioPath, key, validateOptions(options));
}

app.whenReady().then(() => {
  const testFetch = process.env.VICO_TEST_FAKE_DOUBAO === '1' ? async url => {
    const headers = { 'X-Api-Status-Code': '20000000', 'X-Api-Message': 'OK', 'X-Tt-Logid': 'test-log-id' };
    const body = url.endsWith('/query') ? JSON.stringify({ audio_info: { duration: 7100 }, result: { text: 'Hello, this is a cloud speech recognition test.', utterances: [{ start_time: 0, end_time: 7100, text: 'Hello, this is a cloud speech recognition test.' }] } }) : '{}';
    return new Response(body, { status: 200, headers });
  } : undefined;
  service = new DoubaoService({ fetchImpl: testFetch, pollInterval: testFetch ? 10 : 1000 });
  service.onProgress = value => { if (window && !window.isDestroyed()) window.webContents.send('speech:progress', value); };
  credentials = new CredentialStore(path.join(app.getPath('userData'), 'doubao-api-key.bin'), safeStorage);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === window?.webContents && trusted(contents.getURL()) && permission === 'media' && details.mediaTypes?.every(type => type === 'audio')));
  session.defaultSession.setPermissionCheckHandler((contents, permission) => contents === window?.webContents && trusted(contents.getURL()) && permission === 'media');

  handle('speech:check', () => ({ provider: 'doubao', resource: 'volc.seedasr.auc', ...credentials.info() }));
  handle('speech:credential:save', key => credentials.save(key));
  handle('speech:credential:clear', () => credentials.clear());
  handle('speech:recording', (bytes, options) => exclusive(async () => {
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 100 * 1024 * 1024) throw new Error('录音为空或超过 100 MB');
    const dir = await fs.mkdtemp(path.join(app.getPath('temp'), 'vico-doubao-'));
    const audioPath = path.join(dir, 'recording.wav');
    try {
      await fs.writeFile(audioPath, bytes);
      return await transcribePath(audioPath, options);
    } finally { await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  }));
  handle('speech:file', options => exclusive(async () => {
    const extensions = [...FORMAT_BY_EXTENSION.keys()].map(value => value.slice(1));
    const result = await dialog.showOpenDialog(window, { title: '选择需要识别的音频', properties: ['openFile'], filters: [{ name: '音频', extensions }] });
    if (result.canceled) return null;
    const audioPath = result.filePaths[0];
    return { ...await transcribePath(audioPath, options), source: path.basename(audioPath) };
  }));
  handle('speech:cancel', () => service.cancel());
  handle('speech:copy', text => { if (typeof text !== 'string' || text.length > 5e6) throw new Error('文本无效'); clipboard.writeText(text); });
  handle('speech:save', async text => {
    if (typeof text !== 'string' || text.length > 5e6) throw new Error('文本无效');
    const result = await dialog.showSaveDialog(window, { defaultPath: '语音识别.txt', filters: [{ name: '文本', extensions: ['txt'] }] });
    if (result.canceled) return null;
    await fs.writeFile(result.filePath, '\ufeff' + text, 'utf8');
    return result.filePath;
  });

  window = new BrowserWindow({ width: 1240, height: 880, minWidth: 940, minHeight: 700, backgroundColor: '#090b0f', autoHideMenuBar: true, title: 'Vico · 豆包语音识别', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('render-process-gone', () => service.cancel());
  window.on('closed', () => { service.cancel(); window = null; });
  window.loadURL(dev ? 'http://127.0.0.1:5183/' : page);
});
app.on('before-quit', () => service?.cancel());
app.on('window-all-closed', () => app.quit());
