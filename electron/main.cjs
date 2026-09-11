const { app, BrowserWindow, ipcMain, dialog, clipboard, session } = require('electron');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { SpeechService, validateSettings } = require('./speech-service.cjs');

app.setName('Vico Whisper Test');
// Isolate settings/models from the future host application.
app.setPath('userData', path.join(app.getPath('appData'), 'vico-whisper-test'));
let window;
let service;
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

app.whenReady().then(() => {
  const root = path.join(__dirname, '..');
  const localPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  service = new SpeechService({
    python: process.env.VICO_WHISPER_PYTHON || (existsSync(localPython) ? localPython : 'python'),
    worker: path.join(app.isPackaged ? process.resourcesPath : root, 'engine/worker.py'),
    cache: path.join(app.getPath('userData'), 'models')
  });
  service.on('progress', value => { if (window && !window.isDestroyed()) window.webContents.send('speech:progress', value); });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === window?.webContents && trusted(contents.getURL()) && permission === 'media' && details.mediaTypes?.every(type => type === 'audio')));
  session.defaultSession.setPermissionCheckHandler((contents, permission) => contents === window?.webContents && trusted(contents.getURL()) && permission === 'media');
  handle('speech:check', () => exclusive(() => service.request('check')));
  handle('speech:load', settings => exclusive(() => service.request('load', { settings: validateSettings(settings) })));
  handle('speech:recording', (bytes, options) => exclusive(async () => {
    const settings = validateSettings(options);
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 100 * 1024 * 1024) throw new Error('录音为空或超过 100 MB');
    const dir = await fs.mkdtemp(path.join(app.getPath('temp'), 'vico-whisper-'));
    const audioPath = path.join(dir, 'recording.webm');
    try {
      await fs.writeFile(audioPath, bytes);
      return await service.request('transcribe', { path: audioPath, settings });
    } finally { await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  }));
  handle('speech:file', options => exclusive(async () => {
    const settings = validateSettings(options);
    const result = await dialog.showOpenDialog(window, { title: '选择需要识别的音频', properties: ['openFile'], filters: [{ name: '音频', extensions: ['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac', 'mp4'] }] });
    if (result.canceled) return null;
    const audioPath = result.filePaths[0];
    if ((await fs.stat(audioPath)).size > 500 * 1024 * 1024) throw new Error('音频文件不能超过 500 MB');
    return { ...await service.request('transcribe', { path: audioPath, settings }), source: path.basename(audioPath) };
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
  window = new BrowserWindow({ width: 1240, height: 880, minWidth: 940, minHeight: 700, backgroundColor: '#090b0f', autoHideMenuBar: true, title: 'Vico · 语音实验室', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('render-process-gone', () => service.cancel());
  window.on('closed', () => { service.dispose(); window = null; });
  window.loadURL(dev ? 'http://127.0.0.1:5183/' : page);
});
app.on('before-quit', () => service?.dispose());
app.on('window-all-closed', () => app.quit());
