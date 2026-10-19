# 开发说明

## 源码结构

- `windows/`：启动器、官方进程/签名/端口校验、事务安装与卸载。
- `extension/`：CDP 客户端、打包素材白名单、载荷与可撤销注入。
- `runtime/`：开屏、就绪检测、主题、桌宠状态与设置。
- `assets/whale/`：实际使用的背景、视频、图标、元数据与许可。
- `tests/`：Node 原生测试；`tools/`：构建、安装器测试与隔离浏览器回归。

## 常用命令

```powershell
npm test
npm run build
npm run package
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-release.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/test-installer.ps1 -InProcess
powershell -NoProfile -ExecutionPolicy Bypass -File tools/test-installer-integration.ps1 -Installer release/WhaleTheme-Setup-3.3.1.exe -InProcess
```

`-InProcess` 使用 Windows PowerShell 5.1 加载测试程序集，绕过部分环境直接启动测试 EXE 的 CLR 故障。安装器测试使用临时目录、模拟桌面和专用测试注册表，不更改真实 Codex。

## 可选浏览器回归

需安装 Edge 和 Playwright。Playwright 只用于开发测试，不进入用户安装包：

```powershell
npm install --no-save playwright
node tools/browser-qa.mjs
node tools/upgrade-qa.mjs
node tools/style-qa.mjs
node tools/fixes-qa.mjs
node tools/home33-qa.mjs
node tools/projects-qa.mjs
```

已有独立 Playwright 安装时，可把 `WHALE_PLAYWRIGHT` 设为其绝对模块目录。所有脚本共用 `127.0.0.1:4173`，请依次运行。它们使用模拟原生结构及真实打包素材，不连接真实 Codex。

## 版本与发布

版本号在 `project.json`、`package.json`、`windows/InstallCore.cs` 与 `tools/build-release.ps1` 中保持一致。构建后运行安装器测试与 `verify-release.ps1`，再将安装包、便携包、`SHA256SUMS.txt`、`release-manifest.json` 附到对应 GitHub Release。

Git 仅保存源码、必要素材、文档与测试；`.build/`、`.qa/`、`dist/`、`release/` 和 `node_modules/` 均被忽略。不要将生成的安装包放入 Git 历史。
