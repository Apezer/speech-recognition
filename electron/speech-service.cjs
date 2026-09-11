const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

function validateSettings(value = {}) {
  const settings = { model: 'base', device: 'cpu', language: 'zh', offline: false, ...value };
  if (!['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo'].includes(settings.model)) throw new Error('不支持的模型');
  if (!['cpu', 'cuda'].includes(settings.device)) throw new Error('不支持的计算设备');
  if (!['auto', 'zh', 'en', 'ja', 'ko', 'fr', 'de', 'es'].includes(settings.language)) throw new Error('不支持的语言');
  if (typeof settings.offline !== 'boolean') throw new Error('离线设置无效');
  return settings;
}

class SpeechService extends EventEmitter {
  constructor({ python, worker, cache, timeout = 30 * 60 * 1000 }) {
    super();
    Object.assign(this, { python, worker, cache, timeout });
    this.child = null;
    this.pending = null;
  }
  start() {
    if (this.child) return;
    const child = spawn(this.python, this.workerArgs || ['-u', this.worker], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    let stderr = '';
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4000); });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      if (this.child !== child) return;
      let data;
      try { data = JSON.parse(line); } catch { return; }
      if (!this.pending || data.id !== this.pending.id) return;
      if (data.event) this.emit('progress', data);
      else this.finish(data.error ? new Error(data.error) : null, data.result);
    });
    child.stdin.on('error', error => { if (this.child === child) this.finish(error); });
    child.on('error', error => {
      if (this.child !== child) return;
      this.child = null;
      this.finish(new Error(`无法启动 Python：${error.message}。请运行 npm run setup:engine。`));
    });
    child.on('close', code => {
      lines.close();
      if (this.child !== child) return;
      this.child = null;
      this.finish(new Error(`识别进程退出 (${code})。${stderr || '请检查 Python 和引擎依赖。'}`));
    });
  }
  request(command, payload = {}) {
    if (this.pending) return Promise.reject(new Error('已有识别任务正在运行'));
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => this.cancel('任务超时，请检查模型下载或改用较小模型'), this.timeout);
      this.pending = { id, resolve, reject, timer };
      try {
        this.start();
        this.child.stdin.write(JSON.stringify({ ...payload, command, id, cache: this.cache }) + '\n');
      } catch (error) { this.finish(error); }
    });
  }
  finish(error, result) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    if (error) pending.reject(error); else pending.resolve(result);
  }
  cancel(message = '任务已取消') {
    const child = this.child;
    this.child = null;
    child?.kill();
    this.finish(new Error(message));
  }
  dispose() { this.cancel('软件已关闭'); }
}
module.exports = { SpeechService, validateSettings };
