# 验证记录 · 2026-09-12

- 架构已从本地 faster-whisper 完整切换为豆包 Seed-ASR 2.0 云端识别。
- `npm test`：6 项通过，覆盖 Base64 提交、任务轮询、结果归一化、API 错误、取消、格式校验和凭据加密。
- `npm run build`：通过。
- `npm run test:desktop`：通过。真实 Electron 窗口、Windows DPAPI 凭据、虚拟麦克风、PCM WAV、IPC、模拟豆包服务和 React 结果显示全链路成功。
- 真实豆包 API：使用 `volc.seedasr.auc` 和一段 7.721 秒中文 Windows TTS 音频验证成功，服务用时 1.84 秒，返回“你好，这是语音识别测试，我们正在电脑上测试语音转文字功能。”
- 真实调用使用临时测试脚本，脚本位于被 Git 忽略的 `output/`，API Key 未写入任何待提交文件。
- 实体麦克风与真人语音仍需在桌面软件中手动验证。

当前 npm 依赖树仍有来自 Electron 33 / electron-builder 25 的 audit 告警，与上一版本一致。正式发行前应统一升级宿主应用和测试项目的桌面运行时及打包链，再执行回归测试。
