import { useEffect, useState } from "react";
import { WifiHigh, WifiLow, WifiMedium, WifiX } from "@phosphor-icons/react";

const LABELS = {
  "zh-CN": { good: "网络良好", medium: "网络一般", poor: "网络较差", offline: "无网络" },
  "zh-TW": { good: "網路良好", medium: "網路一般", poor: "網路較差", offline: "無網路" },
  ja: { good: "通信良好", medium: "通信普通", poor: "通信不安定", offline: "オフライン" },
  en: { good: "Network good", medium: "Network medium", poor: "Network poor", offline: "Offline" },
};

function readNetworkState() {
  if (!navigator.onLine) return "offline";
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return "good";
  if (connection.saveData || ["slow-2g", "2g"].includes(connection.effectiveType)) return "poor";
  if (connection.effectiveType === "3g" || (connection.downlink && connection.downlink < 4)) return "medium";
  return "good";
}
export function NetworkIndicator({ language = "en" }) {
  const [state, setState] = useState(readNetworkState);
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const update = () => setState(readNetworkState());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);
  const Icon = state === "good" ? WifiHigh : state === "medium" ? WifiMedium : state === "poor" ? WifiLow : WifiX;
  const label = (LABELS[language] ?? LABELS.en)[state];
  return <div className={`network-indicator network-${state}`} title={label} aria-label={label}><Icon size={30} weight="bold" /><span>{label}</span></div>;
}
