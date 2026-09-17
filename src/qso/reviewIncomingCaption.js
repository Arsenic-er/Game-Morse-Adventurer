// Review-only glossary. Read the actual playback text, never expectedPlayer or
// an NPC profile: unknown words stay visible in the raw text, not invented prose.
export function explainReviewIncoming(text, language = "zh-CN") {
  const raw = String(text ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const english = !language.startsWith("zh");
  const lines = [];
  const add = (cn, en) => lines.push(english ? en : cn);
  const sender = /\bDE ([A-Z0-9/]*\d[A-Z0-9/]*)\b/.exec(raw)?.[1];
  if (sender) add(`发送方：${sender}。`, `Sending station: ${sender}.`);
  if (/\bCQ\b/.test(raw)) add("CQ：普遍呼叫，寻找愿意通联的电台。", "CQ: calling any station for a contact.");
  if (/\bQRZ\??|\bUR CALL\?/.test(raw)) add("请刚才呼叫的电台再报一次呼号。", "Calling station, please repeat your callsign.");
  if (/\bQRS\??/.test(raw)) add("QRS：请慢一点发。", "QRS: please send more slowly.");
  if (/\bAGN\??/.test(raw) || raw === "?") add("没听清，请再发一遍。", "Not copied; please repeat.");
  if (/\bHH\b/.test(raw)) add("HH：前面发错了，接下来更正。", "HH: correcting a sending error.");
  if (/\bR\b/.test(raw)) add("R：收到。", "R: received.");
  const rst = /\b(?:RST )?([1-5][1-9][1-9])\b/.exec(raw)?.[1];
  if (rst) add(`对方给你的信号报告：${rst}。`, `Their signal report for you: ${rst}.`);
  const topics = { PWR: ["功率", "power"], QTH: ["地点", "location"], WX: ["天气", "weather"], NAME: ["名字", "name"], AGE: ["年龄", "age"], RIG: ["电台设备", "radio"], ANT: ["天线", "antenna"] };
  for (const [code, [cn, en]] of Object.entries(topics)) {
    if (new RegExp(`\\b${code}\\?`).test(raw)) add(`对方在问你的${cn}，按游戏内资料回答即可。`, `They ask about your ${en}; use your in-game details.`);
    const value = new RegExp(`\\bMY ${code} (.+?)(?= (?:MY|R RST|RST|FB|TNX|73|SK|K)\\b|$)`).exec(raw)?.[1];
    if (value) add(`对方的${cn}：${value}。`, `Their ${en}: ${value}.`);
  }
  if (/\bTNX CALL\b/.test(raw)) add("TNX CALL：谢谢你的呼叫。", "TNX CALL: thanks for calling.");
  else if (/\bTNX\b/.test(raw)) add("TNX：谢谢。", "TNX: thanks.");
  if (/\bFB\b/.test(raw)) add("FB：很好。", "FB: fine business / very good.");
  if (/\b73\b/.test(raw)) add("73：祝好。", "73: best regards.");
  if (/\bSK\b/.test(raw)) add("SK：这次通联结束。", "SK: end of contact.");
  else if (/\bK[N]?\s*$/.test(raw)) add("现在轮到你发送。", "Your turn to transmit.");
  if (!lines.length) add("这段尚无自动释义，请以原始电文为准。", "No glossary match; refer to the raw transmission.");
  if (language === "zh-TW") return lines.map(line => line.replace(/[发电愿联刚报请听对给号问游戏内资气设备线这结现轮参为传]/g, char => ({ 发:"發", 电:"電", 愿:"願", 联:"聯", 刚:"剛", 报:"報", 请:"請", 听:"聽", 对:"對", 给:"給", 号:"號", 问:"問", 游:"遊", 戏:"戲", 内:"內", 资:"資", 气:"氣", 设:"設", 备:"備", 线:"線", 这:"這", 结:"結", 现:"現", 轮:"輪", 参:"參", 为:"為", 传:"傳" })[char]));
  return lines;
}
