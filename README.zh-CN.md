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

Game-Morse-Adventurer 是一款本地运行的 Windows CW 台站模拟游戏原型。进入电台后接收机会立即开启并持续播放背景噪声；玩家使用手键或自动双桨先发送 CQ，系统再依据离线传播状况判断是否有虚构台站回应，并继续完成标准化通联。

## 主要内容

- Fusion Bold Pixel 字体与硬边深色像素界面。
- 简体中文、繁體中文、日本語、English 四语言。
- 标准莫尔斯时序、固定 650 Hz 侧音、手键 WPM 自动检测、解码与节奏评分。
- 手键使用 `Space`；自动键速度可在 5–40 WPM 调整，使用 `Z` 发点、`X` 发划，长按可连续发报。
- 独立练习台：字符、虚构呼号、手键和自动键练习。
- 玩家主叫的完整虚构 QSO：接收机自动监听、玩家先发 CQ、传播决定是否有人回应，再交换双方呼号、RST 与 73/SK。
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

当前 **v0.10.0** 已将通联改为常开接收机流程：进入电台即出现背景噪声，玩家必须先发 CQ，传播等级决定虚构台站是否回应；收到回应前不会提前显示对方呼号和传播详情。共有 68 项自动测试，覆盖 CW 核心与自动键循环、练习系统、玩家主叫 QSO 状态机、CQ 回应概率、日志与结算、商店经济、传播模型、地图投影及存档迁移规则。每次 `main` 更新都会自动测试并生成带 SHA-256 校验的 Windows x64 便携版，源码仓库不会提交 EXE 或构建目录。

## 权利声明

原创项目内容版权 © 2026 Arsenic-er（koko），保留所有权利，未授予开源许可。第三方组件继续适用其原始许可证，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
