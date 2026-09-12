const REVIEW_TEXT = {
  "zh-CN": {
    title: "第一次开机",
    chapter: "第一章",
    slice: "故事审阅切片",
    reviewMode: "审阅模式",
    noSave: "独立体验 · 不写入正式存档",
    back: "返回标题",
    settings: "声音与设置",
    viewArt: "查看原图",
    closeArt: "关闭原图",
    previous: "上一幕",
    next: "下一幕",
    restart: "从开场重看",
    reviewNote: "本切片只演示第一章叙事、美术与一次简化通联，不改变任何游戏进度。",
    signal: "信号",
    receiving: "守听中",
    transmitting: "发射中",
    transcript: "频率记录",
    callAction: "按下电键 · 发送 CQ",
    callAgain: "重听自己的 CQ",
    waitAction: "松开电键 · 守听频率",
    listenAction: "收听远方回应",
    listenAgain: "重听远方回应",
    replyAction: "回报 599 · 送出 73",
    logAction: "把这次通联写进日志",
    qsoLogged: "首次通联已写入本次切片的临时日志",
    artLabels: { scene: "环境原画", portrait: "人物原画", illustration: "剧情原画" },
    beats: [
      {
        id: "silence", tab: "静默", asset: "scene", eyebrow: "18:17 · 山谷台站",
        title: "房间已经安静了很久",
        paragraphs: [
          "傍晚六点十七分。山脊后的最后一线光沉下去，屋里只剩表盘和台灯的微光。",
          "这间台站停了很久。一本日志摊在桌中央，第一页仍然空白。",
        ],
        caption: "没有人物的开场，让空台站先成为故事里的第一个角色。",
        next: "走近工作台",
      },
      {
        id: "operator", tab: "值守", asset: "portrait", eyebrow: "18:18 · 新任值守员",
        title: "先把自己的名字写下来",
        paragraphs: [
          "你把耳机从椅背取下。在关闭的显示屏里，你先看见自己的脸。",
          "旧主人留下了设备，却没有替你留下答案。今晚要写下的，不是他的续页，而是你的第一行。",
        ],
        caption: "人物像确认玩家是故事里的新值守员，而不是旧日志主人的替身。",
        next: "写下呼号 SIM1OP",
      },
      {
        id: "call", tab: "呼叫", asset: "illustration", eyebrow: "21.060 MHz · CW",
        title: "第一次把呼号交给夜色",
        paragraphs: [
          "先听。底噪像很远的雨，频率上没有别的信号。",
          "你按下电键，把 SIM1OP 一点一点送到窗外。你不知道谁会回答。",
        ],
        caption: "剧情插画把玩家、电键、空白日志和亮起的电台收进同一个动作。",
      },
      {
        id: "answer", tab: "回应", asset: "illustration", eyebrow: "18:20 · 信号抵达",
        title: "有人停下来，听见了你",
        paragraphs: [
          "CQ 结束后的空白比发报更长。随后，一串陌生而清楚的点划从底噪里抬起头。",
          "那句“听见你了”没有写进标准交换，但它就在 SIM6JP 回送你的呼号之间。",
        ],
        caption: "同一幅插画在回应段落里从“独自发射”转成“正在建立联系”。",
      },
      {
        id: "log", tab: "第一行", asset: "scene", eyebrow: "18:21 · QSO COMPLETE",
        title: "第一页终于有了声音",
        paragraphs: [
          "你把时间、呼号和 599 写进第一行。纸页没有变重，房间却和刚才不一样了。",
          "世界某处确实有人停下来，听见了你。旧日志的页角，还圈着另一个呼号：SIM3RA。",
        ],
        caption: "结尾回到空台站，但打开的日志已经拥有第一条记录，并留下第二章线索。",
      },
    ],
  },
  "zh-TW": {
    title: "第一次開機", chapter: "第一章", slice: "故事審閱切片", reviewMode: "審閱模式", noSave: "獨立體驗 · 不寫入正式存檔", back: "返回標題", settings: "聲音與設定", viewArt: "查看原圖", closeArt: "關閉原圖", previous: "上一幕", next: "下一幕", restart: "從開場重看", reviewNote: "本切片只演示第一章敘事、美術與一次簡化通聯，不改變任何遊戲進度。", signal: "訊號", receiving: "守聽中", transmitting: "發射中", transcript: "頻率記錄", callAction: "按下電鍵 · 發送 CQ", callAgain: "重聽自己的 CQ", waitAction: "鬆開電鍵 · 守聽頻率", listenAction: "收聽遠方回應", listenAgain: "重聽遠方回應", replyAction: "回報 599 · 送出 73", logAction: "把這次通聯寫進日誌", qsoLogged: "首次通聯已寫入本次切片的臨時日誌", artLabels: { scene: "環境原畫", portrait: "人物原畫", illustration: "劇情原畫" },
    beats: [
      { id: "silence", tab: "靜默", asset: "scene", eyebrow: "18:17 · 山谷臺站", title: "房間已經安靜了很久", paragraphs: ["傍晚六點十七分。山脊後的最後一線光沉下去，屋裡只剩錶盤與檯燈的微光。", "這間臺站停了很久。一本日誌攤在桌中央，第一頁仍然空白。"], caption: "沒有角色的開場，讓空臺站先成為故事裡的第一個角色。", next: "走近工作臺" },
      { id: "operator", tab: "值守", asset: "portrait", eyebrow: "18:18 · 新任值守員", title: "先把自己的名字寫下來", paragraphs: ["你把耳機從椅背取下。在關閉的顯示幕裡，你先看見自己的臉。", "舊主人留下設備，卻沒有替你留下答案。今晚要寫的不是他的續頁，而是你的第一行。"], caption: "人物像確認玩家是故事裡的新值守員，而不是舊日誌主人的替身。", next: "寫下呼號 SIM1OP" },
      { id: "call", tab: "呼叫", asset: "illustration", eyebrow: "21.060 MHz · CW", title: "第一次把呼號交給夜色", paragraphs: ["先聽。底噪像很遠的雨，頻率上沒有其他訊號。", "你按下電鍵，把 SIM1OP 一點一點送到窗外。你不知道誰會回答。"], caption: "劇情插畫把玩家、電鍵、空白日誌和亮起的電臺收進同一個動作。" },
      { id: "answer", tab: "回應", asset: "illustration", eyebrow: "18:20 · 訊號抵達", title: "有人停下來，聽見了你", paragraphs: ["CQ 結束後的空白比發報更長。接著，一串陌生而清楚的點劃從底噪裡抬起頭。", "那句「聽見你了」沒有寫進標準交換，但就在 SIM6JP 回送你的呼號之間。"], caption: "同一幅插畫在回應段落裡從「獨自發射」轉成「正在建立聯繫」。" },
      { id: "log", tab: "第一行", asset: "scene", eyebrow: "18:21 · QSO COMPLETE", title: "第一頁終於有了聲音", paragraphs: ["你把時間、呼號與 599 寫進第一行。紙頁沒有變重，房間卻與剛才不同。", "世界某處確實有人停下來，聽見了你。舊日誌的頁角還圈著另一個呼號：SIM3RA。"], caption: "結尾回到空臺站，但打開的日誌已經有第一筆記錄，並留下第二章線索。" },
    ],
  },
  en: {
    title: "First Power-On", chapter: "Chapter One", slice: "Story Review Slice", reviewMode: "Review Mode", noSave: "Standalone · no save data changed", back: "Back to title", settings: "Sound & settings", viewArt: "View full artwork", closeArt: "Close artwork", previous: "Previous beat", next: "Next beat", restart: "Replay from opening", reviewNote: "This slice previews Chapter One's narrative, artwork, and a shortened QSO without changing game progress.", signal: "Signal", receiving: "Listening", transmitting: "Transmitting", transcript: "Frequency record", callAction: "Key the first CQ", callAgain: "Replay your CQ", waitAction: "Release the key · listen", listenAction: "Hear the distant answer", listenAgain: "Replay the answer", replyAction: "Return 599 · send 73", logAction: "Write the contact in the log", qsoLogged: "First contact written to this slice's temporary log", artLabels: { scene: "Environment art", portrait: "Character art", illustration: "Story illustration" },
    beats: [
      { id: "silence", tab: "Silence", asset: "scene", eyebrow: "18:17 · VALLEY STATION", title: "The room has been quiet for a long time", paragraphs: ["At 18:17, the last light drops behind the ridge. Only the meter and desk lamp remain.", "The station has been off duty for a long time. A logbook lies open at an empty first line."], caption: "An unoccupied station becomes the story's first character.", next: "Approach the desk" },
      { id: "operator", tab: "Operator", asset: "portrait", eyebrow: "18:18 · NEW OPERATOR", title: "Write your own name first", paragraphs: ["You lift the headphones from the chair. In the dark display, the first face you see is your own.", "The old operator left equipment, not answers. Tonight's line will belong to you."], caption: "The portrait establishes a new operator, not an imitation of the old logbook's owner.", next: "Write callsign SIM1OP" },
      { id: "call", tab: "Call", asset: "illustration", eyebrow: "21.060 MHz · CW", title: "Give your callsign to the night", paragraphs: ["Listen first. The noise is like distant rain; nobody else is on frequency.", "You press the key and send SIM1OP beyond the window, one element at a time."], caption: "The player, key, blank log, and powered radio share a single action." },
      { id: "answer", tab: "Answer", asset: "illustration", eyebrow: "18:20 · SIGNAL FOUND", title: "Someone stops and hears you", paragraphs: ["The gap after CQ feels longer than the call. Then a clear, unfamiliar rhythm rises from the noise.", "“I hear you” is not in the standard exchange, but it lives between the letters of SIM6JP returning your call."], caption: "The same illustration shifts from solitary transmission to a connection being made." },
      { id: "log", tab: "First line", asset: "scene", eyebrow: "18:21 · QSO COMPLETE", title: "The first page finally has a voice", paragraphs: ["You write the time, callsign, and 599 on the first line. The paper weighs the same; the room does not.", "Somewhere, somebody stopped and heard you. Another callsign is circled at the old log's edge: SIM3RA."], caption: "The ending returns to the station with a completed first line and a lead into Chapter Two." },
    ],
  },
};

