<div align="center">

# Game-Morse-Adventurer

### ピクセルアートで楽しむ CW アマチュア無線局アドベンチャー

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md)

</div>

> [!IMPORTANT]
> ゲーム内のコールサインはすべて架空であり、実在するコールサインとは無関係です。類似があってもすべて偶然です。

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer — 山と湖を望むキャンプ場でアマチュア無線を楽しむ仲間たち" width="100%">
</p>

**タグ：** モールス信号 · アマチュア無線 · CW · 電信 · ゲーム

## ゲームについて

Game-Morse-Adventurer は、ローカルで動作する Windows 向け CW 無線局シミュレーションゲームのプロトタイプです。シンプルな squid01 CW キットを操作し、架空局を受信し、縦振り電鍵または自動パドルで応答して QSO を完成させ、オフライン世界地図で伝搬状況を確認できます。

## 主な特徴

- Fusion Bold Pixel フォントを使用したダークなピクセル UI。
- English、簡体中文、繁體中文、日本語に対応。
- 標準モールス符号タイミング、固定 650 Hz サイドトーン、自動 WPM、復号とリズム評価。
- 縦振り電鍵は `Space`、自動パドルは `Z` が短点、`X` が長点。
- 文字、架空コール、縦振り、自動パドルの独立練習モード。
- CQ、双方のコール、RST、73/SK、クレジット、失敗時の再開、ログ保存を含む架空 QSO。
- 局位置、UTC、21.060 MHz から決定的に生成されるオフライン伝搬モデル。
- 伝搬レベルは NPC の出現、信号利得、ノイズ、QSB、微小周波数偏移に実際に影響。

## 開発

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

現在 26 件の自動テストがあります。EXE と生成済みビルドはソースリポジトリに含めず、最終ビジュアル選定とリリース検証後に Windows ポータブル版を別途公開します。

## 権利表記

オリジナル部分の著作権は © 2026 Arsenic-er（koko）に帰属し、すべての権利を留保します。オープンソースライセンスは付与されません。第三者コンポーネントには各ライセンスが適用されます。詳細は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。
