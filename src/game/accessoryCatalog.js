export const ACCESSORIES = Object.freeze([
  {
    id: "none",
    image: null,
    noiseGainMultiplier: 1,
    bandwidthHz: null,
    filterCenterHz: null,
    filterQ: null,
    starter: false,
    purchasable: false,
    price: 0,
    names: {
      "zh-CN": "未装备配件",
      "zh-TW": "未裝備配件",
      ja: "アクセサリーなし",
      en: "No accessory",
      es: "Sin accesorio",
      de: "Kein Zubehör",
      ru: "Без аксессуаров",
    },
  },
  {
    id: "cw-filter-500",
    image: "./assets/accessories/cw-filter-500.png",
    noiseGainMultiplier: 0.65,
    bandwidthHz: 500,
    filterCenterHz: 650,
    filterQ: 1.3,
    starter: false,
    purchasable: true,
    price: 300,
    names: {
      "zh-CN": "CW-500 音频滤波器",
      "zh-TW": "CW-500 音訊濾波器",
      ja: "CW-500 オーディオフィルター",
      en: "CW-500 audio filter",
      es: "Filtro de audio CW-500",
      de: "CW-500-Audiofilter",
      ru: "Аудиофильтр CW-500",
    },
  },
]);

export function getAccessory(accessoryId) {
  return ACCESSORIES.find((accessory) => accessory.id === accessoryId) ?? ACCESSORIES[0];
}

export function accessoryName(accessory, language = "en") {
  return accessory.names[language] ?? accessory.names.en;
}
