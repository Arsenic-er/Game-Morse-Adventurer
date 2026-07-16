export const TRANSMITTERS = Object.freeze([
  {
    id: "squid-01",
    image: "./assets/squid01-board-off.png",
    fixed: true,
    names: { "zh-CN": "SQUID-01 单频套件", "zh-TW": "SQUID-01 單頻套件", ja: "SQUID-01 単周波キット", en: "SQUID-01 single-band kit" },
  },
]);

export const KEY_OPTIONS = Object.freeze([
  {
    id: "manual",
    image: "./assets/manual-key.png",
    names: { "zh-CN": "手键", "zh-TW": "手鍵", ja: "縦振り電鍵", en: "Straight key" },
    controls: { "zh-CN": "空格键", "zh-TW": "空白鍵", ja: "スペース", en: "Space" },
  },
  {
    id: "automatic",
    image: "./assets/automatic-key.png",
    names: { "zh-CN": "自动键", "zh-TW": "自動鍵", ja: "オートキー", en: "Automatic paddle" },
    controls: { "zh-CN": "Z 短音 / X 长音", "zh-TW": "Z 短音 / X 長音", ja: "Z 短点 / X 長点", en: "Z dot / X dash" },
  },
]);

export function getTransmitter(equipmentId) {
  return TRANSMITTERS.find((item) => item.id === equipmentId) ?? TRANSMITTERS[0];
}

export function getKeyOption(keyType) {
  return KEY_OPTIONS.find((item) => item.id === keyType) ?? KEY_OPTIONS[0];
}

export function equipmentName(item, language = "en") {
  return item.names[language] ?? item.names.en;
}

export function controlName(item, language = "en") {
  return item.controls?.[language] ?? item.controls?.en ?? "";
}
