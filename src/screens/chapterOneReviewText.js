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
        title: "天快黑了",
        paragraphs: [
          "傍晚六点十七分，山后的天色暗了下来。台灯还亮着，表盘上也透着一点光。",
          "这间台站已经很久没人用了。桌上的日志摊着，第一页还没写过通联记录。",
        ],
        caption: "开场的空台站：台灯、设备和摊开的日志。",
        next: "走近工作台",
      },
      {
        id: "operator", tab: "值守", asset: "portrait", eyebrow: "18:18 · 新任值守员",
        title: "先写下呼号",
        paragraphs: [
          "你从椅背上取下耳机。关着的显示屏映出你的脸，你看了两眼，才把耳机戴上。",
          "设备是旧主人留下的。你在日志上写下 SIM1OP，又看了一遍，确认没有写错。",
        ],
        caption: "新值守员戴上耳机，准备第一次开台。",
        next: "听听频率",
      },
      {
        id: "call", tab: "呼叫", asset: "illustration", eyebrow: "21.060 MHz · CW",
        title: "先听，再呼叫",
        paragraphs: [
          "耳机里沙沙响着。你听了一会儿，暂时没听到别人的电报。",
          "手指已经放在电键上了。接下来，先发 CQ，再报出自己的呼号 SIM1OP。也不知道今晚会遇到谁。",
        ],
        caption: "玩家坐到电键前，准备呼叫。",
      },
      {
        id: "answer", tab: "回应", asset: "illustration", eyebrow: "18:20 · 信号抵达",
        title: "等一等，听听有没有回应",
        paragraphs: [
          "CQ 发完了。你松开电键，等着耳机里的动静。刚才发报时还顾不上想，现在反倒有点紧张。",
          "要是真有人回答，先听清他的呼号。你把笔放在日志旁，准备随时记下来。",
        ],
        caption: "发完 CQ 后守听，下一步播放收到的电文。",
      },
      {
        id: "log", tab: "第一行", asset: "scene", eyebrow: "18:21 · QSO COMPLETE",
        title: "日志里的第一条通联",
        paragraphs: [
          "时间、对方的呼号，还有 599，都记在第一行里。你从头到尾检查了一遍，才把笔放下。",
          "页角还圈着一个呼号：SIM3RA。你多看了两眼，打算下次开机时留意一下。",
        ],
        caption: "第一条通联已经记下，页角的 SIM3RA 留待下次留意。",
      },
    ],
  },
  "zh-TW": {
    title: "第一次開機", chapter: "第一章", slice: "故事審閱切片", reviewMode: "審閱模式", noSave: "獨立體驗 · 不寫入正式存檔", back: "返回標題", settings: "聲音與設定", viewArt: "查看原圖", closeArt: "關閉原圖", previous: "上一幕", next: "下一幕", restart: "從開場重看", reviewNote: "本切片只演示第一章敘事、美術與一次簡化通聯，不改變任何遊戲進度。", signal: "訊號", receiving: "守聽中", transmitting: "發射中", transcript: "頻率記錄", callAction: "按下電鍵 · 發送 CQ", callAgain: "重聽自己的 CQ", waitAction: "鬆開電鍵 · 守聽頻率", listenAction: "收聽遠方回應", listenAgain: "重聽遠方回應", replyAction: "回報 599 · 送出 73", logAction: "把這次通聯寫進日誌", qsoLogged: "首次通聯已寫入本次切片的臨時日誌", artLabels: { scene: "環境原畫", portrait: "人物原畫", illustration: "劇情原畫" },
    beats: [
      { id: "silence", tab: "靜默", asset: "scene", eyebrow: "18:17 · 山谷臺站", title: "天快黑了", paragraphs: ["傍晚六點十七分，山後的天色暗了下來。檯燈還亮著，錶盤上也透著一點光。", "這間臺站已經很久沒人用了。桌上的日誌攤著，第一頁還沒寫過通聯記錄。"], caption: "開場的空臺站：檯燈、設備和攤開的日誌。", next: "走近工作臺" },
      { id: "operator", tab: "值守", asset: "portrait", eyebrow: "18:18 · 新任值守員", title: "先寫下呼號", paragraphs: ["你從椅背上取下耳機。關著的顯示幕映出你的臉，你看了兩眼，才把耳機戴上。", "設備是舊主人留下的。你在日誌上寫下 SIM1OP，又看了一遍，確認沒有寫錯。"], caption: "新值守員戴上耳機，準備第一次開臺。", next: "聽聽頻率" },
      { id: "call", tab: "呼叫", asset: "illustration", eyebrow: "21.060 MHz · CW", title: "先聽，再呼叫", paragraphs: ["耳機裡沙沙響著。你聽了一會兒，暫時沒聽到別人的電報。", "手指已經放在電鍵上了。接下來，先發 CQ，再報出自己的呼號 SIM1OP。也不知道今晚會遇到誰。"], caption: "玩家坐到電鍵前，準備呼叫。" },
      { id: "answer", tab: "回應", asset: "illustration", eyebrow: "18:20 · 訊號抵達", title: "等一等，聽聽有沒有回應", paragraphs: ["CQ 發完了。你鬆開電鍵，等著耳機裡的動靜。剛才發報時還顧不上想，現在反倒有點緊張。", "要是真有人回答，先聽清他的呼號。你把筆放在日誌旁，準備隨時記下來。"], caption: "發完 CQ 後守聽，下一步播放收到的電文。" },
      { id: "log", tab: "第一行", asset: "scene", eyebrow: "18:21 · QSO COMPLETE", title: "日誌裡的第一條通聯", paragraphs: ["時間、對方的呼號，還有 599，都記在第一行裡。你從頭到尾檢查了一遍，才把筆放下。", "頁角還圈著一個呼號：SIM3RA。你多看了兩眼，打算下次開機時留意一下。"], caption: "第一條通聯已經記下，頁角的 SIM3RA 留待下次留意。" },
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
