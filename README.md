# Vico Speech Recognition · 豆包云端语音转文字

Windows 桌面语音识别实验项目，参考 Vico Keyboard 主软件的 Electron + React + Vite 架构。录音或导入音频后，调用火山引擎豆包录音文件识别模型 2.0（Seed-ASR 2.0）完成转写。

本版本是纯云端方案，不下载或运行本地 Whisper 模型，也不需要 Python。

## 启动

需要 Windows 10/11、Node.js 20+ 和可以访问火山引擎的网络。

```powershell
git clone git@github.com:Apezer/speech-recognition.git
cd speech-recognition
npm install
npm run dev
```

也可以完成依赖安装后双击 `start.cmd`。

## 配置 API Key

1. 在火山引擎控制台开通“豆包录音文件识别模型 2.0 标准版”。
2. 在软件底部的“豆包云端设置”中粘贴新版控制台提供的 API Key。
3. 点击“保存密钥”。密钥使用 Electron `safeStorage` 调用 Windows DPAPI 加密，保存到：

```text
%APPDATA%\vico-speech-recognition\doubao-api-key.bin
```

密钥不会进入 localStorage、日志、识别结果或 Git 仓库。更换或撤销密钥可点击“删除”。不要将 API Key 写进源码、README、Issue 或提交记录。

## 使用

- 选择麦克风并开始录音，结束后软件生成单声道 PCM WAV，并将 Base64 音频提交给豆包。
- 支持导入 WAV、MP3、OGG、OPUS、M4A、AAC、MP4 和 FLAC，直接上传上限为 100 MB。
- 提交后软件轮询任务状态，完成后显示整段文字、时间戳和识别耗时。
- 支持语义顺滑、自动标点、数字规整、说话人信息和多声道分离。
- 结果可以编辑、复制或导出 UTF-8 TXT。
- 单次录音最长 10 分钟。音频上传到火山引擎处理，本机临时 WAV 在任务成功、失败或取消后删除。

API 使用以下固定地址和资源：

```text
POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
X-Api-Resource-Id: volc.seedasr.auc
```

接口依据：[豆包录音文件识别模型 2.0 官方文档](https://docs.volcengine.com/docs/6561/2606791?lang=zh)。调用会消耗火山引擎额度并可能产生费用，请在控制台查看用量和计费。

## 项目结构

```text
electron/main.cjs             Electron 窗口、IPC、文件与安全存储
electron/doubao-service.cjs   豆包 submit/query、轮询、取消与结果归一化
electron/credential-store.cjs Windows DPAPI 密钥存储
electron/preload.cjs          受限的 renderer API
src/App.jsx                   录音、设置与结果界面
src/useRecorder.js            麦克风 PCM WAV 录制
test/                         云端协议、凭据与桌面链路测试
docs/INTEGRATION.md            合并到 Vico Keyboard 的说明
```

## 验证

```powershell
npm test
npm run build
npm run test:desktop
```

单元测试使用模拟 HTTP 响应，不消耗豆包额度。桌面测试使用 Windows 合成音频、虚拟麦克风和模拟云端响应，验证“麦克风 → PCM WAV → IPC → Provider → UI”的完整链路，也不会上传测试音频。

正式使用前请用自己的 API Key 和真实人声完成一次手动测试。API 错误提示会包含豆包状态码和 LogID，便于在火山引擎侧排查，但不会输出密钥。
