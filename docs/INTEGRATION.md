# 集成到 Vico software

本测试项目与 `software` 是同级目录。未来迁移时可复用核心模块，不需要让主软件再启动一个 Electron 应用。

## 迁移步骤

1. 将 `electron/speech-service.cjs` 和 `engine/` 迁入主项目。主进程只创建一个 `SpeechService`，传入 Python 可执行文件、worker 文件与模型缓存目录。
2. 从测试项目 `main.cjs` 提取 `speech:*` handler、`exclusive` 与录音临时文件逻辑，注册到主软件已有窗口。保留主软件托盘、BLE/HID 和原有权限处理；在原权限分支中追加音频权限，不能用测试项目的 main.cjs 覆盖主进程。
3. 将 preload 的白名单方法合入主项目桥接；可以继续暴露 `window.speech`，也可以改为 `window.vico.speech` 并同步更新页面。
4. 将 `App.jsx` 的识别主体提取为 `SpeechPage.jsx`，复用 `useRecorder.js`。沿用宿主 sidebar/header；将样式加 `.speech-page` 前缀，避免全局 `button`、`header` 等选择器影响原有页面。
5. 在主软件真正退出时调用 `service.dispose()`，关闭窗口进入托盘时按产品需要决定是否保留引擎。收到键盘按键事件后调用页面的开始/停止录音操作；录音仍由具有麦克风权限的渲染进程完成。
6. 主项目打包配置增加 engine 资源；确定 Python 运行时分发策略（便携运行时或冻结为可执行 worker）。当前测试版不打包运行时，不能将它视为最终用户发行方案。

## Renderer API

所有 invoke 返回 `{ ok: true, data }` 或 `{ ok: false, error }`。桥接不暴露任意文件路径、通用 IPC 或 shell。

| 方法 | 输入 | 结果 |
| --- | --- | --- |
| `check()` | 无 | Python 与 faster-whisper 版本 |
| `load(settings)` | 模型、语言、设备、离线选项 | 模型就绪信息 |
| `transcribeRecording(bytes, settings)` | `Uint8Array` WebM，最大 100 MB | 识别结果 |
| `transcribeFile(settings)` | 原生对话框选择本地文件 | 识别结果；取消返回 null |
| `cancel()` | 无 | 结束子进程并拒绝当前请求 |
| `onProgress(callback)` | 回调 | 返回移除监听的函数 |
| `copyText(text)` / `saveText(text)` | 用户编辑后的文字 | 复制 / 原生保存对话框 |

```js
const settings = { model: 'base', language: 'zh', device: 'cpu', offline: false };
// 最终结果：elapsed 不包含首次模型下载/加载时间。
const result = {
  text: '你好，Vico。',
  segments: [{ start: 0, end: 2.4, text: '你好，Vico。' }],
  language: 'zh', duration: 3.1, elapsed: 1.2, model: 'base', device: 'cpu'
};
```

## Worker 协议

UTF-8，一行一个 JSON，stdout 仅输出协议，诊断写 stderr。

请求：`{ id, command: 'check' | 'load' | 'transcribe', settings, cache, path? }`。

事件：`{ id, event: 'status', message }` 或 `{ id, event: 'segment', segment }`。

完成：`{ id, result }`；错误：`{ id, error }`。

服务单任务执行，后续如需连续听写，应在录音层加入 VAD 分块、队列、重叠区去重与背压，保留现有单任务识别接口。当前 segment 事件是录音结束后的逐段推理进度，不代表实时流式识别。
