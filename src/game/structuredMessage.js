const DEFAULT_MAX_CHARACTERS = 256;
const DEFAULT_MAX_TOKENS = 64;
const HARD_MAX_CHARACTERS = 2048;
const HARD_MAX_TOKENS = 128;
const PROCEDURE_WORDS = new Set(["DE", "PSE", "K", "KN", "AGN", "QRS"]);

function boundedInteger(value, fallback, maximum) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0
    ? Math.min(number, maximum)
    : fallback;
}

function text(value) {
  try {
    return String(value ?? "");
  } catch {
    return null;
  }
}

function frozenResult(tokens, fields = {}, errors = []) {
  return Object.freeze({
    ok: errors.length === 0,
    fields: Object.freeze(fields),
    errors: Object.freeze(errors),
    tokens,
  });
}

function ownValue(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function normalizeSchema(schema) {
  try {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return null;
    const entries = [];
    for (const label of Object.keys(schema).slice(0, 24)) {
      const descriptor = Object.getOwnPropertyDescriptor(schema, label);
      if (!descriptor || !Object.hasOwn(descriptor, "value")
        || !/^[A-Z][A-Z0-9-]{0,15}$/.test(label)) return null;
      const rule = descriptor.value;
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) return null;
      const values = ownValue(rule, "values");
      const pattern = ownValue(rule, "pattern");
      if (values !== undefined) {
        if (!Array.isArray(values) || values.length === 0 || values.length > 64) return null;
        const normalizedValues = [];
        for (let index = 0; index < values.length; index += 1) {
          const valueDescriptor = Object.getOwnPropertyDescriptor(values, String(index));
          if (!valueDescriptor || !Object.hasOwn(valueDescriptor, "value")) return null;
          const candidate = text(valueDescriptor.value);
          if (!candidate || candidate !== candidate.toUpperCase() || candidate.length > 32) return null;
          normalizedValues.push(candidate);
        }
        entries.push([label, Object.freeze({ values: Object.freeze(normalizedValues) })]);
      } else if (pattern instanceof RegExp) {
        entries.push([label, Object.freeze({ pattern: new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")) })]);
      } else {
        return null;
      }
    }
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

export function tokenizeStructuredMessage(input, options = {}) {
  const source = text(input);
  if (source == null) return Object.freeze([]);
  const maxCharacters = boundedInteger(options?.maxCharacters, DEFAULT_MAX_CHARACTERS, HARD_MAX_CHARACTERS);
  const maxTokens = boundedInteger(options?.maxTokens, DEFAULT_MAX_TOKENS, HARD_MAX_TOKENS);
  const normalized = source.toUpperCase().slice(0, maxCharacters)
    .replace(/[^A-Z0-9-]+/g, " ").trim();
  return Object.freeze((normalized ? normalized.split(/\s+/) : []).slice(0, maxTokens));
}

export function parseStructuredFields(input, schema) {
  const source = text(input);
  const tokens = tokenizeStructuredMessage(source);
  const entries = normalizeSchema(schema);
  if (source == null || !entries) return frozenResult(tokens, {}, [source == null ? "INVALID_INPUT" : "INVALID_SCHEMA"]);

  const fields = {};
  const errors = [];
  let cursor = 0;
  const skipProcedureWords = () => {
    while (PROCEDURE_WORDS.has(tokens[cursor])) cursor += 1;
  };

  if (source.length > DEFAULT_MAX_CHARACTERS) errors.push("INPUT_TOO_LONG");
  for (const [label, rule] of entries) {
    skipProcedureWords();
    if (tokens[cursor] !== label || cursor + 1 >= tokens.length) {
      errors.push(`MISSING_${label}`);
      continue;
    }
    const value = tokens[cursor + 1];
    const valid = rule.values ? rule.values.includes(value) : rule.pattern.test(value);
    if (!valid) errors.push(`INVALID_${label}`);
    else fields[label] = value;
    cursor += 2;
  }
  skipProcedureWords();
  if (cursor < tokens.length) {
    const labels = new Set(entries.map(([label]) => label));
    const duplicate = tokens.slice(cursor).find((token) => labels.has(token));
    errors.push(duplicate ? `DUPLICATE_${duplicate}` : "UNEXPECTED_TOKEN");
  }
  return frozenResult(tokens, fields, errors);
}
