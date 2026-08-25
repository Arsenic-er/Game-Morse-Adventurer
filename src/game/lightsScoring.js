function count(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(999, Math.max(0, Math.floor(numeric))) : 0;
}

export function scoreLightsResult(facts = {}) {
  const validQsoCount = count(facts.validQsoCount);
  const distinctRegionCount = count(facts.distinctRegionCount);
  const resolvedPileupCount = count(facts.resolvedPileupCount);
  const successfulPartialCount = count(facts.successfulPartialCount);
  const misidentificationCount = count(facts.misidentificationCount);
  const agnRequestCount = count(facts.agnRequestCount);
  const score = Math.min(999, Math.max(0,
    validQsoCount * 100
      + distinctRegionCount * 25
      + successfulPartialCount * 15
      - misidentificationCount * 25
      - agnRequestCount * 5));
  let grade = "none";
  if (validQsoCount >= 3 && distinctRegionCount >= 2 && resolvedPileupCount >= 1) grade = "base";
  if (validQsoCount >= 5 && distinctRegionCount >= 4 && resolvedPileupCount >= 1) grade = "silver";
  if (validQsoCount >= 7 && distinctRegionCount >= 5 && resolvedPileupCount >= 1
    && misidentificationCount === 0) grade = "gold";
  return { score, grade };
}
