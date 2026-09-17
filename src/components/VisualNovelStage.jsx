import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpenText, Eye, GearSix, X } from "@phosphor-icons/react";
import { visualNovelText } from "../screens/visualNovelText.js";

function NovelDialog({ beat, t, paused, primaryLabel, onPrimary, onRead, onHistory, onHide, onNotes, hasNotes, primaryAction }) {
  const [line, setLine] = useState(0);
  const [visible, setVisible] = useState(0);
  const [auto, setAuto] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const actionLock = useRef(false);
  const characters = Array.from(beat.paragraphs[line]);
  const complete = reducedMotion || visible >= characters.length;
  const lastLine = line === beat.paragraphs.length - 1;
  const ready = complete && lastLine;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(query.matches); if (query.matches) setAuto(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || complete) return undefined;
    const timer = setTimeout(() => setVisible(count => count + 1), 28);
    return () => clearTimeout(timer);
  }, [paused, complete, visible]);

  useEffect(() => {
    if (complete) onRead({ id: `${beat.id}:${line}`, title: beat.title, text: beat.paragraphs[line] });
  }, [complete, beat.id, beat.title, beat.paragraphs, line, onRead]);

  // Auto only reads lines. Entering the keyer, playing a transmission, claiming
  // rewards, and crossing story boundaries always require an explicit action.
  useEffect(() => {
    if (!auto || paused || !complete || lastLine || reducedMotion) return undefined;
    const timer = setTimeout(() => { setLine(value => value + 1); setVisible(0); }, Math.max(2000, characters.length * 65));
    return () => clearTimeout(timer);
  }, [auto, paused, complete, lastLine, reducedMotion, characters.length]);

  const next = useCallback(() => {
    if (paused || actionLock.current) return;
    actionLock.current = true;
    requestAnimationFrame(() => { actionLock.current = false; });
    if (!complete) return setVisible(characters.length);
    if (!lastLine) { setLine(value => Math.min(beat.paragraphs.length - 1, value + 1)); setVisible(0); return; }
    onPrimary();
  }, [paused, complete, characters.length, lastLine, beat.paragraphs.length, onPrimary]);

  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || paused) return;
      // Suppress native repeated Enter clicks too, including on a focused button.
      if (event.repeat && (event.code === "Space" || event.key === "Enter")) { event.preventDefault(); return; }
      if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a, [contenteditable]")) return;
      if (event.code === "Space" || event.key === "Enter") { event.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, paused]);

  return <section className="vn-dialogue" aria-label={t.narrator} data-vn-line={line} data-vn-complete={complete} data-vn-ready={ready}>
    <div className="vn-nameplate"><span />{t.narrator}</div>
    <button className="vn-line" onClick={next} disabled={paused} aria-label={`${beat.paragraphs[line]} — ${complete ? t.next : t.reveal}`}>
      <span className="vn-line-text" aria-hidden="true">{complete ? beat.paragraphs[line] : characters.slice(0, visible).join("")}</span>
      <span className={`vn-advance-mark ${complete ? "is-ready" : ""}`} aria-hidden="true">◆</span>
    </button>
    <div className="vn-quick-menu">
      <span className="vn-input-hint">{t.hint}</span>
      <div className="vn-tools">
        <button data-action="vn-auto" aria-pressed={auto} onClick={() => setAuto(value => !value)} disabled={reducedMotion}>{t.auto}<i /></button>
        <button data-action="vn-history" onClick={onHistory}>{t.history}</button>
        {hasNotes && <button data-action="vn-notes" onClick={onNotes}>{t.notes}</button>}
        <button data-action="vn-hide" onClick={onHide}>{t.hide}</button>
      </div>
      <button className="vn-primary" data-action={primaryAction} onClick={next} disabled={paused}>
        {ready ? primaryLabel : t.next}<span aria-hidden="true">▸</span>
      </button>
    </div>
    {auto && ready && <span className="vn-sr-only" role="status">{t.boundary}</span>}
  </section>;
}

