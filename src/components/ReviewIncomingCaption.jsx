import { useId } from "react";
import { explainReviewIncoming } from "../qso/reviewIncomingCaption.js";

const COPY = {
  "zh-CN": { title: "审阅辅助 · 对方电文", hide: "收起", show: "显示", waiting: "等待对方发报", receiving: "正在发送", received: "最近一段电文", paused: "播放已暂停 / 待重试", hint: "对方开始发送后，这里才会出现内容。", glossary: "缩写释义（不是逐字译文）", note: "临时审阅提示，可随时收起。", assisted: "本次已使用文字辅助，不计独立守听。" },
  "zh-TW": { title: "審閱輔助 · 對方電文", hide: "收起", show: "顯示", waiting: "等待對方發報", receiving: "正在發送", received: "最近一段電文", paused: "播放已暫停 / 待重試", hint: "對方開始發送後，這裡才會出現內容。", glossary: "縮寫釋義（不是逐字譯文）", note: "臨時審閱提示，可隨時收起。", assisted: "本次已使用文字輔助，不計獨立守聽。" },
  en: { title: "Review aid · Incoming CW", hide: "Hide", show: "Show", waiting: "Waiting for a transmission", receiving: "Transmitting", received: "Latest transmission", paused: "Playback paused / retry pending", hint: "Text appears only when incoming playback starts.", glossary: "Abbreviation glossary (not a word-for-word translation)", note: "Temporary review aid; hide at any time.", assisted: "Text assistance used; not an independent watch." },
};

export function ReviewIncomingCaption({ language, text = "", status = "waiting", expanded = true, onToggle, assisted = false }) {
  const t = COPY[language] ?? COPY.en;
  const contentId = useId();
  return <aside className="review-incoming-caption" data-testid="review-incoming-caption" data-status={text ? status : "waiting"} aria-label={t.title}>
    <header><strong>{t.title}</strong><button type="button" data-action="toggle-review-caption" aria-expanded={expanded} aria-controls={contentId} onClick={onToggle}>{expanded ? t.hide : t.show}</button></header>
    {expanded && <div id={contentId} className="review-incoming-body">
      <span className="review-incoming-status" role="status">{text ? (t[status] ?? t.received) : t.waiting}</span>
      {text ? <><p className="review-incoming-text" data-testid="review-incoming-text">{text}</p><span className="review-incoming-label">{t.glossary}</span><ul data-testid="review-incoming-meaning">{explainReviewIncoming(text, language).map(line => <li key={line}>{line}</li>)}</ul></> : <p>{t.hint}</p>}
      <small>{assisted ? t.assisted : t.note}</small>
    </div>}
  </aside>;
}
