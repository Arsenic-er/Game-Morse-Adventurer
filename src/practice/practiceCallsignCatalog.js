export const PRACTICE_CALLSIGN_REGIONS = Object.freeze({
  ALL: "all",
  JAPAN: "japan",
  USA: "usa",
  CHINA: "china",
  EUROPE: "europe",
});

export const FICTIONAL_CALLSIGNS = Object.freeze([
  "SIM7QX",
  "SIM3RA",
  "SIM9AK",
  "SIM5TU",
  "SIM2DX",
  "SIM8CW",
  "SIM4NZ",
  "SIM6JP",
]);

const REGION_CALLSIGNS = Object.freeze({
  [PRACTICE_CALLSIGN_REGIONS.ALL]: FICTIONAL_CALLSIGNS,
  [PRACTICE_CALLSIGN_REGIONS.JAPAN]: Object.freeze([
    "SIM1JA", "SIM2TK", "SIM3OS", "SIM4HK", "SIM5NG", "SIM6SD", "SIM7KY", "SIM8OK",
  ]),
  [PRACTICE_CALLSIGN_REGIONS.USA]: Object.freeze([
    "SIM1US", "SIM2CA", "SIM3TX", "SIM4NY", "SIM5FL", "SIM6WA", "SIM7CO", "SIM8AZ",
  ]),
  [PRACTICE_CALLSIGN_REGIONS.CHINA]: Object.freeze([
    "SIM1CN", "SIM2BJ", "SIM3SH", "SIM4GD", "SIM5SC", "SIM6HB", "SIM7LN", "SIM8XJ",
  ]),
  [PRACTICE_CALLSIGN_REGIONS.EUROPE]: Object.freeze([
    "SIM1EU", "SIM2DE", "SIM3FR", "SIM4IT", "SIM5ES", "SIM6PL", "SIM7SE", "SIM8NL",
  ]),
});

export function normalizePracticeCallsignRegion(value) {
  return Object.values(PRACTICE_CALLSIGN_REGIONS).includes(value)
    ? value
    : PRACTICE_CALLSIGN_REGIONS.ALL;
}

export function practiceCallsignPool(value = PRACTICE_CALLSIGN_REGIONS.ALL) {
  return [...REGION_CALLSIGNS[normalizePracticeCallsignRegion(value)]];
}

export function practiceCallsignCatalog() {
  return Object.fromEntries(Object.values(PRACTICE_CALLSIGN_REGIONS)
    .map((region) => [region, practiceCallsignPool(region)]));
}
