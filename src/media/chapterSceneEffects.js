const THUNDER_SOUND = "./assets/scene-sfx/thunder.wav";

function freezeEffect(chapter, effect) {
  return Object.freeze({
    chapter,
    layers: Object.freeze(effect.layers ?? []),
    audioCues: Object.freeze(effect.audioCues ?? []),
    farClip: effect.farClip ?? "inset(0 0 55% 0)",
    skyClip: effect.skyClip ?? effect.farClip ?? "inset(0 0 55% 0)",
    waterClip: effect.waterClip ?? "inset(100% 0 0 0)",
    glows: Object.freeze((effect.glows ?? []).map((glow) => Object.freeze([...glow]))),
    weatherOpacity: effect.weatherOpacity ?? 0.24,
    lighthouse: effect.lighthouse ? Object.freeze(effect.lighthouse) : null,
    lightning: effect.lightning ? Object.freeze({ sound: THUNDER_SOUND, ...effect.lightning }) : null,
  });
}

const nightEquipment = [
  [24, 55, "rgba(48, 215, 232, .2)", 8],
  [75, 51, "rgba(48, 215, 232, .18)", 8],
  [82, 25, "rgba(255, 190, 83, .16)", 10],
];

export const CHAPTER_SCENE_EFFECTS = Object.freeze([
  freezeEffect(1, {
    layers: ["far", "clouds", "water", "stars", "lights"],
    audioCues: ["dawn", "distant-water", "radio-room"],
    farClip: "polygon(35% 0, 59% 0, 59% 40%, 35% 40%)",
    waterClip: "polygon(36% 32%, 59% 32%, 59% 40%, 36% 40%)",
    glows: nightEquipment,
  }),
  freezeEffect(2, {
    layers: ["far", "clouds", "water", "stars", "lights"],
    audioCues: ["night", "distant-water", "paper-room"],
    farClip: "polygon(39% 0, 61% 0, 61% 35%, 39% 35%)",
    waterClip: "polygon(40% 23%, 60% 23%, 60% 32%, 40% 32%)",
    glows: nightEquipment,
  }),
  freezeEffect(3, {
    layers: ["far", "clouds", "water", "stars", "lights"],
    audioCues: ["night", "lake", "receivers"],
    farClip: "polygon(33% 0, 64% 0, 64% 44%, 33% 44%)",
    waterClip: "polygon(43% 29%, 57% 29%, 57% 43%, 43% 43%)",
    glows: [
      [22, 39, "rgba(255, 163, 62, .25)", 7], [50, 40, "rgba(48, 215, 232, .24)", 8],
      [78, 40, "rgba(128, 220, 69, .23)", 8], [50, 31, "rgba(250, 227, 171, .13)", 9],
    ],
  }),
  freezeEffect(4, {
    layers: ["far", "clouds", "water", "rain", "lights", "lightning"],
    audioCues: ["rain", "lake", "thunder"],
    farClip: "polygon(30% 0, 70% 0, 70% 50%, 30% 50%)",
    waterClip: "polygon(31% 27%, 69% 27%, 69% 50%, 31% 50%)",
    weatherOpacity: 0.28,
    glows: nightEquipment,
    lightning: { firstDelayMs: 5200, intervalMs: 11800, jitterMs: 2600, thunderDelayMs: 920 },
  }),
  freezeEffect(5, {
    layers: ["far", "clouds", "water", "stars", "lights"],
    audioCues: ["night", "distant-water", "memorial-lights"],
    farClip: "polygon(32% 0, 67% 0, 67% 42%, 32% 42%)",
    waterClip: "polygon(39% 24%, 64% 24%, 64% 34%, 39% 34%)",
    glows: [
      [50, 27, "rgba(255, 171, 55, .19)", 16], [7, 19, "rgba(255, 178, 70, .2)", 8],
      [82, 58, "rgba(255, 155, 47, .2)", 7], [24, 55, "rgba(48, 215, 232, .17)", 7],
    ],
  }),
  freezeEffect(6, {
    layers: ["far", "clouds", "sun", "lights"],
    audioCues: ["hill-wind", "open-air", "radio"],
    farClip: "inset(0 0 37% 0)",
    skyClip: "inset(0 0 55% 0)",
    glows: [[88, 31, "rgba(255, 195, 92, .2)", 17], [31, 59, "rgba(48, 215, 232, .12)", 7]],
  }),
  freezeEffect(7, {
    layers: ["far", "clouds", "stars", "lights", "beacon"],
    audioCues: ["dusk", "city", "radio"],
    farClip: "polygon(37% 0, 64% 0, 64% 42%, 37% 42%)",
    glows: [[56, 7, "rgba(255, 55, 55, .22)", 4], ...nightEquipment],
  }),
  freezeEffect(8, {
    layers: ["far", "clouds", "lights", "beacon"],
    audioCues: ["storm-clouds", "blackout-net", "lanterns"],
    farClip: "polygon(31% 0, 69% 0, 69% 48%, 31% 48%)",
    glows: [[50, 27, "rgba(255, 178, 66, .13)", 15], [12, 24, "rgba(255, 180, 74, .2)", 8], ...nightEquipment],
  }),
  freezeEffect(9, {
    layers: ["far", "mist", "stars", "lights", "beacon"],
    audioCues: ["night", "valley-wind", "relay-grid"],
    farClip: "polygon(34% 0, 66% 0, 66% 47%, 34% 47%)",
    glows: [[43, 16, "rgba(255, 58, 58, .26)", 4], [58, 16, "rgba(255, 58, 58, .26)", 4], ...nightEquipment],
  }),
  freezeEffect(10, {
    layers: ["far", "clouds", "lights", "beacon"],
    audioCues: ["storm-clouds", "city", "contest-room"],
    farClip: "polygon(40% 0, 65% 0, 65% 43%, 40% 43%)",
    glows: [
      [49, 52, "rgba(48, 215, 232, .2)", 8], [78, 54, "rgba(48, 215, 232, .2)", 8],
      [66, 47, "rgba(255, 75, 47, .2)", 8], [31, 53, "rgba(255, 180, 58, .18)", 7],
    ],
  }),
  freezeEffect(11, {
    layers: ["far", "mist", "water", "stars", "lights"],
    audioCues: ["forest-night", "lake", "silent-watch"],
    farClip: "polygon(31% 0, 75% 0, 75% 47%, 31% 47%)",
    waterClip: "polygon(47% 23%, 70% 23%, 70% 39%, 47% 39%)",
    glows: [[64, 29, "rgba(255, 182, 71, .18)", 6], ...nightEquipment],
  }),
  freezeEffect(12, {
    layers: ["far", "clouds", "water", "rain", "lights", "lightning", "lighthouse"],
    audioCues: ["heavy-rain", "ocean-waves", "thunder"],
    farClip: "polygon(28% 0, 75% 0, 75% 50%, 28% 50%)",
    waterClip: "polygon(28% 20%, 75% 20%, 75% 51%, 28% 51%)",
    weatherOpacity: 0.34,
    glows: [[67, 11, "rgba(255, 214, 125, .23)", 7], [13, 33, "rgba(255, 179, 71, .21)", 8], ...nightEquipment],
    lighthouse: { x: "67%", y: "11%", duration: "8.5s" },
    lightning: { firstDelayMs: 3300, intervalMs: 9200, jitterMs: 2200, thunderDelayMs: 640 },
  }),
  freezeEffect(13, {
    layers: ["far", "water", "stars", "lights"],
    audioCues: ["night", "lake", "multi-station"],
    farClip: "polygon(15% 0, 84% 0, 84% 50%, 15% 50%)",
    waterClip: "polygon(15% 16%, 84% 16%, 84% 50%, 15% 50%)",
    glows: [
      [16, 36, "rgba(255, 179, 67, .19)", 8], [84, 35, "rgba(255, 179, 67, .19)", 8],
      [25, 55, "rgba(128, 220, 69, .2)", 7], [77, 57, "rgba(48, 215, 232, .2)", 7],
      [50, 25, "rgba(255, 165, 62, .16)", 9],
    ],
  }),
  freezeEffect(14, {
    layers: ["far", "clouds", "water", "stars", "lights"],
    audioCues: ["night", "distant-lake", "old-log"],
    farClip: "polygon(39% 0, 65% 0, 65% 39%, 39% 39%)",
    waterClip: "polygon(42% 22%, 62% 22%, 62% 35%, 42% 35%)",
    glows: [[10, 20, "rgba(255, 178, 68, .2)", 7], [84, 22, "rgba(255, 203, 115, .18)", 10], ...nightEquipment],
  }),
  freezeEffect(15, {
    layers: ["far", "clouds", "water", "sun", "lights"],
    audioCues: ["sunrise", "lake", "morning-birds"],
    farClip: "polygon(36% 0, 65% 0, 65% 41%, 36% 41%)",
    waterClip: "polygon(42% 25%, 60% 25%, 60% 37%, 42% 37%)",
    glows: [[48, 22, "rgba(255, 204, 112, .27)", 13], [83, 22, "rgba(255, 207, 126, .2)", 11], ...nightEquipment],
  }),
]);

