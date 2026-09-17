export const VISUAL_NOVEL_TEXT = {
  "zh-CN": { narrator: "旁白", next: "继续", reveal: "显示完整台词", auto: "自动", history: "回看", hide: "隐藏界面", restore: "显示界面", close: "关闭", notes: "任务记录", empty: "读过的台词会留在这里。", hint: "点击对白 / 空格 继续", boundary: "自动阅读已停在本段结尾，请手动继续。" },
  "zh-TW": { narrator: "旁白", next: "繼續", reveal: "顯示完整台詞", auto: "自動", history: "回看", hide: "隱藏介面", restore: "顯示介面", close: "關閉", notes: "任務紀錄", empty: "讀過的台詞會留在這裡。", hint: "點擊對白 / 空白鍵 繼續", boundary: "自動閱讀已停在本段結尾，請手動繼續。" },
  en: { narrator: "Narrator", next: "Continue", reveal: "Show full line", auto: "Auto", history: "Backlog", hide: "Hide UI", restore: "Show UI", close: "Close", notes: "Mission notes", empty: "Lines you have read will appear here.", hint: "Click dialogue / Space to continue", boundary: "Auto reading has stopped at the end of this scene. Continue manually." },
  ja: { narrator: "ナレーション", next: "次へ", reveal: "全文表示", auto: "オート", history: "履歴", hide: "UIを隠す", restore: "UIを表示", close: "閉じる", notes: "任務記録", empty: "読んだ文章がここに残ります。", hint: "会話をクリック / Spaceで次へ", boundary: "この場面の終わりです。手動で進めてください。" },
  es: { narrator: "Narrador", next: "Continuar", reveal: "Mostrar toda la frase", auto: "Auto", history: "Historial", hide: "Ocultar interfaz", restore: "Mostrar interfaz", close: "Cerrar", notes: "Notas de misión", empty: "Aquí aparecerán las frases que hayas leído.", hint: "Clic en el diálogo / Espacio para continuar", boundary: "La lectura automática se detiene al final de la escena. Continúa manualmente." },
  de: { narrator: "Erzähler", next: "Weiter", reveal: "Ganze Zeile anzeigen", auto: "Auto", history: "Rückblick", hide: "UI ausblenden", restore: "UI einblenden", close: "Schließen", notes: "Missionsnotizen", empty: "Hier erscheinen bereits gelesene Zeilen.", hint: "Dialog anklicken / Leertaste zum Fortfahren", boundary: "Automatisches Lesen endet hier. Bitte manuell fortfahren." },
  ru: { narrator: "Рассказчик", next: "Далее", reveal: "Показать всю реплику", auto: "Авто", history: "История", hide: "Скрыть интерфейс", restore: "Показать интерфейс", close: "Закрыть", notes: "Записи задания", empty: "Здесь появятся прочитанные реплики.", hint: "Щелчок по диалогу / Пробел — далее", boundary: "Авточтение остановлено в конце сцены. Продолжите вручную." },
};

export function visualNovelText(language) {
  return VISUAL_NOVEL_TEXT[language] ?? VISUAL_NOVEL_TEXT.en;
}
