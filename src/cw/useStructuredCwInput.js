import { useEffect, useRef } from "react";
import { CLEAR_INPUT_GESTURE_LENGTH } from "./inputAnalyzer.js";
import { useCwCore } from "./useCwCore.js";

export function useStructuredCwInput({
  targetText = "CQ",
  automaticWpm = 18,
  keyType = "automatic",
  inputBlocked = false,
  enabled = true,
} = {}) {
  const cw = useCwCore({ targetText, automaticWpm, clearGestureLength: CLEAR_INPUT_GESTURE_LENGTH });
  const stateRef = useRef(null);
  stateRef.current = { enabled, inputBlocked, keyType };

  useEffect(() => {
    function onDown(event) {
      const state = stateRef.current;
      if (!state || state.inputBlocked || !state.enabled) return;
      if (["Space", "KeyZ", "KeyX"].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (state.keyType === "manual" && event.code === "Space") cw.beginManual();
      if (state.keyType === "automatic" && event.code === "KeyZ") cw.beginAutomatic(".");
      if (state.keyType === "automatic" && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function onUp(event) {
      const state = stateRef.current;
      if (!state) return;
      if (state.keyType === "manual" && event.code === "Space") cw.endManual();
      if (state.keyType === "automatic" && event.code === "KeyZ") cw.endAutomatic(".");
      if (state.keyType === "automatic" && event.code === "KeyX") cw.endAutomatic("-");
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") cw.stopAll();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", cw.stopAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", cw.stopAll);
      document.removeEventListener("visibilitychange", onVisibility);
      cw.stopAll();
    };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll]);

  useEffect(() => {
    if (inputBlocked || !enabled) cw.stopAll();
  }, [cw.stopAll, enabled, inputBlocked]);

  return cw;
}