export function chapterSceneEffects(chapter) {
  const numeric = Math.floor(Number(chapter));
  return CHAPTER_SCENE_EFFECTS[numeric - 1] ?? null;
}

export function chapterSceneStyle(effect) {
  if (!effect) return undefined;
  const glowBackground = effect.glows.map(([x, y, color, size]) =>
    `radial-gradient(circle ${size}% at ${x}% ${y}%, ${color} 0, transparent 100%)`
  ).join(", ");
  return {
    "--chapter-far-clip": effect.farClip,
    "--chapter-sky-clip": effect.skyClip,
    "--chapter-water-clip": effect.waterClip,
    "--chapter-weather-opacity": effect.weatherOpacity,
    "--chapter-light-glows": glowBackground || "none",
    "--chapter-lighthouse-x": effect.lighthouse?.x ?? "50%",
    "--chapter-lighthouse-y": effect.lighthouse?.y ?? "20%",
    "--chapter-lighthouse-duration": effect.lighthouse?.duration ?? "9s",
  };
}

export function nextSceneEventDelay(lightning, occurrence = 0) {
  if (!lightning) return null;
  const cycle = ((Math.max(0, occurrence) * 37 + 17) % 101) / 100;
  const jitter = (cycle - 0.5) * 2 * lightning.jitterMs;
  return Math.max(1000, Math.round((occurrence === 0 ? lightning.firstDelayMs : lightning.intervalMs) + jitter));
}
