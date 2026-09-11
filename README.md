# Vico Whisper Test · 电脑端语音转文字

独立实验项目，参考 `../software` 的 **Electron 33 + React 18 + Vite 6 + CommonJS 主进程 / preload + electron-builder** 架构。界面沿用深色与荧光绿视觉体系。音频识别采用独立的本地 faster-whisper 进程，无需 API Key。

## 启动

Windows 10/11，Node.js 20+，Python 3.10+（本机开发验证使用 Python 3.13）。

```powershell
cd D:\Project\Vico_Keyboard\whisper_software_test
npm install
npm run setup:engine
npm run dev
```

完成依赖安装后，也可以双击 `start.cmd`，或执行 `npm run build` 后 `npm start`。开发服务器独占 5183 端口，不与主软件的 5173 冲突。浏览器预览没有 Electron IPC，因此请在桌面窗口测试识别。

1. 页面自动检测 Python 和 faster-whisper 环境。
2. 默认 Base / 中文 / CPU INT8。点击“加载 / 下载模型”提前准备模型，也可直接开始录音。
3. 首次模型加载从 Hugging Face 下载；耗时受网络影响，音频不会上传。下载失败可检查代理后重试，或设置 `HF_ENDPOINT` 指向自己信任的兼容镜像。
4. 选择麦克风，点击“开始录音”，说话后点击“结束录音并识别”。界面显示实际输入音量。单次录音最长 10 分钟，届时自动结束并识别。
5. 也可导入 WAV、MP3、M4A、FLAC、OGG、WEBM 或 MP4，单文件上限 500 MB。
6. 识别过程中逐段显示结果；完成后可编辑、复制、导出 UTF-8 TXT、查看原始时间戳。编辑文字不会改写原始分段记录。

**当前是录完后识别，不是边说边出的流式听写。** 未实现系统全局快捷键、自动向其他软件输入文字、键盘硬件联动。

## 本地引擎

- 依赖安装在本项目 `.venv`，不改变系统 Python 包。
- 引擎与模型常驻子进程，连续识别不必反复加载同一模型。
- 模型保存在 `%APPDATA%\vico-whisper-test\models`。已完整下载后可勾选“仅使用已缓存模型”。
- 仅模型和识别设置持久化；识别文字不自动保存。关闭窗口前请复制或导出。
- 录音只写入系统临时目录，任务成功、失败或取消后清理；强制结束操作系统进程时可能残留临时文件。
- CPU 默认采用 INT8；NVIDIA GPU 选项使用 float16，需要与 CTranslate2 版本兼容的 CUDA/cuDNN，配置失败会显示错误，可切回 CPU。
- 中文识别结果可能包含繁体字，本版本保留模型原始输出。
- “取消当前任务”会结束 Python 子进程，下次任务自动重启并重新加载模型。单任务超时为 30 分钟，包含首次下载时间。
- 如果使用其他 Python：启动前设置 `$env:VICO_WHISPER_PYTHON = 'C:\path\to\python.exe'`，并确保该解释器安装了 `engine/requirements.txt`。

实现依据：[faster-whisper 官方文档](https://github.com/SYSTRAN/faster-whisper)。faster-whisper 使用 PyAV 解码，无需单独安装 ffmpeg 命令行程序。

## 目录与集成边界

```text
electron/main.cjs            窗口、权限、文件选择、临时文件与 IPC 注册
electron/preload.cjs         window.speech 白名单桥接
electron/speech-service.cjs  独立服务：子进程、JSONL、取消、超时、进度
engine/worker.py             模型加载、VAD、转写、分段结果
engine/requirements.txt      引擎依赖
src/App.jsx                 可迁移的识别页面
src/useRecorder.js          浏览器麦克风录音与音量检测
src/styles.css              测试软件样式
test/                       服务和 Electron 桌面验证
docs/INTEGRATION.md          迁入 software 的步骤与协议
```

```text
React / MediaRecorder
  → preload（speech:* IPC）
  → Electron SpeechService
  → Python stdin/stdout JSONL
  → faster-whisper / CTranslate2
  → segment 事件 + 最终结果 → React
```

没有网络监听端口、云端 API 或额外 HTTP 服务。Electron 主进程通过参数列表启动 Python，不拼接 shell 命令；页面禁用 Node，开启 sandbox 和 contextIsolation，音频文件路径由原生文件对话框提供。

## 验证与打包

```powershell
npm test
npm run build
npm run test:engine
npm run test:desktop
npm run dist
```

服务测试覆盖 Unicode、进度、子进程复用、并发拒绝、取消重启、超时、崩溃与缺失解释器。引擎与桌面测试需要先安装引擎、缓存 Base 模型并构建页面，使用 Windows 内置英文语音生成测试音频。桌面测试通过 Chromium 虚拟麦克风验证录音到结果的完整链路，不采集真实麦克风；截图写到 `output/desktop.png` 与 `output/desktop-result.png`。真实麦克风设备和人声准确率仍需手动测试。

`release` 下可生成 NSIS 安装包。**当前安装包只包含 Electron 应用和 Python 源码，不包含 Python 运行时、模型或 CUDA**。安装到其他电脑时，仍需安装 Python 与引擎依赖，并设置 `VICO_WHISPER_PYTHON`。这是便于测试和集成的开发版本，尚不是无需环境配置的完整离线发行包。

## 常见问题

- 麦克风无法打开：Windows 设置 → 隐私和安全性 → 麦克风，允许桌面应用访问，并确认输入设备未被独占。
- 无有效文字：查看录音时音量条是否变化，确认语言和输入设备，尝试有清晰人声的音频文件。
- 缺少模块：重新运行 `npm run setup:engine`，然后点击“重新检测”。
- 模型加载失败：首次下载不要启用“仅使用已缓存模型”；确认 Hugging Face 可访问。网络受限时先解决下载再测试。
- CPU 识别慢：先选 Tiny / Base 测试完整链路，再评估 Small 或 GPU。
