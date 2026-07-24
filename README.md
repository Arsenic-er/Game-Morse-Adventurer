<div align="center">

# Game-Morse-Adventurer

### A pixel-art CW amateur radio station adventure

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

[![Windows portable](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml/badge.svg)](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml)

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
- A location-aware Home management center with filter-highlighted station, warehouse, shop, log, and achievement hotspots.
- Three local save slots with a seven-character uppercase callsign, fixed starting location, swappable equipment, and credits.
- Standard Morse timing, fixed 650 Hz sidetone, decoding, rhythm scoring, and straight-key WPM detection.
- Straight-key input with `Space`; adjustable 5–40 WPM automatic paddle input with `Z` for dot and `X` for dash, including continuous hold-to-repeat.
- Independent CW practice for characters, fictional callsigns, straight key, and paddle.
- A complete fictional QSO loop: CQ, callsigns, RST, 73/SK, credits, failure/restart, and logging.
- Persistent QSO result pages and logbook entries, including callsign, region, distance, RST, propagation, equipment, WPM, accuracy, and rhythm.
- Atomic, idempotent credit settlement prevents a completed QSO from being rewarded more than once.
- A four-language station store supports atomic purchases, persistent ownership, and warehouse-only equipment changes.
- Station clocks display both the selected station's local time and UTC.
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

The project currently has 62 automated tests covering the CW core and repeating keyer, practice engine, QSO state machine, persistent QSO logs and results, idempotent credit settlement, store economy, owned inventory, propagation model, and save data rules.

## Project status

Version **v0.9.2** replaces Home hotspot outlines with object-area filter highlights and adds a saved, adjustable automatic-key speed with deterministic Z/X hold-to-repeat. It remains a playable prototype with persistent QSO results, logbook history, a credit-based station store, owned-equipment inventory, and protected warehouse loadouts. Every accepted `main` revision is tested and packaged as a checksummed Windows x64 portable artifact without committing generated build directories to source control.

## Rights and third-party software

Original project materials are copyright © 2026 Arsenic-er (koko), all rights reserved. No open-source license is granted for the original game code or artwork. Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
