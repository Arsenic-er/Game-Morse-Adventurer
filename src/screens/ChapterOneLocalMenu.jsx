import { useState } from "react";
import { ArrowCounterClockwise, BookOpenText, GearSix, Play } from "@phosphor-icons/react";
import { chapterOneStoryLabels } from "./chapterOneStoryLabels.js";
import "../chapter-one-local-review.css";

const COPY = {
  "zh-CN": ["本地独立审阅版", "无需联网；试玩进度独立保存，不影响主游戏。", "只看故事与原画", "重新试玩第一章", "清除本审阅版进度并重新开始？主游戏不受影响。", "确认重新开始", "取消", "本次第一章试玩已完成。"],
  "zh-TW": ["本機獨立審閱版", "不需連網；試玩進度獨立儲存，不影響主遊戲。", "只看故事與原畫", "重新試玩第一章", "清除本審閱版進度並重新開始？主遊戲不受影響。", "確認重新開始", "取消", "本次第一章試玩已完成。"],
  en: ["Local review edition", "Works offline. Review progress is separate from the main game.", "Review story and artwork", "Restart Chapter One", "Reset this review's progress? The main game is not affected.", "Confirm restart", "Cancel", "This Chapter One playthrough is complete."],
  ja: ["ローカルレビュー版", "オフライン対応。進行状況は本編とは別に保存されます。", "物語と原画を見る", "第1章をやり直す", "レビュー版の進行状況を消去しますか？本編には影響しません。", "最初から開始", "キャンセル", "今回の第1章は完了しました。"],
  es: ["Edición local de revisión", "Funciona sin conexión. El progreso es independiente del juego principal.", "Revisar historia e ilustraciones", "Reiniciar el capítulo uno", "¿Borrar el progreso de esta revisión? No afecta al juego principal.", "Confirmar reinicio", "Cancelar", "Has completado esta partida del capítulo uno."],
  de: ["Lokale Prüffassung", "Offline nutzbar. Der Fortschritt ist vom Hauptspiel getrennt.", "Geschichte und Bilder ansehen", "Kapitel eins neu beginnen", "Fortschritt dieser Prüffassung löschen? Das Hauptspiel bleibt unverändert.", "Neustart bestätigen", "Abbrechen", "Dieser Durchlauf von Kapitel eins ist abgeschlossen."],
  ru: ["Локальная версия для просмотра", "Работает без сети. Прогресс отделён от основной игры.", "Посмотреть историю и иллюстрации", "Начать первую главу заново", "Сбросить прогресс этой версии? Основная игра не изменится.", "Подтвердить перезапуск", "Отмена", "Это прохождение первой главы завершено."],
};

export function ChapterOneLocalMenu({ language, save, onContinue, onReview, onReset, onSettings, inputBlocked }) {
  const t = COPY[language] ?? COPY.en;
  const labels = chapterOneStoryLabels(language);
  const [confirmReset, setConfirmReset] = useState(false);
  const complete = save?.missionState?.claimedMissionIds?.includes("story-01");
  return <main className="screen chapter-one-local-menu" inert={inputBlocked ? true : undefined} data-testid="chapter-one-local-menu">
    <section>
      <header><span>CHAPTER 01 / OFFLINE REVIEW</span><button onClick={onSettings} aria-label="Settings"><GearSix size={24} /></button></header>
      <h1>{labels.entry}</h1><h2>{t[0]}</h2><p>{t[1]}</p>
      {complete && <p role="status">{t[7]}</p>}
      <div className="chapter-one-local-actions">
        <button data-action="local-review-continue" disabled={complete} onClick={onContinue}><Play size={21} />{labels.resume}</button>
        <button data-action="local-review-art" onClick={onReview}><BookOpenText size={21} />{t[2]}</button>
        <button data-action="local-review-reset" onClick={() => setConfirmReset(true)}><ArrowCounterClockwise size={21} />{t[3]}</button>
      </div>
      {confirmReset && <aside role="group" aria-label={t[4]}><p>{t[4]}</p><button data-action="local-review-confirm-reset" onClick={onReset}>{t[5]}</button><button onClick={() => setConfirmReset(false)}>{t[6]}</button></aside>}
      <small>SIM1OP · Z / X · 18 WPM · Space / F2 / F3</small>
    </section>
  </main>;
}
