const QSO_REPEAT_NOTICE_COPY = {
  "zh-CN": {
    agnRepeat: "对方已重发。",
    qrsRepeat: "对方已减速重发。",
    qrsMinimum: "对方已以最低 5 WPM 重发。",
  },
  "zh-TW": {
    agnRepeat: "對方已重發。",
    qrsRepeat: "對方已減速重發。",
    qrsMinimum: "對方已以最低 5 WPM 重發。",
  },
  ja: {
    agnRepeat: "相手局が再送しました。",
    qrsRepeat: "相手局が速度を落として再送しました。",
    qrsMinimum: "相手局が最低速度 5 WPM で再送しました。",
  },
  en: {
    agnRepeat: "The station repeated its message.",
    qrsRepeat: "The station repeated more slowly.",
    qrsMinimum: "The station repeated at the minimum 5 WPM.",
  },
  es: {
    agnRepeat: "La estación repitió el mensaje.",
    qrsRepeat: "La estación repitió más despacio.",
    qrsMinimum: "La estación repitió a la velocidad mínima de 5 WPM.",
  },
  de: {
    agnRepeat: "Die Gegenstation hat die Nachricht wiederholt.",
    qrsRepeat: "Die Gegenstation hat langsamer wiederholt.",
    qrsMinimum: "Die Gegenstation hat mit der Mindestgeschwindigkeit von 5 WPM wiederholt.",
  },
  ru: {
    agnRepeat: "Станция повторила сообщение.",
    qrsRepeat: "Станция повторила медленнее.",
    qrsMinimum: "Станция повторила на минимальной скорости 5 WPM.",
  },
};

export function qsoRepeatNoticeCopy(language) {
  return QSO_REPEAT_NOTICE_COPY[language] ?? QSO_REPEAT_NOTICE_COPY.en;
}
