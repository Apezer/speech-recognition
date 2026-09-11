import React, { useEffect, useState } from 'react';
import { AudioLines, Mic, Square, Upload, Copy, Download, Check, Cloud, ChevronRight, LoaderCircle, FlaskConical, Radio, X, RefreshCw, KeyRound, Trash2 } from 'lucide-react';
import { useRecorder } from './useRecorder';

const defaults = { enableDdc: true, enablePunc: true, enableItn: true, enableSpeakerInfo: false, enableChannelSplit: false };
const time = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
async function unwrap(promise) {
  const response = await promise;
  if (!response?.ok) throw new Error(response?.error || '请通过 Electron 桌面应用运行');
  return response.data;
}
function readSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('vico-speech-settings') || '{}') }; } catch { return defaults; }
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('检查识别环境…');
  const [error, setError] = useState('');
  const [cloud, setCloud] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [text, setText] = useState('');
  const [segments, setSegments] = useState([]);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const recorder = useRecorder();
  const locked = busy || recorder.recording || starting;
  useEffect(() => { try { localStorage.setItem('vico-speech-settings', JSON.stringify(settings)); } catch {} }, [settings]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); } }, [notice]);
  async function refreshDevices() {
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput')); }
    catch (error) { setError(`无法读取麦克风：${error.message}`); }
  }
  async function check() {
    if (!window.speech) { setError('请使用 npm run dev 或 start.cmd 打开桌面应用。'); setStatus('需要桌面环境'); return; }
    setBusy(true); setError('');
    try {
      const value = await unwrap(window.speech.check()); setCloud(value);
      setStatus(value.configured ? '豆包云端已配置，可以开始录音' : '请先保存豆包 API Key');
    } catch (error) { setCloud(null); setError(error.message); setStatus('云端配置检测失败'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    check(); refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
    const off = window.speech?.onProgress(event => {
      if (event.event === 'status') setStatus(event.message);
    });
    return () => { off?.(); navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices); };
  }, []);

  async function transcribe(operation) {
    const previous = { text, segments, result };
    setBusy(true); setError(''); setNotice('');
    setText(''); setSegments([]); setResult(null); setStatus('正在准备音频…');
    try {
      const value = await unwrap(operation());
      if (value === null) { setText(previous.text); setSegments(previous.segments); setResult(previous.result); setStatus('已取消选择'); return; }
      setResult(value); setText(value.text); setSegments(value.segments);
      setStatus(value.text ? '识别完成' : '未检测到有效语音，请检查音频或麦克风');
    } catch (error) { setError(error.message); setStatus('任务已停止'); }
    finally { setBusy(false); }
  }
  async function start() {
    setStarting(true); setError('');
    try {
      await recorder.start(deviceId, bytes => transcribe(() => window.speech.transcribeRecording(bytes, settings)), error => { setBusy(false); setError(error.message); setStatus('录音失败'); });
      setStatus('正在录音，结束后开始识别'); refreshDevices();
    } catch (error) { setError(`无法录音：${error.message}。请检查 Windows 麦克风隐私权限和输入设备。`); }
    finally { setStarting(false); }
  }
  async function exportText(copy) {
    try {
      const value = await unwrap(copy ? window.speech.copyText(text) : window.speech.saveText(text));
      if (copy || value) setNotice(copy ? '已复制到剪贴板' : '文本已保存');
    } catch (error) { setError(error.message); }
  }
  async function saveApiKey() {
    setBusy(true); setError('');
    try {
      const value = await unwrap(window.speech.saveCredential(apiKey));
      setCloud(current => ({ ...current, ...value })); setApiKey(''); setStatus('豆包云端已配置，可以开始录音'); setNotice('API Key 已安全保存');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function clearApiKey() {
    setBusy(true); setError('');
    try { const value = await unwrap(window.speech.clearCredential()); setCloud(current => ({ ...current, ...value })); setStatus('请先保存豆包 API Key'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const set = (key, value) => { setSettings(current => ({ ...current, [key]: value })); };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">V</div><div><b>VICO<span>LAB</span></b><small>DESKTOP COMPANION</small></div></div>
      <div className="nav-label">实验工作台</div>
      <div className="nav-active"><AudioLines size={18}/>语音转文字<ChevronRight size={15}/></div>
      <div className="sidebar-note"><FlaskConical size={18}/><b>独立测试环境</b><p>在电脑端验证语音识别体验，为 Vico 键盘集成做准备。</p></div>
      <div className="sidebar-bottom"><span className="dot"/>豆包云端识别<small>SEED-ASR 2.0 / 0.2.0</small></div>
    </aside>
    <main>
      <header><span>Vico Lab <ChevronRight size={12}/> 语音实验室</span><div className="badge"><FlaskConical size={13}/> TEST BUILD</div></header>
      <div className="content">
        <div className="heading"><div><div className="eyebrow">VOICE TO TEXT</div><h1>让声音，变成文字。</h1><p>录下想法，或导入一段音频，由豆包 Seed-ASR 2.0 完成识别。</p></div><span className="local-tag"><Cloud size={14}/> 云端 API</span></div>
        <div className="workspace">
          <section className="record-panel panel">
            <div className="panel-title"><h2><Mic size={17}/>音频输入</h2><span>01</span></div>
            <label className="field">麦克风<select value={deviceId} disabled={locked} onChange={event => setDeviceId(event.target.value)}><option value="">系统默认麦克风</option>{devices.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `麦克风 ${index + 1}`}</option>)}</select></label>
            <div className={`capture ${recorder.recording ? 'recording' : ''}`}>
              <div className="mic-orbit"><Mic size={30}/></div>
              <div className="timer">{time(recorder.seconds)}</div>
              <div className="wave" aria-label={`麦克风音量 ${Math.round(recorder.level * 100)}%`}>{Array.from({ length: 35 }, (_, i) => <i key={i} style={{ height: `${5 + recorder.level * (12 + (Math.sin(i * 1.7) + 1) * 22)}px` }}/>)}</div>
              <small>{recorder.recording ? '正在聆听 · 最长 10 分钟' : '准备好时，开始说话'}</small>
            </div>
            <button className={`primary ${recorder.recording ? 'stop' : ''}`} disabled={!cloud?.configured || busy || starting} onClick={recorder.recording ? recorder.stop : start}>{recorder.recording ? <Square size={16}/> : <Mic size={16}/>} {recorder.recording ? '结束录音并识别' : starting ? '正在打开麦克风…' : '开始录音'}</button>
            <div className="separator"><span/>或者<span/></div>
            <button className="import" disabled={locked || !cloud?.configured} onClick={() => transcribe(() => window.speech.transcribeFile(settings))}><Upload size={18}/><b>导入音频文件</b><small>WAV / MP3 / M4A / FLAC / OGG 等</small></button>
          </section>
          <section className="result-panel panel">
            <div className="panel-title"><h2><AudioLines size={18}/>识别结果</h2><span>02</span></div>
            <div className="result-status"><span className={`dot ${busy ? 'working' : ''}`}/><span role="status">{status}</span>{busy && <LoaderCircle className="spin" size={14}/>}</div>
            <textarea aria-label="识别文字" spellCheck={false} value={text} disabled={busy} onChange={event => setText(event.target.value)} placeholder={'你的文字将在这里出现\n\n录音结束后开始识别，也可以导入已有音频。\n识别完成后，可以直接编辑和复制文本。'}/>
            {result && <div className="metrics"><span>音频 <b>{time(result.duration)}</b></span><span>识别 <b>{result.elapsed}s</b></span><span>语言 <b>{result.language.toUpperCase()}</b></span><span>模型 <b>{result.model}</b></span></div>}
            <div className="result-footer"><span>{text.length} 字符 {notice && <em><Check size={13}/>{notice}</em>}</span><div><button title="复制文本" disabled={!text || busy} onClick={() => exportText(true)}><Copy size={14}/>复制</button><button disabled={!text || busy} onClick={() => exportText(false)}><Download size={14}/>导出 TXT</button></div></div>
          </section>
        </div>
        <section className="panel settings">
          <div className="panel-title"><h2><Cloud size={17}/>豆包云端设置</h2><span>volc.seedasr.auc</span></div>
          <div className="credential-row">
            <label className="field">API Key<input type="password" autoComplete="off" value={apiKey} disabled={locked} onChange={event => setApiKey(event.target.value)} placeholder={cloud?.configured ? cloud.masked : '粘贴火山引擎 API Key'}/></label>
            <button className="load" disabled={locked || !apiKey.trim()} onClick={saveApiKey}><KeyRound size={15}/>保存密钥</button>
            {cloud?.configured && <button className="load danger" disabled={locked} onClick={clearApiKey}><Trash2 size={15}/>删除</button>}
          </div>
          <div className="option-grid">
            <label><input type="checkbox" disabled={locked} checked={settings.enableDdc} onChange={event => set('enableDdc', event.target.checked)}/>语义顺滑</label>
            <label><input type="checkbox" disabled={locked} checked={settings.enablePunc} onChange={event => set('enablePunc', event.target.checked)}/>自动标点</label>
            <label><input type="checkbox" disabled={locked} checked={settings.enableItn} onChange={event => set('enableItn', event.target.checked)}/>数字规整</label>
            <label><input type="checkbox" disabled={locked} checked={settings.enableSpeakerInfo} onChange={event => set('enableSpeakerInfo', event.target.checked)}/>说话人信息</label>
            <label><input type="checkbox" disabled={locked} checked={settings.enableChannelSplit} onChange={event => set('enableChannelSplit', event.target.checked)}/>多声道分离</label>
          </div>
          <div className="settings-bottom"><span>{cloud?.configured ? `已保存：${cloud.masked}` : 'API Key 尚未配置'}</span><span>录音会上传至火山引擎，并按服务用量计费</span></div>
        </section>
        {error && <div className="error" role="alert"><div><b>操作未完成</b><p>{error}</p></div><button disabled={locked} onClick={check}><RefreshCw size={14}/>重新检测</button></div>}
        {busy && <button className="cancel" onClick={async () => { try { await unwrap(window.speech.cancel()); } catch (error) { setError(error.message); } }}><X size={14}/>取消当前任务</button>}
        {segments.length > 0 && <details className="segments"><summary>查看原始分段与时间戳 · {segments.length} 段</summary>{segments.map((segment, index) => <div key={index}><time>{time(segment.start)} — {time(segment.end)}</time><span>{segment.text}</span></div>)}</details>}
        <footer><Radio size={13}/> 音频上传豆包云端识别；本机临时录音在任务结束后清理。<span>VICO / VOICE LAB</span></footer>
      </div>
    </main>
  </div>;
}
