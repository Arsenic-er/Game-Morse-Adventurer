import { useCallback, useEffect, useRef, useState } from "react";
import { chapterMedia } from "./chapterMediaCatalog.js";
import { normalizeChapterMediaSettings } from "./chapterMediaSettings.js";
import { chapterSceneEffects, chapterSceneStyle, nextSceneEventDelay } from "./chapterSceneEffects.js";

function safePlay(element) {
  if (!element) return Promise.resolve(false);
  try {
    const result = element.play();
    if (!result?.then) return Promise.resolve(true);
    return result.then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

function sceneCanAnimate() {
  return typeof document !== "undefined" && !document.hidden
    && (typeof document.hasFocus !== "function" || document.hasFocus());
}

export function ChapterMediaStage({ chapter, settings, paused = false, children }) {
  const media = chapterMedia(chapter);
  const effects = chapterSceneEffects(chapter);
  const sceneFromStylesheet = media?.scene.replace("./assets/", "../assets/");
  const normalized = normalizeChapterMediaSettings(settings);
  const ambienceRef = useRef(null);
  const musicRef = useRef(null);
  const eventSoundRef = useRef(null);
  const unlockedRef = useRef(false);
  const [sceneActive, setSceneActive] = useState(sceneCanAnimate);
  const [eventPulse, setEventPulse] = useState(0);

  const play = useCallback(() => {
    if (!media || paused || !normalized.enabled || document.hidden) return;
    safePlay(ambienceRef.current);
    safePlay(musicRef.current);
  }, [media, normalized.enabled, paused]);

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      play();
    };
    window.addEventListener("pointerdown", unlock, { capture: true, once: true });
    window.addEventListener("keydown", unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [play]);

  useEffect(() => {
    const pause = () => {
      ambienceRef.current?.pause();
      musicRef.current?.pause();
      eventSoundRef.current?.pause();
      setSceneActive(false);
    };
    const onVisibility = () => {
      if (document.hidden) {
        pause();
      } else {
        const active = sceneCanAnimate();
        setSceneActive(active);
        if (active && unlockedRef.current) play();
      }
    };
    const onFocus = () => {
      const active = sceneCanAnimate();
      setSceneActive(active);
      if (active) play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", pause);
    };
  }, [play]);

  useEffect(() => {
    const ambience = ambienceRef.current;
    const music = musicRef.current;
    const eventSound = eventSoundRef.current;
    if (ambience) ambience.volume = normalized.ambienceVolume;
    if (music) music.volume = normalized.musicVolume;
    if (eventSound) eventSound.volume = Math.min(1, normalized.ambienceVolume * 1.35);
    if (!media || paused || !normalized.enabled) {
      ambience?.pause();
      music?.pause();
      eventSound?.pause();
    } else if (unlockedRef.current) play();
  }, [media, normalized.ambienceVolume, normalized.enabled, normalized.musicVolume, paused, play]);

  useEffect(() => setEventPulse(0), [media?.chapter]);

  useEffect(() => {
    if (!effects?.lightning || paused || !sceneActive) return undefined;
    let occurrence = 0;
    let flashTimer;
    let thunderTimer;
    let stopped = false;
    const scheduleFlash = () => {
      flashTimer = window.setTimeout(() => {
        if (stopped) return;
        setEventPulse((current) => current + 1);
        thunderTimer = window.setTimeout(() => {
          const eventSound = eventSoundRef.current;
          if (!stopped && eventSound && normalized.enabled && unlockedRef.current) {
            eventSound.currentTime = 0;
            safePlay(eventSound);
          }
        }, effects.lightning.thunderDelayMs);
        occurrence += 1;
        scheduleFlash();
      }, nextSceneEventDelay(effects.lightning, occurrence));
    };
    scheduleFlash();
    return () => {
      stopped = true;
      window.clearTimeout(flashTimer);
      window.clearTimeout(thunderTimer);
    };
  }, [effects, normalized.enabled, paused, sceneActive]);

  const layers = new Set(effects?.layers ?? []);
  const stageStyle = media ? { "--chapter-scene": `url(${sceneFromStylesheet})`, ...chapterSceneStyle(effects) } : undefined;

  return (
    <div
      className={`chapter-media-stage ${media ? "has-chapter-media" : ""}`}
      data-chapter-media={media?.chapter ?? ""}
      data-scene-active={!paused && sceneActive}
      data-scene-effects={effects?.layers.join(" ") ?? ""}
      style={stageStyle}
    >
      {media && <div className="chapter-scene-motion" aria-hidden="true">
        <div className="chapter-scene-layer chapter-scene-base" />
        {layers.has("far") && <div className="chapter-scene-layer chapter-scene-far" />}
        {layers.has("clouds") && <div className="chapter-scene-layer chapter-scene-clouds" />}
        {layers.has("mist") && <div className="chapter-scene-layer chapter-scene-mist" />}
        {layers.has("water") && <div className="chapter-scene-layer chapter-scene-water" />}
        {layers.has("stars") && <div className="chapter-scene-layer chapter-scene-stars" />}
        {layers.has("rain") && <div className="chapter-scene-layer chapter-scene-rain" />}
        <div className="chapter-scene-layer chapter-scene-shade" />
        {layers.has("sun") && <div className="chapter-scene-layer chapter-scene-sun" />}
        {layers.has("lights") && <div className="chapter-scene-layer chapter-scene-lights" />}
        {layers.has("beacon") && <div className="chapter-scene-layer chapter-scene-beacon" />}
        {layers.has("lighthouse") && <div className="chapter-scene-layer chapter-scene-lighthouse" />}
        {layers.has("lightning") && <div key={eventPulse} className={`chapter-scene-layer chapter-scene-lightning ${eventPulse ? "is-flashing" : ""}`} />}
      </div>}
      {children}
      {media && <div className="chapter-audio" aria-hidden="true">
        <audio ref={ambienceRef} src={media.ambience} preload="metadata" loop />
        <audio ref={musicRef} src={media.music} preload="metadata" loop />
        {effects?.lightning && <audio ref={eventSoundRef} src={effects.lightning.sound} preload="auto" />}
      </div>}
    </div>
  );
}
