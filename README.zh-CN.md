<div align="center">

# Game-Morse-Adventurer

### 像素风 CW 业余无线电台站冒险

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

</div>

> [!IMPORTANT]
> 本游戏内所有呼号均为虚构内容，与现实生活中的真实呼号无关；如有雷同，纯属巧合。

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer——少年少女在山湖边露营并进行业余无线电通联" width="100%">
</p>

**标签：** 摩尔斯电码 · 业余无线电 · CW · 电报 · 游戏

## 游戏简介

Game-Morse-Adventurer 是一款本地运行的 Windows CW 台站模拟游戏原型。玩家可以操作简单的 squid01 CW 套件，收听虚构台站、使用手键或自动双桨回应、完成标准化通联，并通过离线世界地图观察不同传播条件。

## 主要内容

- Fusion Bold Pixel 字体与硬边深色像素界面。
- 简体中文、繁體中文、日本語、English 四语言。
- 标准莫尔斯时序、固定 650 Hz 侧音、手键 WPM 自动检测、解码与节奏评分。
- 手键使用 `Space`；自动键速度可在 5–40 WPM 调整，使用 `Z` 发点、`X` 发划，长按可连续发报。
- 独立练习台：字符、虚构呼号、手键和自动键练习。
- 完整虚构 QSO：CQ、双方呼号、RST、73/SK、信用点、失败重开与日志。
- 持久化 QSO 结果页与通联日志，记录呼号、地区、距离、RST、传播、设备、WPM、准确率与节奏。
- 信用点采用原子化、幂等结算，同一次已完成通联不会被重复奖励。
- 台站时钟同时显示所选地点的当地时间与 UTC。
- 由台站位置、UTC 和 21.060 MHz 确定生成的离线传播系统。
- 传播等级实际影响 NPC 可用性、信号增益、噪声、QSB 和轻微频偏。

## 开发

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

当前 **v0.9.3** 已将错误的世界地图替换为单一的 2:1 等距圆柱投影地图，删除重复的日本，并让台站标记与真实经纬度保持一致。共有 64 项自动测试，覆盖 CW 核心与自动键循环、练习系统、QSO 状态机、日志与结算、商店经济、传播模型、地图投影及存档迁移规则。每次 `main` 更新都会自动测试并生成带 SHA-256 校验的 Windows x64 便携版，源码仓库不会提交 EXE 或构建目录。

## 权利声明

原创项目内容版权 © 2026 Arsenic-er（koko），保留所有权利，未授予开源许可。第三方组件继续适用其原始许可证，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
