import { useCallback, useEffect, useRef } from "react";
import { chapterMedia } from "./chapterMediaCatalog.js";
import { normalizeChapterMediaSettings } from "./chapterMediaSettings.js";

function safePlay(element) {
  if (!element) return;
  const result = element.play();
  if (result?.catch) result.catch(() => {});
}

export function ChapterMediaStage({ chapter, settings, paused = false, children }) {
  const media = chapterMedia(chapter);
  const sceneFromStylesheet = media?.scene.replace("./assets/", "../assets/");
  const normalized = normalizeChapterMediaSettings(settings);
  const ambienceRef = useRef(null);
  const musicRef = useRef(null);
  const unlockedRef = useRef(false);

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
    };
    const onVisibility = () => {
      if (document.hidden) {
        pause();
      } else if (unlockedRef.current) play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", play);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", play);
      window.removeEventListener("blur", pause);
    };
  }, [play]);

  useEffect(() => {
    const ambience = ambienceRef.current;
    const music = musicRef.current;
    if (ambience) ambience.volume = normalized.ambienceVolume;
    if (music) music.volume = normalized.musicVolume;
    if (!media || paused || !normalized.enabled) {
      ambience?.pause();
      music?.pause();
    } else if (unlockedRef.current) play();
  }, [media, normalized.ambienceVolume, normalized.enabled, normalized.musicVolume, paused, play]);

  return (
    <div
      className={`chapter-media-stage ${media ? "has-chapter-media" : ""}`}
      data-chapter-media={media?.chapter ?? ""}
      style={media ? { "--chapter-scene": `url(${sceneFromStylesheet})` } : undefined}
    >
      {children}
      {media && <div className="chapter-audio" aria-hidden="true">
        <audio ref={ambienceRef} src={media.ambience} preload="metadata" loop />
        <audio ref={musicRef} src={media.music} preload="metadata" loop />
      </div>}
    </div>
  );
}
