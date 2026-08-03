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

export function cqMessageCandidates(playerCallsign) {
  const callsign = normalizeCwText(playerCallsign);
  return [
    `CQ DE ${callsign} K`,
    `CQ CQ DE ${callsign} K`,
    `CQ CQ DE ${callsign} ${callsign} K`,
    `CQ CQ CQ DE ${callsign} ${callsign} K`,
    `CQ CQ CQ DE ${callsign} ${callsign} ${callsign} K`,
  ];
}

export function assessCqTransmission({
  message,
  playerCallsign,
  wpm = null,
  rhythm = null,
} = {}) {
  const normalized = normalizeCwText(message).slice(0, 160);
  const callsign = normalizeCwText(playerCallsign);
  const tokens = normalized.split(" ").filter(Boolean);
  const candidates = cqMessageCandidates(callsign);
  const candidateScores = candidates.map((candidate) => ({
    candidate,
    score: scoreDecodedText(normalized, candidate),
  }));
  candidateScores.sort((left, right) => right.score - left.score || left.candidate.length - right.candidate.length);
  const best = candidateScores[0];

  const cqMatch = bestTokenMatch(tokens, "CQ");
  const deMatch = bestTokenMatch(tokens, "DE");
  const callsignMatch = bestTokenMatch(tokens, callsign);
  const identityEditDistance = callsignMatch.index >= 0
    ? editDistance(callsignMatch.token, callsign)
    : callsign.length;
  const kMatch = bestTokenMatch(tokens, "K");
  const terminal = tokens.at(-1) === "K" ? 100 : kMatch.index >= 0 ? 45 : 0;
  const orderedPairs = [
    cqMatch.index >= 0 && deMatch.index > cqMatch.index,
    deMatch.index >= 0 && callsignMatch.index > deMatch.index,
    callsignMatch.index >= 0 && kMatch.index > callsignMatch.index,
    kMatch.index === tokens.length - 1 && kMatch.index >= 0,
  ];
  const orderScore = 25 * orderedPairs.filter(Boolean).length;
  const semanticScore = (
    .25 * cqMatch.score
    + .5 * callsignMatch.score
    + .15 * terminal
    + .1 * orderScore
  );

  const expectedTokens = ["CQ", "DE", callsign, "K"];
  const garbageTokens = tokens.filter((token) => (
    Math.max(...expectedTokens.map((expected) => tokenSimilarity(token, expected))) < 45
  )).length;
  const garbagePenalty = tokens.length
    ? Math.min(18, (garbageTokens / tokens.length) * 18)
    : 18;
  const hasRhythm = rhythm !== null && rhythm !== undefined && rhythm !== "" && Number.isFinite(Number(rhythm));
  const hasWpm = wpm !== null && wpm !== undefined && wpm !== "" && Number.isFinite(Number(wpm));
  const rhythmScore = hasRhythm ? clamp(Number(rhythm), 0, 100) : 50;
  let quality = (
    .5 * best.score
    + .35 * semanticScore
    + .1 * orderScore
    + .05 * rhythmScore
    - garbagePenalty
  );
  if (cqMatch.score < 35 && callsignMatch.score < 35) quality = Math.min(quality, 12);

  return {
    normalized,
    bestCandidate: best.candidate,
    quality: Math.round(clamp(quality, 0, 100)),
    editScore: best.score,
    intentScore: Math.round(cqMatch.score),
    identityScore: Math.round(callsignMatch.score),
    identityEditDistance,
    structureScore: Math.round((semanticScore + orderScore) / 2),
    orderScore,
    rhythmScore: Math.round(rhythmScore),
    garbagePenalty: Number(garbagePenalty.toFixed(1)),
    wpm: hasWpm ? Number(clamp(Number(wpm), 5, 60).toFixed(1)) : null,
    recognizable: cqMatch.score >= 35 || callsignMatch.score >= 35,
  };
}
