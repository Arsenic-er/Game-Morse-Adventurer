export const TRANSMITTERS = Object.freeze([
  {
    id: "squid-01",
    image: "./assets/squid01-board-off.png",
    stationImageOff: "./assets/squid01-board-off.png",
    stationImageOn: "./assets/squid01-board-on.png",
    powerWatts: 5,
    supportedBandsMeters: [15],
    modes: ["CW"],
    propagationBonus: 0,
    noiseGainMultiplier: 1,
    qsbDepthMultiplier: 1,
    fixed: true,
    starter: true,
    purchasable: false,
    price: 0,
    names: { "zh-CN": "SQUID-01 单频套件", "zh-TW": "SQUID-01 單頻套件", ja: "SQUID-01 単周波キット", en: "SQUID-01 single-band kit" },
  },
  {
    id: "usdr-8",
    panelLabel: "MICA-8",
    image: "./assets/radios/usdr-8-off.png",
    stationImageOff: "./assets/radios/usdr-8-off.png",
    stationImageOn: "./assets/radios/usdr-8-on.png",
    powerWatts: 5,
    supplyVoltage: 13.8,
    supportedBandsMeters: [80, 40, 30, 20, 17, 15, 12, 10],
    modes: ["CW"],
    referenceProfile: "uSDX-inspired",
    receiverFeatures: ["DSP", "AGC", "NR"],
    propagationBonus: 0,
    noiseGainMultiplier: 0.8,
    qsbDepthMultiplier: 0.85,
    fixed: false,
    starter: false,
    purchasable: true,
    price: 800,
    names: {
      "zh-CN": "MICA-8 微型 QRP 收发机",
      "zh-TW": "MICA-8 微型 QRP 收發機",
      ja: "MICA-8 マイクロ QRPトランシーバー",
      en: "MICA-8 micro QRP transceiver",
    },
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
