export function tailPreview(value, maximum = 64, empty = "...") {
  const text = String(value ?? "");
  if (!text) return empty;
  const limit = Math.max(2, Math.floor(Number(maximum) || 64));
  return text.length > limit ? `…${text.slice(-(limit - 1))}` : text;
}
