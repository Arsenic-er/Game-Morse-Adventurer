export const ANTENNAS = [
  {
    id: "none", image: null,
    names: { "zh-CN": "未装备天线", "zh-TW": "未裝備天線", ja: "アンテナなし", en: "No antenna" },
  },
  {
    id: "dipole", image: "./assets/antennas/dipole.png",
    names: { "zh-CN": "半波偶极天线", "zh-TW": "半波偶極天線", ja: "半波長ダイポール", en: "Half-wave dipole" },
  },
  {
    id: "yagi-3el", image: "./assets/antennas/yagi-3el.png",
    names: { "zh-CN": "三单元八木天线", "zh-TW": "三單元八木天線", ja: "3エレ八木", en: "3-element Yagi" },
  },
  {
    id: "vertical", image: "./assets/antennas/vertical.png",
    names: { "zh-CN": "垂直天线", "zh-TW": "垂直天線", ja: "バーチカル", en: "Vertical antenna" },
  },
];

export function getAntenna(antennaId) {
  return ANTENNAS.find((antenna) => antenna.id === antennaId) ?? ANTENNAS[0];
}
export function antennaName(antenna, language = "en") {
  return antenna.names[language] ?? antenna.names.en;
}
