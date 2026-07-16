import { useEffect, useMemo, useState } from "react";

const LABELS = {
  "zh-CN": { good: "网络良好", medium: "网络一般", poor: "网络较差", offline: "无网络" },
  "zh-TW": { good: "網路良好", medium: "網路一般", poor: "網路較差", offline: "無網路" },
  ja: { good: "通信良好", medium: "通信普通", poor: "通信不安定", offline: "オフライン" },
  en: { good: "Network good", medium: "Network medium", poor: "Network poor", offline: "Offline" },
};

function browserNetworkState() {
  return navigator.onLine ? "good" : "offline";
}

export function NetworkIndicator({ language = "en" }) {
  const [status, setStatus] = useState(() => ({ state: browserNetworkState(), signalPercent: null }));

  useEffect(() => {
    let cancelled = false;

    async function update() {
      if (!navigator.onLine) {
        if (!cancelled) setStatus({ state: "offline", signalPercent: 0 });
        return;
      }
      try {
        const systemStatus = await window.cwgameSystem?.getNetworkStatus?.();
        if (!cancelled && systemStatus?.available && systemStatus.state) {
          setStatus({ state: systemStatus.state, signalPercent: systemStatus.signalPercent });
          return;
        }
      } catch {
        // Browser online state remains the safe fallback when Windows hides WLAN telemetry.
      }
      if (!cancelled) setStatus({ state: browserNetworkState(), signalPercent: null });
    }

    update();
    const timer = window.setInterval(update, 5000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const label = useMemo(() => {
    const base = (LABELS[language] ?? LABELS.en)[status.state];
    return status.signalPercent === null ? base : `${base} · ${status.signalPercent}%`;
  }, [language, status]);

  return (
    <div className={`network-indicator network-${status.state}`} title={label} role="img" aria-label={label}>
      <span className="network-signal-icon" aria-hidden="true" />
      {status.state === "offline" && <span className="network-offline-cross" aria-hidden="true" />}
    </div>
  );
}
