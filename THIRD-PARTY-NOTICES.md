# 来源与授权

技术参考：lilhuu/Codex-Startup-Windows，固定提交 10d986ca532564a7546c32838567eb01e94ef2dd。
https://github.com/lilhuu/Codex-Startup-Windows

Windows MSIX 激活、包与监听身份验证、CDP 客户端、安装事务、快捷方式所有权及回滚实现以该项目为基础；临时 iframe、闭包桥接、Blob 背景与销毁机制参考该项目。鲸鱼版本重写了动画状态机、主页面就绪检测、背景联动、桌宠运行时、按需素材桥接和构建入口。

参考项目继承 [M1ddle0/codex-startup-animation](https://github.com/M1ddle0/codex-startup-animation)（52bf7c7377663c42aad0730ab4868a48c1e1d2be），其参考链包括 [panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation)。参考项目声明所读取上游提交未附明确 LICENSE。本工程保留来源，不将参考代码重新标记为 MIT。旧参考前端已从当前工程清理，固定版本与使用范围仍保留于 docs/references.md。

除首页三张新卡片外，鲸鱼图片、视频、图标、文案与贴纸取自用户指定的本地 codex-theme 项目。首页 assets/whale/home 的三张海洋插画使用内置 imagegen 生成，生成提示词见 docs/HOME-ART.md。其原许可说明见 assets/whale/ORIGINAL-NOTICES.md。使用和分发素材应分别遵守原始权利约定。

桌宠视频来自 PC2005-cloud/dsh-pet，提交 7f507e20e5b4f64cc9d51a44454ba13b13e789cd，MIT；完整许可与库存见 assets/whale/pet/dsh/LICENSE 和 inventory.json。沿用用户工程的桌宠数值状态服务 runtime/pet-state.js，其原项目采用 MIT，许可副本为 assets/whale/ORIGINAL-LICENSE。

本工程为非官方外部启动器，与 OpenAI 无官方关联，不修改 WindowsApps 或 app.asar。

原鲸鱼主题工程还记录了 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 1.5.20 快照的参考关系。assets/whale/ORIGINAL-NOTICES.md 是原工程声明的存档，其中 desktop/ 等路径与分发方式描述指向原工程，不表示本发行包包含那些目录或运行时。已清理的旧贴纸、参考图形和重复 SVG 不再进入本发行包。

