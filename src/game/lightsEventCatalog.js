import { LOCATIONS } from "./locations.js";
import { evaluateLightsAvailability, stationCalendarDate } from "./worldCalendar.js";

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

export const LIGHTS_ACTIVITY_RULES = Object.freeze({
  stationId: "station:lights-sim5lt",
  timeZone: "Asia/Tokyo",
  annualWindow: Object.freeze({ month: 5, firstDay: 1, lastDay: 7, specialDay: 5 }),
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
  return evaluateLightsAvailability({
    now,
    activityRules: LIGHTS_ACTIVITY_RULES,
    storyCompleted,
    state: save?.worldCalendarState,
  });
}

export function lightsStationCalendarDate(now = new Date()) {
  return stationCalendarDate(now, LIGHTS_ACTIVITY_RULES.timeZone);
}

function nextAnnualOpening(stationYear) {
  // The fictional SIM5LT event station is fixed in Japan, where DST is not observed.
  return new Date(Date.UTC(stationYear, 4, 1, 0, 0, 0) - 9 * 60 * 60 * 1000).toISOString();
}

export function lightsAnnualWindowModel(save, now = new Date()) {
  const instant = new Date(now);
  const safeInstant = Number.isFinite(instant.getTime()) ? instant : new Date(0);
  const date = lightsStationCalendarDate(safeInstant);
  const { month, firstDay, lastDay } = LIGHTS_ACTIVITY_RULES.annualWindow;
  const open = date.month === month && date.day >= firstDay && date.day <= lastDay;
  const openingYear = open || date.month > month || (date.month === month && date.day > lastDay)
    ? date.year + 1 : date.year;
  const calendarRecord = (Array.isArray(save?.worldCalendarState?.annualRecords)
    ? save.worldCalendarState.annualRecords : []).find(({ year }) => Number(year) === date.year) ?? null;
  const archived = (Array.isArray(save?.eventRunArchive?.annualBests)
    ? save.eventRunArchive.annualBests : []).find(({ stationDate }) => String(stationDate).startsWith(`${date.year}-`)) ?? null;
  return {
    timeZone: LIGHTS_ACTIVITY_RULES.timeZone,
    open,
    specialDay: open && date.day === LIGHTS_ACTIVITY_RULES.annualWindow.specialDay,
    nextOpeningAt: nextAnnualOpening(openingYear),
    claimed: calendarRecord?.rewardClaimed === true,
    bestGrade: calendarRecord?.bestGrade ?? archived?.grade ?? "none",
    stamp: calendarRecord?.stamp ?? archived?.stamp ?? "none",
  };
}
