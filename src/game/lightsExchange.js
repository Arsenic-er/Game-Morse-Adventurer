import { normalizeCwText } from "../cw/morse.js";
import { LIGHTS_EVENT_REGIONS } from "./lightsEventCatalog.js";

const HANDOFF_PATTERN = /(?:KN|SK|TU|73|K)$/;
const TRAILING_PROCEDURE = Object.freeze(["PSE", "TU", "73", "KN", "SK", "K", "R"]);

function rejected(reason) {
  return { accepted: false, reason, rst: null, region: null };
}

function stripTrailingProcedure(value) {
  let result = value;
  let changed = true;
  while (changed && result) {
    changed = false;
    for (const token of TRAILING_PROCEDURE) {
      if (!result.endsWith(token)) continue;
      result = result.slice(0, -token.length);
      changed = true;
      break;
    }
  }
  return result;
}

function rstMatchFor(compact) {
  const legal = /(?:RST)?([1-5][1-9][1-9])/.exec(compact);
  if (legal) return { match: legal, rst: legal[1], legal: true };
  const numeric = /(?:RST)?([0-9]{3})/.exec(compact);
  return numeric ? { match: numeric, rst: numeric[1], legal: false } : null;
}

export function parseLightsReport(message, {
  selfCallsign, peerCallsign, expectedRegion, semanticResult = null,
} = {}) {
  if (semanticResult?.safeToCommit === false) return rejected("unsafeSemanticResult");
  const normalized = normalizeCwText(message);
  const compact = normalized.replace(/\s/g, "");
  const self = normalizeCwText(selfCallsign).replace(/\s/g, "");
  const peer = normalizeCwText(peerCallsign).replace(/\s/g, "");
  const expected = String(expectedRegion ?? "").trim().toUpperCase();
  if (!self || !peer || !compact.includes(self) || !compact.includes(peer)) return rejected("wrongCallsign");
  const address = `${peer}DE${self}`;
  if (!compact.includes(address)) return rejected("wrongCallsignOrder");
  if (!HANDOFF_PATTERN.test(compact)) return rejected("missingHandoff");

  const rstResult = rstMatchFor(compact);
  if (!rstResult || !rstResult.legal) return rejected("invalidRst");
  const afterRst = compact.slice(rstResult.match.index + rstResult.match[0].length);
  const afterPayload = stripTrailingProcedure(afterRst);
  const addressEnd = compact.indexOf(address) + address.length;
  const beforeRst = compact.slice(addressEnd, rstResult.match.index)
    .replace(/^(?:R|PSE|RST)+/, "");
  const region = (afterPayload.slice(0, 2) || beforeRst.slice(-2)).toUpperCase();
  if (!region) return rejected("missingRegion");
  if (!LIGHTS_EVENT_REGIONS.includes(region) || region !== expected) return rejected("wrongRegion");
  return { accepted: true, reason: null, rst: rstResult.rst, region };
}
