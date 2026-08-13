import { editDistance, scoreDecodedText } from "../cw/inputAnalyzer.js";
import { clamp, normalizeCwText } from "../cw/morse.js";

function tokenSimilarity(token, target) {
  return scoreDecodedText(token ?? "", target);
}

function bestTokenMatch(tokens, target) {
  return tokens.reduce((best, token, index) => {
    const score = tokenSimilarity(token, target);
    return score > best.score ? { score, index, token } : best;
  }, { score: 0, index: -1, token: "" });
}

function bestSubstringMatch(value, target, { startAt = 0, endAt = null } = {}) {
  const input = String(value ?? "");
  const expected = String(target ?? "");
  if (!input || !expected) return { score: 0, index: -1, token: "", distance: expected.length };
  const start = Math.max(0, Math.trunc(startAt));
  const end = Math.min(input.length, Math.max(start, endAt === null ? input.length : Math.trunc(endAt)));
  const minimumLength = Math.max(1, expected.length - 1);
  const maximumLength = expected.length + 1;
  let best = { score: 0, index: -1, token: "", distance: expected.length };
  for (let index = start; index < end; index += 1) {
    for (let length = minimumLength; length <= maximumLength && index + length <= end; length += 1) {
      const token = input.slice(index, index + length);
      const distance = editDistance(token, expected);
      const score = tokenSimilarity(token, expected);
      if (score > best.score
        || (score === best.score && distance < best.distance)
        || (score === best.score && distance === best.distance && (best.index < 0 || index < best.index))) {
        best = { score, index, token, distance };
      }
    }
  }
  return best;
}

export function cqMessageCandidates(playerCallsign) {
  const callsign = normalizeCwText(playerCallsign);
  const baseCandidates = [
    `CQ DE ${callsign} K`,
    `CQ CQ DE ${callsign} K`,
    `CQ CQ DE ${callsign} ${callsign} K`,
    `CQ CQ CQ DE ${callsign} ${callsign} K`,
    `CQ CQ CQ DE ${callsign} ${callsign} ${callsign} K`,
  ];
  return baseCandidates.flatMap((candidate) => [
    candidate,
    candidate.replace(/ K$/, " PSE K"),
  ]);
}

