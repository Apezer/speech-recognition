# 本机验证记录 · 2026-09-10

- 环境：Windows、Node.js 24.12.0、Python 3.13.5、Electron 33.4.11、faster-whisper 1.2.1、CPU INT8。
- `npm run build`：通过。
- `npm test`：7 项通过，覆盖协议、并发、取消、超时、进程退出与重启。
- `npm run test:desktop`：通过。真实 Electron 窗口、受限 preload、麦克风权限、虚拟麦克风、MediaRecorder WebM、IPC、Python 推理和 React 分段显示全链路成功；无渲染错误或横向溢出。
- 英文 Windows TTS 样本：7.11 秒，识别耗时 1.24 秒（不含模型加载），两句话正确识别。
- 中文 Windows TTS 样本：7.72 秒，识别耗时 1.16 秒，Base 模型将“识别”识别为“时别”，其他主要文本正确。这只验证链路，不代表真实场景准确率。
- Base 模型已缓存；中文测试在 `offline: true` 下成功。
- 实体麦克风、人声、GPU、NSIS 安装包尚未验证。

桌面截图和识别 JSON 在 `output/`。测试录音为 Windows 本机合成，未录制用户实际麦克风。

## 依赖与发行限制

为便于与现有主项目整合，当前保留其 Electron 33 / electron-builder 25 主版本。`npm audit` 报告 14 项依赖问题（13 high、1 critical），涉及 Electron 和打包工具依赖树，原始报告在 `output/npm-audit.json`。正式发行前需要统一升级宿主与测试软件的 Electron / 打包链，并重新验证；本次未擅自升级主软件。安装包不包含 Python 运行时与模型，详见 README。

本机 npm 的 Electron 下载长时间未完成，因此复制了主项目已安装且版本一致的 Electron 33.4.11 运行时到测试项目自己的 node_modules；依赖目录独立，无符号链接，不依赖主项目路径启动。
