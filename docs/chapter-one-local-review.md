# 第一章本地独立审阅包（2026-09-14）

目标：用户无需启动开发服务器，双击 Windows 程序即可审阅第一章。

## 实现

- 使用单独的 Electron 入口、产品 ID、应用名称及 `userData` 目录，避免覆盖主游戏的存档或共用单实例锁。
- 通过受控 preload 参数启用本地审阅模式；普通网页和主游戏默认行为不变。
- 首次启动创建零金钱、零 QSO 的独立 SIM1OP 存档，接受第一章后直接显示开场。
- 只开放正式第一章、电台和故事原画审阅；其他路由回到独立菜单。
- 菜单提供续读、只看故事、二次确认后重开；已领取奖励的试玩不会在重启时自动重置。
- 保留真实电键、解码、离线 ONNX 语义模型及原有结算，不启用 `qaCapture`。
- 打包第一章和共用台站素材，排除第二至十五章的章节素材。不修改主游戏发布版本号。

## 构建

```powershell
corepack pnpm@10.12.1 exec vite build
node scripts/report-build-size.mjs
corepack pnpm@10.12.1 exec electron-builder --config electron-builder.chapter-one.cjs --win portable --x64 --publish never
node scripts/qa-chapter-one-desktop.mjs
```

结果为 `release-chapter-one/CWGame-ChapterOne-Review.exe`。生成物已加入 Git 忽略规则，不自动提交或发布。

## 验收

本次新增及相关状态测试 36/36 通过，生产构建和 512,000 字节自有 JS 分块预算通过（最大 505,689 字节）。此前正式第一章整合的全量回归为 749/749，通过记录见 `chapter-one-story-verification.md`。

`scripts/qa-chapter-one-desktop.mjs` 在独立临时用户目录启动真正的打包程序，关闭 Chromium 网络访问，以 `file:` 协议检查：自动进入第一章、原画及音频素材加载、实际 ONNX provider、刷新续读、独立菜单、故事审阅不改进度、重开二次确认、真实 Z 键事件产生脉冲，以及退出电台不增加 QSO。测试不开启 QA 快速通联开关、不注入完成日志。

截图和实际运行结果保存在被忽略的 `qa-artifacts-chapter-one-desktop/`。交付文件放在 Windows 桌面的日期标注审阅文件夹内，并附有使用说明。

## 本地交付文件

- 文件夹：`C:\Users\jiang\Desktop\CWGame-第一章审阅-2026-09-14`
- 程序：`CWGame-ChapterOne-Review.exe`，155,717,097 字节（约 149 MiB）。
- SHA-256：`40804878d1f9ecdc62d3f8a6b534de733060fffead8e3ac3d562ecb0b1180d07`。
- 附带 `先读我.txt` 和 SHA-256 校验文件。单文件便携程序，无需开发服务器或安装 Node.js。
