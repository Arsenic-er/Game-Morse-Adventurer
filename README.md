<div align="center">

# Game-Morse-Adventurer

### A pixel-art CW amateur radio station adventure

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

</div>

> [!IMPORTANT]
> All callsigns in this game are fictional and unrelated to real-world callsigns. Any resemblance is purely coincidental.(It's still  a prototype. Any issues are welcomed!!!)

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer — friends camping and operating an amateur-radio station beside a mountain lake" width="100%">
</p>

**Tags:** Morse code · amateur radio · CW · telegraphy · game

## About

Game-Morse-Adventurer is a local Windows game prototype for learning and using Morse code in a fictional amateur-radio station. Operate a simple squid01 CW kit, listen to simulated stations, send replies with a straight key or automatic paddle, complete QSOs, and explore propagation conditions across an offline world map.

## Highlights

- Hard-edged dark pixel UI using the Fusion Bold Pixel font family.
- English, Simplified Chinese, Traditional Chinese, and Japanese interfaces.
- Standard Morse timing, fixed 650 Hz sidetone, decoding, rhythm scoring, and automatic WPM detection.
- Straight-key input with `Space`; automatic paddle input with `Z` for dot and `X` for dash.
- Independent CW practice for characters, fictional callsigns, straight key, and paddle.
- A complete fictional QSO loop: CQ, callsigns, RST, 73/SK, credits, failure/restart, and logging.
- Deterministic offline propagation based on station location, UTC, and 21.060 MHz.
- Propagation levels affect NPC availability, signal gain, noise, QSB, and small frequency offsets.
- Local Windows x64 portable build; no account or network connection required for gameplay.

## Controls

| Action | Control |
| --- | --- |
| Straight key | Hold `Space` |
| Automatic paddle — dot | `Z` |
| Automatic paddle — dash | `X` |
| Play the current NPC message | `F1` |
| Send/replay the captured reply | `F2` |
| Save log or restart a failed QSO | `F3` |

## Development

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

The project currently has 23 automated tests covering the CW core, practice engine, QSO state machine, and propagation model.

## Project status

This repository contains a playable prototype. The Windows executable and generated build directories are intentionally excluded from source control. A downloadable release can be published separately after final visual selection and release verification.

## Rights and third-party software

Original project materials are copyright © 2026 Arsenic-er (koko), all rights reserved. No open-source license is granted for the original game code or artwork. Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
