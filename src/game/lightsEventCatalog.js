import { LOCATIONS, getLocation } from "./locations.js";
import { evaluateLightsAvailability } from "./worldCalendar.js";

export const LIGHTS_EVENT_REGIONS = Object.freeze(["JP", "US", "CN", "GE", "CH", "FI"]);

export const LIGHTS_EVENT = Object.freeze({
  id: "lights-across-air",
  missionId: "story-05",
  callsign: "SIM5LT",
  token: "LGT",
  names: Object.freeze({
    "zh-CN": "空中灯火纪念通联",
    "zh-TW": "空中燈火紀念通聯",
    ja: "空をつなぐ灯火記念QSO",
    en: "Lights Across the Air",
    es: "Luces en el aire",
    de: "Lichter über Funk",
    ru: "Огни в эфире",
  }),
});

const LOCATION_REGION = new Map(LOCATIONS.map((location) => {
  const code = location.id === "europe-rhine-valley" ? "GE" : location.countryCode;
  return [location.id, LIGHTS_EVENT_REGIONS.includes(code) ? code : null];
}));

export function lightsRegionForLocation(locationId) {
  return LOCATION_REGION.get(String(locationId ?? "")) ?? null;
}

export function lightsEntryModes(save, now = new Date()) {
  const claimed = Array.isArray(save?.missionState?.claimedMissionIds)
    ? save.missionState.claimedMissionIds : [];
  const storyCompleted = claimed.includes(LIGHTS_EVENT.missionId);
  const location = getLocation(save?.locationId);
  return evaluateLightsAvailability({
    now,
    timeZone: location.timeZone,
    storyCompleted,
    state: save?.worldCalendarState,
  });
}
