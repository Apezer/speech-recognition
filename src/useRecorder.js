import { useEffect, useRef, useState } from 'react';

function encodeWav(chunks, sampleRate, sampleCount) {
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const ascii = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) { view.setInt16(offset, sample, true); offset += 2; }
  return new Uint8Array(buffer);
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const active = useRef(null);

  function release() {
    const state = active.current;
    if (!state) return;
    clearInterval(state.timer);
    state.processor.disconnect(); state.source.disconnect();
    state.stream.getTracks().forEach(track => track.stop());
    state.context.close().catch(() => {});
    active.current = null;
    setRecording(false); setLevel(0);
  }
  useEffect(() => () => release(), []);

  async function start(deviceId, onComplete, onError) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true }, video: false });
    try {
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain(); mute.gain.value = 0;
      const chunks = [];
      let sampleCount = 0;
      let stopped = false;
      const started = Date.now();
      const state = { stream, context, source, processor, timer: null, finish: null };
      active.current = state;
      processor.onaudioprocess = event => {
        if (stopped) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        let peak = 0;
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          peak = Math.max(peak, Math.abs(sample));
        }
        chunks.push(pcm); sampleCount += pcm.length;
        setLevel(Math.min(1, peak * 3));
      };
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      state.finish = async () => {
        if (stopped) return;
        stopped = true;
        const sampleRate = context.sampleRate;
        release();
        try {
          if (!sampleCount) throw new Error('没有录到音频，请检查麦克风');
          await onComplete(encodeWav(chunks, sampleRate, sampleCount));
        } catch (error) { onError(error); }
      };
      state.timer = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setSeconds(Math.floor(elapsed));
        if (elapsed >= 600) state.finish();
      }, 100);
      setSeconds(0); setRecording(true);
    } catch (error) {
      stream.getTracks().forEach(track => track.stop()); release(); throw error;
    }
  }
  function stop() { active.current?.finish?.(); }
  return { recording, seconds, level, start, stop };
}

export { encodeWav };