export function VisualNovelStage({ language, beat, artwork, background, artLabel, chapter, title, mode, safety, backLabel, settingsLabel, artViewLabel, onBack, onSettings, primaryLabel, onPrimary, inputBlocked = false, busy = false, children, context, toolbar, overlay, sceneLayers = [], className = "", primaryAction = "chapter-one-primary", ...data }) {
  const t = visualNovelText(language);
  const [modal, setModal] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState(true);
  const [history, setHistory] = useState([]);
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const restoreRef = useRef(null);
  const hideRef = useRef(null);
  const onRead = useCallback(entry => setHistory(current => current.some(item => item.id === `${language}:${entry.id}`)
    ? current : [...current, { ...entry, id: `${language}:${entry.id}`, language }]), [language]);
  const open = (name, event) => { openerRef.current = event.currentTarget; setModal(name); };
  const close = useCallback(() => { setModal(null); requestAnimationFrame(() => openerRef.current?.focus()); }, []);
  const showUI = useCallback(() => { setHidden(false); requestAnimationFrame(() => hideRef.current?.querySelector('[data-action="vn-hide"]')?.focus()); }, []);

  useEffect(() => {
    const focus = () => setActive(!document.hidden);
    const blur = () => setActive(false);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    focus();
    return () => { document.removeEventListener("visibilitychange", focus); window.removeEventListener("focus", focus); window.removeEventListener("blur", blur); };
  }, []);

  useEffect(() => { if (hidden) restoreRef.current?.focus(); }, [hidden]);

  useEffect(() => {
    if (!modal && !hidden) return undefined;
    if (modal) panelRef.current?.querySelector("button")?.focus();
    const onKey = event => {
      if (inputBlocked) return;
      if (event.key === "Escape") { event.preventDefault(); modal ? close() : showUI(); }
      if (event.key === "Tab" && modal) {
        const elements = [...panelRef.current.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, hidden, inputBlocked, close, showUI]);

  return <main className={`screen visual-novel-screen ${className}`} {...data} inert={inputBlocked ? true : undefined}>
    <figure className="vn-art" aria-label={artLabel}>
      <img key={background} className="vn-background" src={background} alt={beat.asset === "portrait" ? "" : artLabel} />
      {sceneLayers.length > 0 && <div className="vn-atmosphere" aria-hidden="true" style={{ "--chapter-scene": `url(${background})` }}>
        {sceneLayers.map(layer => <div key={layer} className={`chapter-scene-layer chapter-scene-${layer}`} />)}
      </div>}
      {beat.asset === "portrait" && <img className="vn-portrait" src={artwork} alt={artLabel} />}
    </figure>
    <div className="vn-shade" aria-hidden="true" />
    <div className="vn-interface" hidden={hidden} inert={modal ? true : undefined} ref={hideRef}>
      <header className="vn-header">
        <button className="chapter-one-review-back" onClick={onBack}><ArrowLeft size={18} /><span>{backLabel}</span></button>
        <div className="vn-chapter"><span>{chapter} · {mode}</span><strong>{title}</strong></div>
        <span className="vn-safety">{safety}</span>
        {toolbar}
        <button className="chapter-one-art-open" onClick={event => open("art", event)} aria-label={artViewLabel} title={artViewLabel}><Eye size={21} /></button>
        <button className="chapter-one-review-settings" onClick={onSettings} aria-label={settingsLabel}><GearSix size={21} /></button>
      </header>
      <div className="vn-scene-heading" key={beat.id}><span>{context ?? beat.eyebrow}</span><h1>{beat.title}</h1></div>
      {overlay}
      <NovelDialog key={`${language}:${beat.id}`} beat={beat} t={t} paused={inputBlocked || busy || !!modal || hidden || !active}
        primaryLabel={primaryLabel} onPrimary={onPrimary} onRead={onRead} hasNotes={!!children} primaryAction={primaryAction}
        onHistory={event => open("history", event)} onNotes={event => open("notes", event)} onHide={() => setHidden(true)} />
    </div>
    {hidden && <button ref={restoreRef} className="vn-restore" onClick={showUI}><Eye size={18} />{t.restore}</button>}
    {modal && <div className={`vn-modal ${modal === "art" ? "chapter-one-art-lightbox" : ""}`} role="dialog" aria-modal="true" aria-label={modal === "art" ? artViewLabel : modal === "history" ? t.history : t.notes} ref={panelRef}>
      <header><span>{modal === "art" ? artLabel : modal === "history" ? t.history : t.notes}</span><button onClick={close} aria-label={t.close}><X size={23} /></button></header>
      {modal === "art" ? <img src={artwork} alt={artLabel} /> : <div className="vn-modal-content">
        {modal === "notes" ? children : history.filter(entry => entry.language === language).length ? history.filter(entry => entry.language === language).map(entry => <article className="vn-history-entry" key={entry.id}><span><BookOpenText size={15} />{entry.title} · {t.narrator}</span><p>{entry.text}</p></article>) : <p>{t.empty}</p>}
      </div>}
    </div>}
  </main>;
}
