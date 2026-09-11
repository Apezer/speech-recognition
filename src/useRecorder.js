import { useEffect, useRef, useState } from 'react';

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const active = useRef(null);
  const release = () => {
    const state = active.current;
    if (!state) return;
    clearInterval(state.timer);
    state.stream.getTracks().forEach(track => track.stop());
    state.context?.close().catch(() => {});
    active.current = null;
    setRecording(false);
    setLevel(0);
  };
  useEffect(() => () => {
    const state = active.current;
    if (state) { state.recorder.onstop = null; if (state.recorder.state !== 'inactive') state.recorder.stop(); release(); }
  }, []);

  async function start(deviceId, onComplete, onError) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true }, video: false });
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('当前运行环境不支持 WebM 录音，请使用桌面应用');
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const started = Date.now();
      let failed = false;
      const state = { recorder, stream, context, timer: null };
      active.current = state;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => { failed = true; release(); onError(event.error || new Error('录音失败')); };
      recorder.onstop = async () => {
        release();
        if (failed) return;
        try {
          const blob = new Blob(chunks, { type: mimeType });
          if (!blob.size) throw new Error('没有录到音频，请检查麦克风');
          await onComplete(new Uint8Array(await blob.arrayBuffer()));
        } catch (error) { onError(error); }
      };
      recorder.start(250);
      setSeconds(0);
      setRecording(true);
      state.timer = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setSeconds(Math.floor(elapsed));
        analyser.getByteTimeDomainData(samples);
        setLevel(Math.min(1, Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length) * 5));
        if (elapsed >= 600 && recorder.state === 'recording') recorder.stop();
      }, 100);
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      release();
      throw error;
    }
  }
  function stop() { if (active.current?.recorder.state === 'recording') active.current.recorder.stop(); }
  return { recording, seconds, level, start, stop };
}