export function assessCqTransmission({
  message,
  playerCallsign,
  wpm = null,
  rhythm = null,
} = {}) {
  const normalized = normalizeCwText(message).slice(0, 160);
  const compact = normalized.replace(/\s/g, "");
  const callsign = normalizeCwText(playerCallsign);
  const tokens = normalized.split(" ").filter(Boolean);
  const candidates = cqMessageCandidates(callsign);
  const candidateScores = candidates.map((candidate) => ({
    candidate,
    score: scoreDecodedText(normalized, candidate),
  }));
  candidateScores.sort((left, right) => right.score - left.score || left.candidate.length - right.candidate.length);
  const best = candidateScores[0];

  const tokenCqMatch = bestTokenMatch(tokens, "CQ");
  const tokenDeMatch = bestTokenMatch(tokens, "DE");
  const tokenCallsignMatch = bestTokenMatch(tokens, callsign);
  const compactCqMatch = bestSubstringMatch(compact, "CQ", { endAt: Math.min(compact.length, 8) });
  const deSearchStart = compactCqMatch.index >= 0
    ? compactCqMatch.index + compactCqMatch.token.length
    : 0;
  const compactDeMatch = bestSubstringMatch(compact, "DE", {
    startAt: deSearchStart,
    endAt: Math.min(compact.length, deSearchStart + 12),
  });
  const callsignSearchStart = compactDeMatch.index >= 0
    ? compactDeMatch.index + compactDeMatch.token.length
    : 0;
  const compactCallsignMatch = bestSubstringMatch(compact, callsign, { startAt: callsignSearchStart });
  const cqScore = Math.max(tokenCqMatch.score, compactCqMatch.score);
  const deScore = Math.max(tokenDeMatch.score, compactDeMatch.score);
  const callsignScore = Math.max(tokenCallsignMatch.score, compactCallsignMatch.score);
  const tokenIdentityDistance = tokenCallsignMatch.index >= 0
    ? editDistance(tokenCallsignMatch.token, callsign)
    : callsign.length;
  const identityEditDistance = Math.min(tokenIdentityDistance, compactCallsignMatch.distance);
  const kMatch = bestTokenMatch(tokens, "K");
  const compactKIndex = compact.lastIndexOf("K");
  const terminal = compact.endsWith("K") ? 100 : kMatch.index >= 0 || compactKIndex >= 0 ? 45 : 0;
  const tokenOrderedPairs = [
    tokenCqMatch.index >= 0 && tokenDeMatch.index > tokenCqMatch.index,
    tokenDeMatch.index >= 0 && tokenCallsignMatch.index > tokenDeMatch.index,
    tokenCallsignMatch.index >= 0 && kMatch.index > tokenCallsignMatch.index,
    kMatch.index === tokens.length - 1 && kMatch.index >= 0,
  ];
  const compactOrderedPairs = [
    compactCqMatch.score >= 55 && compactDeMatch.score >= 55 && compactDeMatch.index > compactCqMatch.index,
    compactDeMatch.score >= 55 && compactCallsignMatch.score >= 55 && compactCallsignMatch.index > compactDeMatch.index,
    compactCallsignMatch.score >= 55 && compactKIndex > compactCallsignMatch.index,
    compactKIndex === compact.length - 1 && compactKIndex >= 0,
  ];
  const orderScore = 25 * Math.max(
    tokenOrderedPairs.filter(Boolean).length,
    compactOrderedPairs.filter(Boolean).length,
  );
  const semanticScore = (
    .25 * cqScore
    + .5 * callsignScore
    + .15 * terminal
    + .1 * orderScore
  );

  const expectedTokens = ["CQ", "DE", callsign, "PSE", "K"];
  const garbageTokens = tokens.filter((token) => (
    Math.max(...expectedTokens.map((expected) => tokenSimilarity(token, expected))) < 45
  )).length;
  const tokenGarbagePenalty = tokens.length
    ? Math.min(18, (garbageTokens / tokens.length) * 18)
    : 18;
  const garbagePenalty = Math.min(tokenGarbagePenalty, Math.max(0, (100 - best.score) * .18));
  const hasRhythm = rhythm !== null && rhythm !== undefined && rhythm !== "" && Number.isFinite(Number(rhythm));
  const hasWpm = wpm !== null && wpm !== undefined && wpm !== "" && Number.isFinite(Number(wpm));
  const rhythmScore = hasRhythm ? clamp(Number(rhythm), 0, 100) : 50;
  const semanticQuality = clamp((
    .5 * best.score
    + .35 * semanticScore
    + .1 * orderScore
    - garbagePenalty
  ) / .95, 0, 100);
  let quality = (
    .5 * best.score
    + .35 * semanticScore
    + .1 * orderScore
    + .05 * rhythmScore
    - garbagePenalty
  );
  if (cqScore < 35 && callsignScore < 35) quality = Math.min(quality, 12);

  return {
    normalized,
    bestCandidate: best.candidate,
    quality: Math.round(clamp(quality, 0, 100)),
    semanticQuality: Math.round(semanticQuality),
    editScore: best.score,
    intentScore: Math.round(cqScore),
    deScore: Math.round(deScore),
    identityScore: Math.round(callsignScore),
    identityEditDistance,
    structureScore: Math.round((semanticScore + orderScore) / 2),
    orderScore,
    rhythmScore: Math.round(rhythmScore),
    garbagePenalty: Number(garbagePenalty.toFixed(1)),
    terminalScore: terminal,
    wpm: hasWpm ? Number(clamp(Number(wpm), 5, 60).toFixed(1)) : null,
    recognizable: cqScore >= 35 || callsignScore >= 35,
  };
}