function englishVariant(overrides) {
  return { ...REVIEW_TEXT.en, ...overrides, artLabels: { ...REVIEW_TEXT.en.artLabels, ...overrides.artLabels } };
}

REVIEW_TEXT.ja = englishVariant({
  title: "初めての電源", chapter: "第1章", slice: "ストーリーレビュー", reviewMode: "レビューモード", noSave: "独立体験 · セーブデータは変更しません", back: "タイトルへ", settings: "音と設定", viewArt: "原画を見る", closeArt: "原画を閉じる", previous: "前の場面", next: "次の場面", restart: "冒頭から見る", reviewNote: "第1章の物語・原画・短縮QSOを確認する独立モードです。進行状況は変わりません。", receiving: "受信中", transmitting: "送信中", transcript: "周波数ログ", callAction: "電鍵で最初の CQ", callAgain: "CQをもう一度聞く", waitAction: "電鍵を離して受信", listenAction: "遠方の応答を聞く", listenAgain: "応答をもう一度聞く", replyAction: "599 と 73 を返す", logAction: "交信をログに記す", qsoLogged: "初交信を一時ログに記録しました", artLabels: { scene: "環境原画", portrait: "人物原画", illustration: "物語原画" },
});

REVIEW_TEXT.es = englishVariant({
  title: "Primer encendido", chapter: "Capítulo uno", slice: "Muestra narrativa", reviewMode: "Modo de revisión", noSave: "Independiente · no modifica partidas", back: "Volver al título", settings: "Sonido y ajustes", viewArt: "Ver arte completo", closeArt: "Cerrar arte", previous: "Escena anterior", next: "Escena siguiente", restart: "Repetir desde el inicio", reviewNote: "Esta muestra presenta la narrativa, el arte y un QSO abreviado del capítulo uno sin cambiar el progreso.", receiving: "Escuchando", transmitting: "Transmitiendo", transcript: "Registro de frecuencia", callAction: "Enviar el primer CQ", callAgain: "Repetir tu CQ", waitAction: "Soltar la llave · escuchar", listenAction: "Escuchar la respuesta", listenAgain: "Repetir respuesta", replyAction: "Responder 599 · enviar 73", logAction: "Anotar el contacto", qsoLogged: "Primer contacto anotado en el registro temporal", artLabels: { scene: "Arte de entorno", portrait: "Arte de personaje", illustration: "Ilustración narrativa" },
});

