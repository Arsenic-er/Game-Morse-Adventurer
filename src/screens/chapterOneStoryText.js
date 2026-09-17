import { chapterOneReviewText } from "./chapterOneReviewText.js";

// Formal play resumes only after a real QSO has been completed and saved.
const COMPLETED_CONTACT = {
  "zh-CN": { title: "第一次通联，成了", paragraphs: ["最后一串点划停了，耳机里又只剩沙沙声。你这才发觉，刚才一直绷着肩膀。", "你又核对了一遍对方的呼号：SIM6JP。第一次通联就这样完成了，你还有点没回过神。"] },
  "zh-TW": { title: "第一次通聯，成了", paragraphs: ["最後一串點劃停了，耳機裡又只剩沙沙聲。你這才發覺，剛才一直繃著肩膀。", "你又核對了一遍對方的呼號：SIM6JP。第一次通聯就這樣完成了，你還有點沒回過神。"] },
};

// The approved Chinese/English copy is shared with the independent review.
// Production adds full narrative localization where the review used English.
const NARRATIVE = {
  ja: [
    ["静けさ", "この部屋は、長いあいだ静かだった", "18:17 · 谷の無線室", ["夕方六時十七分。尾根の向こうに最後の光が沈み、メーターと卓上灯だけが残った。", "長く使われていなかった無線室。机の中央には、最初の行が空白のログブックが開いている。"], "机に近づく"],
    ["運用者", "まず、自分の名前を書く", "18:18 · 新しい運用者", ["椅子からヘッドホンを取り上げる。消えた画面に、まず自分の顔が映った。", "前の運用者が残したのは設備であって、答えではない。今夜の一行は、あなた自身のものになる。"], "呼出符号 SIM1OP を記す"],
    ["呼びかけ", "夜に呼出符号を届ける", "21.060 MHz · CW", ["まず聴く。雑音は遠い雨のようで、ほかの信号はない。", "電鍵を押し、SIM1OP を一点一画ずつ窓の外へ送る。誰が答えるかは、まだわからない。"]],
    ["応答", "誰かが足を止め、聴いてくれた", "信号が届く", ["CQ のあとの間は、送信よりも長く感じられた。やがて、見知らぬ明瞭なリズムが雑音から浮かび上がる。", "「聞こえたよ」は定型の交信文にはない。それでも、SIM6JP があなたの呼出符号を返す、その文字のあいだにあった。"]],
    ["最初の行", "最初のページに、声が宿る", "QSO COMPLETE", ["時刻と呼出符号、599 を最初の行に記す。紙の重さは変わらないのに、部屋はさっきとは違っていた。", "世界のどこかで、誰かが足を止めて聴いてくれた。古いログの端には、別の呼出符号が丸で囲まれている。SIM3RA。"]],
  ],
  es: [
    ["Silencio", "La habitación lleva mucho tiempo en silencio", "18:17 · ESTACIÓN DEL VALLE", ["A las seis y diecisiete, la última luz se esconde tras la cresta. Solo quedan el medidor y la lámpara.", "La estación lleva mucho tiempo sin guardia. En el centro de la mesa, el registro está abierto por una primera línea vacía."], "Acercarte a la mesa"],
    ["Operador", "Escribe primero tu propio nombre", "18:18 · NUEVO OPERADOR", ["Levantas los auriculares de la silla. En la pantalla apagada ves primero tu propio rostro.", "El antiguo operador dejó equipos, no respuestas. La línea de esta noche te pertenecerá a ti."], "Escribir el indicativo SIM1OP"],
    ["Llamada", "Entrega tu indicativo a la noche", "21.060 MHz · CW", ["Escucha primero. El ruido parece lluvia lejana; no hay otra señal en la frecuencia.", "Pulsas la llave y envías SIM1OP más allá de la ventana, elemento a elemento. No sabes quién responderá."]],
    ["Respuesta", "Alguien se detiene y te escucha", "LLEGA UNA SEÑAL", ["El silencio tras el CQ parece más largo que la llamada. Entonces surge del ruido un ritmo claro y desconocido.", "«Te escucho» no figura en el intercambio estándar, pero está entre las letras con las que SIM6JP devuelve tu indicativo."]],
    ["Primera línea", "La primera página por fin tiene voz", "QSO COMPLETE", ["Anotas la hora, el indicativo y 599 en la primera línea. El papel pesa lo mismo; la habitación ya no es igual.", "En algún lugar, alguien se detuvo para escucharte. En el borde del viejo registro hay otro indicativo marcado: SIM3RA."]],
  ],
  de: [
    ["Stille", "Der Raum ist seit Langem still", "18:17 · TALSTATION", ["Um 18:17 Uhr verschwindet das letzte Licht hinter dem Bergrücken. Nur Messgerät und Schreibtischlampe leuchten noch.", "Die Station war lange unbesetzt. Mitten auf dem Tisch liegt ein offenes Logbuch mit einer leeren ersten Zeile."], "An den Tisch treten"],
    ["Funker", "Schreibe zuerst deinen eigenen Namen", "18:18 · NEUER FUNKER", ["Du nimmst den Kopfhörer vom Stuhl. Im dunklen Bildschirm siehst du zuerst dein eigenes Gesicht.", "Der frühere Funker hat Geräte hinterlassen, keine Antworten. Die heutige Zeile wird dir gehören."], "Rufzeichen SIM1OP eintragen"],
    ["Anruf", "Gib dein Rufzeichen in die Nacht", "21.060 MHz · CW", ["Zuerst hören. Das Rauschen klingt wie ferner Regen; kein anderes Signal ist auf der Frequenz.", "Du drückst die Taste und sendest SIM1OP hinaus, Punkt für Punkt, Strich für Strich. Du weißt nicht, wer antworten wird."]],
    ["Antwort", "Jemand hält inne und hört dich", "EIN SIGNAL TRIFFT EIN", ["Die Pause nach dem CQ scheint länger als der Ruf. Dann steigt ein klarer, fremder Rhythmus aus dem Rauschen auf.", "„Ich höre dich“ steht nicht im Standardaustausch. Doch es liegt zwischen den Buchstaben, mit denen SIM6JP dein Rufzeichen zurückgibt."]],
    ["Erste Zeile", "Die erste Seite hat endlich eine Stimme", "QSO COMPLETE", ["Du trägst Zeit, Rufzeichen und 599 in die erste Zeile ein. Das Papier wiegt genauso viel wie zuvor; der Raum fühlt sich anders an.", "Irgendwo hat jemand innegehalten und dich gehört. Am Rand des alten Logs ist ein weiteres Rufzeichen eingekreist: SIM3RA."]],
  ],
  ru: [
    ["Тишина", "В комнате давно тихо", "18:17 · СТАНЦИЯ В ДОЛИНЕ", ["В шесть семнадцать вечера последний свет скрывается за хребтом. Горят лишь шкала прибора и настольная лампа.", "На этой станции давно не дежурили. Посреди стола раскрыт журнал с пустой первой строкой."], "Подойти к столу"],
    ["Оператор", "Сначала запиши своё имя", "18:18 · НОВЫЙ ОПЕРАТОР", ["Ты снимаешь наушники со стула. В тёмном экране первым видишь собственное лицо.", "Прежний оператор оставил оборудование, но не ответы. Сегодняшняя строка будет твоей."], "Записать позывной SIM1OP"],
    ["Вызов", "Отдай свой позывной ночи", "21.060 MHz · CW", ["Сначала слушай. Шум похож на далёкий дождь; других сигналов на частоте нет.", "Ты нажимаешь ключ и отправляешь SIM1OP за окно, точку за точкой, тире за тире. Кто ответит, пока неизвестно."]],
    ["Ответ", "Кто-то остановился и услышал тебя", "ПРИШЁЛ СИГНАЛ", ["Пауза после CQ кажется длиннее самого вызова. Затем из шума поднимается ясный незнакомый ритм.", "«Я тебя слышу» не входит в стандартный обмен, но эти слова словно звучат между буквами, которыми SIM6JP возвращает твой позывной."]],
    ["Первая строка", "У первой страницы появился голос", "QSO COMPLETE", ["Ты записываешь время, позывной и 599 в первую строку. Бумага весит столько же, но комната уже другая.", "Где-то в мире кто-то остановился и услышал тебя. На краю старого журнала обведён ещё один позывной: SIM3RA."]],
  ],
};

export function chapterOneStoryText(language) {
  const base = chapterOneReviewText(language);
  if (COMPLETED_CONTACT[language]) return { ...base, beats: base.beats.map(beat => beat.id === "answer" ? { ...beat, ...COMPLETED_CONTACT[language] } : beat) };
  const localized = NARRATIVE[language];
  if (!localized) return base;
  return { ...base, beats: base.beats.map((beat, index) => {
    const [tab, title, eyebrow, paragraphs, next] = localized[index];
    return { ...beat, tab, title, eyebrow, paragraphs, next };
  }) };
}
