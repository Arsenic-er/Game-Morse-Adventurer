<div align="center">

# Game-Morse-Adventurer

### 像素風 CW 業餘無線電臺站冒險

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

</div>

> [!IMPORTANT]
> 本遊戲內所有呼號均為虛構內容，與現實生活中的真實呼號無關；如有雷同，純屬巧合。

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer——少年少女在山湖邊露營並進行業餘無線電通聯" width="100%">
</p>

**標籤：** 摩爾斯電碼 · 業餘無線電 · CW · 電報 · 遊戲

## 遊戲簡介

Game-Morse-Adventurer 是一款在本機執行的 Windows CW 臺站模擬遊戲原型。玩家可以操作簡單的 squid01 CW 套件，收聽虛構臺站、使用手鍵或自動雙槳回應、完成標準化通聯，並透過離線世界地圖觀察不同傳播條件。

## 主要內容

- Fusion Bold Pixel 字體與硬邊深色像素介面。
- 簡體中文、繁體中文、日本語、English 四種語言。
- 標準摩斯時序、固定 650 Hz 側音、自動 WPM、解碼與節奏評分。
- 手鍵使用 `Space`；自動鍵使用 `Z` 發點、`X` 發劃。
- 獨立練習臺：字元、虛構呼號、手鍵與自動鍵練習。
- 完整虛構 QSO：CQ、雙方呼號、RST、73/SK、信用點、失敗重開與日誌。
- 持久化 QSO 結果頁與通聯日誌，記錄呼號、地區、距離、RST、傳播、設備、WPM、準確率與節奏。
- 信用點採用原子化、冪等結算，同一次已完成通聯不會被重複獎勵。
- 電臺時鐘同時顯示所選地點的當地時間與 UTC。
- 由臺站位置、UTC 與 21.060 MHz 決定的離線傳播系統。
- 傳播等級實際影響 NPC 可用性、訊號增益、雜訊、QSB 與輕微頻偏。

## 開發

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

目前 **v0.9.1** 已加入信用點商店、持久化裝備庫存與受所有權保護的倉庫換裝，共有 56 項自動測試，涵蓋 CW 核心、練習系統、QSO 狀態機、日誌與結算、商店經濟、傳播模型及存檔遷移規則。每次 `main` 更新都會自動測試並產生附 SHA-256 校驗的 Windows x64 可攜版，原始碼倉庫不提交 EXE 或建置目錄。

## 權利聲明

原創專案內容版權 © 2026 Arsenic-er（koko），保留所有權利，未授予開源授權。第三方元件仍適用其原始授權，詳見 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
