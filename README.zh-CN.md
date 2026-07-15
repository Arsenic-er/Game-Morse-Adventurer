<div align="center">

# Game-Morse-Adventurer

### 像素风 CW 业余无线电台站冒险

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

</div>

> [!IMPORTANT]
> 本游戏内所有呼号均为虚构内容，与现实生活中的真实呼号无关；如有雷同，纯属巧合。

## 游戏简介

Game-Morse-Adventurer 是一款本地运行的 Windows CW 台站模拟游戏原型。玩家可以操作简单的 squid01 CW 套件，收听虚构台站、使用手键或自动双桨回应、完成标准化通联，并通过离线世界地图观察不同传播条件。

## 主要内容

- Fusion Bold Pixel 字体与硬边深色像素界面。
- 简体中文、繁體中文、日本語、English 四语言。
- 标准莫尔斯时序、固定 650 Hz 侧音、自动 WPM、解码与节奏评分。
- 手键使用 `Space`；自动键使用 `Z` 发点、`X` 发划。
- 独立练习台：字符、虚构呼号、手键和自动键练习。
- 完整虚构 QSO：CQ、双方呼号、RST、73/SK、信用点、失败重开与日志。
- 由台站位置、UTC 和 21.060 MHz 确定生成的离线传播系统。
- 传播等级实际影响 NPC 可用性、信号增益、噪声、QSB 和轻微频偏。

## 开发

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

当前包含 23 项自动测试。源码仓库不会提交 EXE 或构建目录；Windows 便携版将在最终视觉方案确认并通过发布验证后单独发布。

## 权利声明

原创项目内容版权 © 2026 Arsenic-er（koko），保留所有权利，未授予开源许可。第三方组件继续适用其原始许可证，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
