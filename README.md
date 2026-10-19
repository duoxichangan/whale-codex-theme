<div align="center">
  <img src="assets/whale/icons/whale.svg" width="72" height="72" alt="鲸鱼">
  <h1>whale-codex-theme</h1>
  <p>鲸鱼工作台 · 一小片海</p>
  <p>给 Windows Codex 添一点海风、动画和桌边陪伴。</p>
  <p><a href="https://github.com/duoxichangan/whale-codex-theme/releases/latest">下载安装包</a> · <a href="https://github.com/duoxichangan/whale-codex-theme/issues">反馈问题</a> · <a href="#感谢与参考项目">感谢与参考项目</a></p>
</div>

## 它能做什么

- **浅蓝与深蓝主题**：跟随原生深浅色设置，保留原生侧栏、输入框与按钮布局，替换鲸鱼 SVG 图形。
- **连续启动体验**：可跳过的开屏 → 至少 1.5 秒、不可跳过的 loading → 页面就绪后淡入；支持开屏声音。
- **五档思考场景**：背景与首页文案随思考强度变化，图片交叉淡入，并尊重“减少动态效果”。
- **海洋首页**：三个独立插画入口；调用原生项目选择器；空间不足时整组收起装饰，给输入区留出位置。
- **桌边伙伴**：右键菜单、改名、拖动、大小调整、喂食与玩乐，以及日常、休息、沉浸模式。
- **窗口内主题调整**：首页右下角图标或 `Ctrl+Alt+B`，调整海景浓度、桌宠和开屏声音。

| 浅色场景 | 深色场景 |
| --- | --- |
| ![浅蓝海洋场景](assets/whale/scenes/preset-whale-girl-extra-high-light/background.webp) | ![深蓝海洋场景](assets/whale/scenes/preset-whale-girl-extra-high-dark/background.webp) |

上图展示随包提供的背景素材。主题只在官方应用本地窗口生效，不修改官方安装包或 `app.asar`，不附带官方应用、账户或聊天记录。本项目与 OpenAI 没有官方关联。

## 安装与使用

**环境：Windows 10/11 x64，已安装 Microsoft Store / MSIX 版官方 Codex。**

1. 前往 [Releases](https://github.com/duoxichangan/whale-codex-theme/releases/latest)，下载 `WhaleTheme-Setup-3.3.1.exe`。
2. 运行安装包。桌面只创建「鲸鱼工作台」快捷方式，悬浮提示为「一小片海」。
3. 保存正在进行的工作，完全退出官方 Codex 后，再从「鲸鱼工作台」启动以加载主题。

也可下载 `WhaleTheme-Portable-3.3.1.zip`，完整解压到一个目录，运行 `CodexStartup.exe`。安装和便携包均复用官方应用附带的 Node 运行时，普通用户无需安装 Node.js。

已有普通官方实例时，启动器只激活该实例，不会强制退出或接管它。未登录时会衔接原生登录/注册界面；应用联网和账户认证仍由官方应用处理。开屏可以按 `Esc` 跳过，后续 loading 必须等到主页面或可操作的登录入口准备好。

发布包目前未签名。可用 Release 中的 `SHA256SUMS.txt` 核对下载文件；本地校验命令为：

```powershell
Get-FileHash .\WhaleTheme-Setup-3.3.1.exe -Algorithm SHA256
```

### 设置、恢复与卸载

- 主题调整仅在首页显示；桌宠右键打开伙伴菜单，沉浸模式的退出图标在首页右下角。
- 源码目录中运行 `npm run restore` 可撤销当前主题；之后从官方入口冷启动可回到普通官方启动方式。
- 安装版可在 Windows「设置 → 应用」中卸载「鲸鱼工作台」。
- 日志在 `%LOCALAPPDATA%\WhaleTheme\launcher.log`。主题偏好与伙伴状态保存在官方页面的本地存储中。

遇到无法加载主题的问题，请附上官方应用版本、主题版本、复现步骤和日志末尾的错误；提交前请自行去掉日志中的个人路径或敏感信息。

## 开发与构建

源码开发需要 Windows、Node.js 22+、Windows PowerShell 5.1 和 .NET Framework C# 编译器。核心项目没有 npm 运行依赖。

```powershell
npm test
npm run preview
npm run build
npm run package
```

`npm run preview` 在 `http://127.0.0.1:4173` 打开隔离模拟页面，不连接真实 Codex。`npm run build` 输出 `dist/WhaleTheme/`；`npm run package` 输出安装包、便携包、清单与 SHA256 到 `release/`。

源码结构、安装器检查和可选 Playwright 回归见 [开发说明](docs/DEVELOPMENT.md)。已覆盖的验证范围与实机限制见 [测试记录](docs/TEST-REPORT.md)。

## 感谢与参考项目

这个项目是在已有社区工作的基础上完成的，感谢作者们公开实现与素材：

- **[lilhuu/Codex-Startup-Windows](https://github.com/lilhuu/Codex-Startup-Windows)**：本项目最主要的技术参考。Windows 启动链路、官方进程与回环端口验证、CDP 外部接入、安装与恢复机制均以该项目为基线。
- **[M1ddle0/codex-startup-animation](https://github.com/M1ddle0/codex-startup-animation)**：参考项目的上游，提供启动动画、临时 iframe 和外部主题接入的实现思路。
- **[panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation)**：启动动画上游参考链的一部分。
- **[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)**：桌宠透明 WebM 动画来源，保留 MIT 许可与文件来源清单。
- **[Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)**：原鲸鱼主题工程的桌面主题参考来源。
- **原鲸鱼主题工程及其贡献者**：沿用背景、开屏、伙伴状态服务与已有海洋视觉设计；首页三张卡片为本项目新增的生成插画。

固定参考版本及具体使用范围见 [来源记录](docs/references.md)。感谢所有提出问题、提供截图并协助实机测试的人。

## 来源与许可

代码、第三方动画与视觉素材按各自的来源和许可分别处理。本仓库不将所有内容统一声明为 MIT；详细说明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)、[原工程许可](assets/whale/ORIGINAL-LICENSE) 和 [桌宠动画许可](assets/whale/pet/dsh/LICENSE)。

字体使用本机字体回退，不捆绑 Claude 字体文件。OpenAI、Codex 等名称与商标归各自权利人所有。官方应用版本更新可能改变页面结构，隔离测试不能保证所有版本均兼容。
