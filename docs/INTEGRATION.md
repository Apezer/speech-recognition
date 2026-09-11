# 集成到 Vico Keyboard software

本版本只使用豆包云端识别，没有 Python、本地模型或本地推理进程。

## 可复用模块

- `electron/doubao-service.cjs`：云端 Provider，实现 Base64 上传、submit/query 轮询、取消、超时、错误信息和统一结果格式。
- `electron/credential-store.cjs`：通过 Electron `safeStorage` 使用 Windows DPAPI 加密 API Key。
- `src/useRecorder.js`：把麦克风直接录制为单声道 PCM WAV，避免 WebM 与豆包支持格式不一致。
- `src/App.jsx`：设置、录音、状态与结果交互参考。

## 迁移步骤

1. 将两个 Electron 服务模块复制到主软件，通过主进程创建单例 `DoubaoService` 和 `CredentialStore`。
2. 将 `speech:*` IPC handlers 合并进主进程。不要覆盖主软件已有窗口、托盘、BLE/HID 或权限逻辑。
3. 将 preload 中的 `window.speech` 方法并入主软件，可继续独立命名，也可放到 `window.vico.speech`。
4. 将识别区域提取成 `SpeechPage.jsx`，复用录音 hook。迁移样式时增加页面作用域，避免全局选择器影响其他页面。
5. 主软件真正退出或用户取消时调用 `service.cancel()`。进入托盘时可以保留正在进行的云端任务。
6. 如果由键盘按键触发录音，硬件事件只负责通知 renderer 开始或结束；麦克风权限和 PCM 采集仍在 Electron renderer 完成。

## Renderer API

所有 invoke 返回 `{ ok: true, data }` 或 `{ ok: false, error }`。

| 方法 | 用途 |
| --- | --- |
| `check()` | 返回 Provider、资源 ID 和密钥配置状态，不返回明文密钥 |
| `saveCredential(key)` | 加密保存 API Key |
| `clearCredential()` | 删除本机 API Key |
| `transcribeRecording(bytes, options)` | 上传 PCM WAV 录音并识别 |
| `transcribeFile(options)` | 原生文件对话框选择并识别 |
| `cancel()` | 取消 HTTP 请求和轮询 |
| `onProgress(callback)` | 接收上传、排队和识别状态 |
| `copyText(text)` / `saveText(text)` | 复制或导出编辑后的结果 |

统一结果格式：

```js
{
  text: '你好，Vico。',
  segments: [{ start: 0, end: 2.4, text: '你好，Vico。', speaker: null }],
  language: 'auto', duration: 3.1, elapsed: 2.2,
  model: 'Doubao Seed-ASR 2.0', provider: 'doubao'
}
```

以后增加其他厂商时，为每个厂商建立独立 Provider，并保持 `transcribe()`、`cancel()` 和结果结构一致。API Key 按厂商分别存进 `safeStorage`，不要提交到 Git，也不要直接打包进安装程序。
