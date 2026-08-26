const MAX_EXCHANGE_LENGTH = 240;
const PROCEDURE_WORDS = new Set(["PSE", "K", "BK", "KN", "AR", "SK"]);

function normalizeExpected(value) {
  const qthCode = String(value?.qthCode ?? "").trim().toUpperCase().slice(0, 12);
  const antennaCode = String(value?.antennaCode ?? "").trim().toUpperCase().slice(0, 12);
  const powerWatts = Number(value?.powerWatts);
  return {
    qthCode: /^[A-Z0-9]{2,12}$/.test(qthCode) ? qthCode : null,
    powerWatts: Number.isFinite(powerWatts) && powerWatts >= 1 && powerWatts <= 100
      ? powerWatts : null,
    antennaCode: /^[A-Z0-9]{2,12}$/.test(antennaCode) ? antennaCode : null,
  };
}

function firstMatch(text, pattern, transform = (value) => value) {
  const match = pattern.exec(text);
  return match ? transform(match[1]) : null;
}

function compactFields(text, expected) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const useful = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] === "DE") {
      index += 1;
      continue;
    }
    if (!PROCEDURE_WORDS.has(tokens[index])) useful.push(tokens[index]);
  }
  const powerToken = useful.find((token) => /^\d+(?:\.\d+)?W$/.test(token));
  return {
    qthCode: useful.includes(expected.qthCode) ? expected.qthCode : null,
    powerWatts: powerToken ? Number(powerToken.slice(0, -1)) : null,
    antennaCode: useful.includes(expected.antennaCode) ? expected.antennaCode : null,
  };
}

export function parseExpeditionExchange(message, expectedValue, semantic = null) {
  const raw = String(message ?? "");
  const boundedRaw = raw.slice(0, MAX_EXCHANGE_LENGTH);
  const unsafeInput = raw.length > MAX_EXCHANGE_LENGTH
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(boundedRaw);
  const normalizedText = boundedRaw.toUpperCase()
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[=/:,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const expected = normalizeExpected(expectedValue);
  const labelled = /\b(?:QTH|PWR|ANT)\b/.test(normalizedText);
  const fields = labelled ? {
    qthCode: firstMatch(normalizedText, /\bQTH\s+([A-Z0-9]{2,12})\b/),
    powerWatts: firstMatch(normalizedText, /\bPWR\s+(\d+(?:\.\d+)?)\s*W?\b/, Number),
    antennaCode: firstMatch(normalizedText, /\bANT\s+([A-Z0-9]{2,12})\b/),
  } : compactFields(normalizedText, expected);
  const errors = [];
  if (!fields.qthCode) errors.push("MISSING_QTH");
  else if (fields.qthCode !== expected.qthCode) errors.push("WRONG_QTH");
  if (!Number.isFinite(fields.powerWatts)) errors.push("MISSING_POWER");
  else if (fields.powerWatts !== expected.powerWatts) errors.push("WRONG_POWER");
  if (!fields.antennaCode) errors.push("MISSING_ANTENNA");
  else if (fields.antennaCode !== expected.antennaCode) errors.push("WRONG_ANTENNA");
  if (unsafeInput) errors.push("UNSAFE_INPUT");
  if (semantic?.safeToCommit === false) errors.push("UNSAFE_SEMANTICS");
  return Object.freeze({
    accepted: errors.length === 0,
    safeToCommit: !unsafeInput && semantic?.safeToCommit !== false,
    normalizedText,
    fields: Object.freeze(fields),
    topics: Object.freeze([
      ...(fields.qthCode ? ["QTH"] : []),
      ...(Number.isFinite(fields.powerWatts) ? ["POWER"] : []),
      ...(fields.antennaCode ? ["ANTENNA"] : []),
    ]),
    errors: Object.freeze(errors),
  });
}
