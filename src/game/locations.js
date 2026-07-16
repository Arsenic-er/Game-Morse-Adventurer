export const REGION_ORDER = ["japan", "usa", "china", "europe"];

export const REGION_NAMES = {
  japan: { "zh-CN": "日本", "zh-TW": "日本", ja: "日本", en: "Japan" },
  usa: { "zh-CN": "美国", "zh-TW": "美國", ja: "アメリカ", en: "United States" },
  china: { "zh-CN": "中国", "zh-TW": "中國", ja: "中国", en: "China" },
  europe: { "zh-CN": "欧洲", "zh-TW": "歐洲", ja: "ヨーロッパ", en: "Europe" },
};

export const LOCATIONS = [
  {
    id: "japan-tokyo-kanto", region: "japan", countryCode: "JP",
    names: { "zh-CN": "东京·关东郊区", "zh-TW": "東京·關東郊區", ja: "東京・関東郊外", en: "Tokyo · Kanto Suburb" },
    latitude: 35.6762, longitude: 139.6503, timeZone: "Asia/Tokyo",
    scene: "./assets/locations/japan-tokyo-kanto-v2.png",
  },
  {
    id: "japan-nagano-suwa", region: "japan", countryCode: "JP",
    names: { "zh-CN": "长野·诹访湖", "zh-TW": "長野·諏訪湖", ja: "長野・諏訪湖", en: "Nagano · Lake Suwa" },
    latitude: 36.0392, longitude: 138.1142, timeZone: "Asia/Tokyo",
    scene: "./assets/locations/japan-nagano-suwa-v2.png",
  },
  {
    id: "japan-hokkaido-furano", region: "japan", countryCode: "JP",
    names: { "zh-CN": "北海道·富良野", "zh-TW": "北海道·富良野", ja: "北海道・富良野", en: "Hokkaido · Furano" },
    latitude: 43.342, longitude: 142.383, timeZone: "Asia/Tokyo",
    scene: "./assets/locations/japan-hokkaido-furano-v2.png",
  },
  {
    id: "usa-pacific-northwest", region: "usa", countryCode: "US",
    names: { "zh-CN": "太平洋西北地区", "zh-TW": "太平洋西北地區", ja: "太平洋岸北西部", en: "Pacific Northwest" },
    latitude: 47.6062, longitude: -122.3321, timeZone: "America/Los_Angeles",
    scene: "./assets/locations/usa-pacific-northwest-v2.png",
  },
  {
    id: "usa-arizona-sonoran", region: "usa", countryCode: "US",
    names: { "zh-CN": "亚利桑那·索诺兰沙漠", "zh-TW": "亞利桑那·索諾蘭沙漠", ja: "アリゾナ・ソノラ砂漠", en: "Arizona · Sonoran Desert" },
    latitude: 32.2226, longitude: -110.9747, timeZone: "America/Phoenix",
    scene: "./assets/locations/usa-arizona-sonoran-v2.png",
  },
  {
    id: "usa-new-england", region: "usa", countryCode: "US",
    names: { "zh-CN": "新英格兰", "zh-TW": "新英格蘭", ja: "ニューイングランド", en: "New England" },
    latitude: 42.3601, longitude: -71.0589, timeZone: "America/New_York",
    scene: "./assets/locations/usa-new-england-v2.png",
  },
  {
    id: "china-beijing-outskirts", region: "china", countryCode: "CN",
    names: { "zh-CN": "北京郊区", "zh-TW": "北京郊區", ja: "北京郊外", en: "Beijing Outskirts" },
    latitude: 39.9042, longitude: 116.4074, timeZone: "Asia/Shanghai",
    scene: "./assets/locations/china-beijing-outskirts-v2.png",
  },
  {
    id: "china-chengdu-plain", region: "china", countryCode: "CN",
    names: { "zh-CN": "成都平原", "zh-TW": "成都平原", ja: "成都平原", en: "Chengdu Plain" },
    latitude: 30.5728, longitude: 104.0668, timeZone: "Asia/Shanghai",
    scene: "./assets/locations/china-chengdu-plain-v2.png",
  },
  {
    id: "china-guilin", region: "china", countryCode: "CN",
    names: { "zh-CN": "桂林", "zh-TW": "桂林", ja: "桂林", en: "Guilin" },
    latitude: 25.2742, longitude: 110.296, timeZone: "Asia/Shanghai",
    scene: "./assets/locations/china-guilin.png",
  },
  {
    id: "europe-swiss-lake", region: "europe", countryCode: "CH",
    names: { "zh-CN": "瑞士·琉森湖", "zh-TW": "瑞士·琉森湖", ja: "スイス・ルツェルン湖", en: "Switzerland · Lake Lucerne" },
    latitude: 47.0502, longitude: 8.3093, timeZone: "Europe/Zurich",
    scene: "./assets/locations/europe-swiss-lake.png",
  },
  {
    id: "europe-rhine-valley", region: "europe", countryCode: "DE",
    names: { "zh-CN": "莱茵河谷", "zh-TW": "萊茵河谷", ja: "ライン渓谷", en: "Rhine Valley" },
    latitude: 49.9929, longitude: 8.2473, timeZone: "Europe/Berlin",
    scene: "./assets/locations/europe-rhine-valley.png",
  },
  {
    id: "europe-finland-lake", region: "europe", countryCode: "FI",
    names: { "zh-CN": "芬兰·湖区", "zh-TW": "芬蘭·湖區", ja: "フィンランド・湖水地方", en: "Finland · Lake District" },
    latitude: 62.2426, longitude: 25.7473, timeZone: "Europe/Helsinki",
    scene: "./assets/locations/europe-finland-lake.png",
  },
];

export function getLocation(locationId) {
  return LOCATIONS.find((location) => location.id === locationId) ?? LOCATIONS[0];
}
export function locationName(location, language = "en") {
  return location.names[language] ?? location.names.en;
}

export function regionName(regionId, language = "en") {
  return REGION_NAMES[regionId]?.[language] ?? REGION_NAMES[regionId]?.en ?? regionId;
}

export function toPropagationLocation(location) {
  return {
    id: location.id,
    label: location.names.en,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function localHourForLocation(location, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", hour12: false, timeZone: location.timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12);
  return hour === 24 ? 0 : hour;
}

export function isNightAtLocation(location, date = new Date()) {
  const hour = localHourForLocation(location, date);
  return hour < 6 || hour >= 19;
}
