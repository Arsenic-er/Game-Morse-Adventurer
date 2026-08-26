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

function usefulTokens(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const useful = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] === "DE") {
      if (index + 1 < tokens.length) index += 1;
      continue;
    }
    if (!PROCEDURE_WORDS.has(tokens[index])) useful.push(tokens[index]);
  }
  return useful;
}

function parseCompact(tokens) {
  if (tokens.length === 0) return { fields: { qthCode: null, powerWatts: null, antennaCode: null }, errors: [] };
  if (tokens.length !== 3
    || !/^[A-Z0-9]{2,12}$/.test(tokens[0])
    || !/^\d+(?:\.\d+)?W$/.test(tokens[1])
    || !/^[A-Z0-9]{2,12}$/.test(tokens[2])) {
    return {
      fields: { qthCode: null, powerWatts: null, antennaCode: null },
      errors: ["AMBIGUOUS_EXCHANGE"],
    };
  }
  return {
    fields: {
      qthCode: tokens[0],
      powerWatts: Number(tokens[1].slice(0, -1)),
      antennaCode: tokens[2],
    },
    errors: [],
  };
}

function parseLabelled(tokens) {
  const candidates = { QTH: [], POWER: [], ANTENNA: [] };
  const errors = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "QTH" || token === "ANT") {
      const value = tokens[index + 1];
      if (value && !["QTH", "PWR", "ANT"].includes(value) && /^[A-Z0-9]{2,12}$/.test(value)) {
        candidates[token === "QTH" ? "QTH" : "ANTENNA"].push(value);
        index += 1;
      } else {
        errors.push("INVALID_FIELD_SYNTAX");
      }
      continue;
    }
    if (token === "PWR") {
      const value = tokens[index + 1];
      if (value && /^\d+(?:\.\d+)?W?$/.test(value)) {
        candidates.POWER.push(Number(value.replace(/W$/, "")));
        index += 1;
        if (!value.endsWith("W") && tokens[index + 1] === "W") index += 1;
      } else {
        errors.push("INVALID_FIELD_SYNTAX");
      }
      continue;
    }
    errors.push("AMBIGUOUS_EXCHANGE");
  }
  if (candidates.QTH.length > 1) errors.push("DUPLICATE_QTH");
  if (candidates.POWER.length > 1) errors.push("DUPLICATE_POWER");
  if (candidates.ANTENNA.length > 1) errors.push("DUPLICATE_ANTENNA");
  return {
    fields: {
      qthCode: candidates.QTH.length === 1 ? candidates.QTH[0] : null,
      powerWatts: candidates.POWER.length === 1 ? candidates.POWER[0] : null,
      antennaCode: candidates.ANTENNA.length === 1 ? candidates.ANTENNA[0] : null,
    },
    errors: [...new Set(errors)],
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
  const tokens = usefulTokens(normalizedText);
  const labelled = tokens.some((token) => ["QTH", "PWR", "ANT"].includes(token));
  const parsed = labelled ? parseLabelled(tokens) : parseCompact(tokens);
  const fields = parsed.fields;
  const errors = [...parsed.errors];
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
