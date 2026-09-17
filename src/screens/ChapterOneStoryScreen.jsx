import { BookOpenText, Check, Radio } from "@phosphor-icons/react";
import { VisualNovelStage } from "../components/VisualNovelStage.jsx";
import { CHAPTER_ONE_BEATS, chapterOneStoryModel } from "../game/chapterOneStory.js";
import { chapterMedia } from "../media/chapterMediaCatalog.js";
import { chapterSceneEffects } from "../media/chapterSceneEffects.js";
import { chapterOneStoryText } from "./chapterOneStoryText.js";
import { chapterOneStoryLabels } from "./chapterOneStoryLabels.js";

export function ChapterOneStoryScreen({ language, save, onAdvance, onEnterStation, onClaim, onBack, onSettings, inputBlocked = false }) {
  const t = chapterOneStoryText(language);
  const labels = chapterOneStoryLabels(language);
  const model = chapterOneStoryModel(save);
  const media = chapterMedia(1);
  const step = model.step;
  const original = t.beats[step];
  const entry = model.candidate;
  const replaceFacts = value => value.replaceAll("SIM1OP", save.callsign)
    .replaceAll("SIM6JP", entry?.callsign ?? "—")
    .replaceAll("599", entry ? `${entry.sent} / ${entry.received}` : "599");
  const beat = { ...original, title: replaceFacts(original.title), paragraphs: original.paragraphs.map(replaceFacts) };
  const completedUtc = entry ? new Date(entry.completedAt).toISOString().slice(11, 16) : null;
  const canPlay = model.playable && !(model.status === "ready" && !entry);

  function primaryAction() {
    if (inputBlocked) return;
    if (model.status === "claimed" || !canPlay) return onBack();
    if (step === 2) return onEnterStation();
    if (step === 4) return onClaim();
    onAdvance(CHAPTER_ONE_BEATS[step + 1]);
  }

  const primaryLabel = model.status === "claimed" || !canPlay ? labels.back
    : step === 2 ? labels.enter : step === 4 ? labels.finish : replaceFacts(beat.next ?? t.next);
  const hasNotes = step === 2 || (entry && step === 4) || !canPlay;

  return <VisualNovelStage language={language} beat={beat} artwork={media[beat.asset]} background={media[beat.asset === "portrait" ? "scene" : beat.asset]}
    sceneLayers={beat.asset === "illustration" ? [] : chapterSceneEffects(1).layers}
    artLabel={t.artLabels[beat.asset]} chapter={t.chapter} title={t.title} mode={labels.mode} safety={model.status === "claimed" ? labels.complete : labels.saved}
    backLabel={labels.back} settingsLabel={t.settings} artViewLabel={t.viewArt} onBack={onBack} onSettings={onSettings}
    primaryLabel={primaryLabel} onPrimary={primaryAction} inputBlocked={inputBlocked}
    context={completedUtc ? `${entry.completedAt.slice(0, 10)} ${completedUtc} UTC · ${entry.callsign}` : step === 2 ? `${beat.eyebrow} · ${save.callsign}` : beat.eyebrow}
    className="chapter-one-story-screen" data-story-chapter="1" data-story-beat={beat.id} data-story-status={model.status} data-story-qso-id={entry?.id ?? ""}>
    {hasNotes && <>
      {step === 2 && <p><Radio size={20} /> {labels.hint}</p>}
      {entry && step === 4 && <section className="chapter-one-logbook is-written" data-testid="chapter-one-real-log">
        <header><BookOpenText size={18} /><span>LOGBOOK / CHAPTER 01</span></header>
        <dl>{[["UTC", `${entry.completedAt.slice(0, 10)} ${completedUtc}`], ["CALL", entry.callsign], ["RST", `${entry.sent} / ${entry.received}`], ["MHz", Number(entry.frequencyMhz).toFixed(3)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p>{labels.recorded}</p><p>{labels.reward}</p>
      </section>}
      {model.status === "claimed" && <p role="status"><Check size={20} /> {labels.complete}</p>}
      {!canPlay && model.status !== "claimed" && <p role="status">{labels.unavailable}</p>}
    </>}
  </VisualNovelStage>;
}