REVIEW_TEXT.de = englishVariant({
  title: "Erstes Einschalten", chapter: "Kapitel eins", slice: "Story-Vorschau", reviewMode: "Prüfmodus", noSave: "Eigenständig · keine Spielstände geändert", back: "Zum Titel", settings: "Ton & Einstellungen", viewArt: "Vollbild ansehen", closeArt: "Bild schließen", previous: "Vorige Szene", next: "Nächste Szene", restart: "Von vorn ansehen", reviewNote: "Diese Vorschau zeigt Erzählung, Grafik und ein verkürztes QSO aus Kapitel eins, ohne den Spielstand zu ändern.", receiving: "Empfang", transmitting: "Senden", transcript: "Frequenzprotokoll", callAction: "Ersten CQ geben", callAgain: "CQ wiederholen", waitAction: "Taste lösen · hören", listenAction: "Ferne Antwort hören", listenAgain: "Antwort wiederholen", replyAction: "599 und 73 zurückgeben", logAction: "Kontakt ins Log schreiben", qsoLogged: "Erstkontakt im temporären Log notiert", artLabels: { scene: "Umgebungsgrafik", portrait: "Figurenporträt", illustration: "Storyillustration" },
});

REVIEW_TEXT.ru = englishVariant({
  title: "Первое включение", chapter: "Глава первая", slice: "Просмотр истории", reviewMode: "Режим просмотра", noSave: "Автономно · сохранения не меняются", back: "К заголовку", settings: "Звук и настройки", viewArt: "Открыть иллюстрацию", closeArt: "Закрыть иллюстрацию", previous: "Предыдущая сцена", next: "Следующая сцена", restart: "Смотреть сначала", reviewNote: "Этот фрагмент показывает сюжет, иллюстрации и сокращённый QSO первой главы, не меняя прогресс.", receiving: "Приём", transmitting: "Передача", transcript: "Запись частоты", callAction: "Передать первый CQ", callAgain: "Повторить свой CQ", waitAction: "Отпустить ключ · слушать", listenAction: "Принять далёкий ответ", listenAgain: "Повторить ответ", replyAction: "Ответить 599 · передать 73", logAction: "Записать связь в журнал", qsoLogged: "Первая связь внесена во временный журнал", artLabels: { scene: "Фон", portrait: "Портрет", illustration: "Сюжетная иллюстрация" },
});

export const CHAPTER_ONE_REVIEW_LANGUAGES = Object.freeze([
  "zh-CN", "zh-TW", "ja", "en", "es", "de", "ru",
]);

export function chapterOneReviewText(language) {
  return REVIEW_TEXT[language] ?? REVIEW_TEXT.en;
}
