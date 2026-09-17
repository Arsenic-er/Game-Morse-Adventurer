import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BookOpenText, CalendarDots, CheckCircle, Coins, Crosshair,
  LockKey, Play, Radio, SealCheck, Trash, X,
} from "@phosphor-icons/react";
import { MAX_ACTIVE_DAILY_MISSIONS, missionBoard, missionSummary } from "../game/missionSystem.js";
import { expeditionReplayAvailable } from "../game/expeditionLifecycle.js";
import { serviceNetReplayAvailable } from "../game/serviceNetRun.js";
import { coordinateRelayReplayAvailable } from "../game/coordinateRelayRun.js";
import { contestReplayAvailable } from "../game/contestRun.js";
import { listeningReplayAvailable } from "../game/listeningRun.js";
import { stormRelayReplayAvailable } from "../game/stormRelayRun.js";
import { nightOperationsReplayAvailable } from "../game/nightOperationsRun.js";
import { finalPromiseReplayAvailable } from "../game/finalPromiseRun.js";
import { lightsEntryModes } from "../game/lightsEventCatalog.js";
import { lightsNarrativeBeat } from "../game/lightsNarrative.js";
import { lightsText } from "./lightsEventText.js";
import { OPEN_STATION_TEXT } from "./openStationText.js";
import { chapterMedia } from "../media/chapterMediaCatalog.js";

const MEDIA_TEXT = {
  "zh-CN": { open: "查看章节素材", close: "收起章节素材", scene: "章节场景", portrait: "人物像", illustration: "剧情插画" },
  "zh-TW": { open: "查看章節素材", close: "收起章節素材", scene: "章節場景", portrait: "人物像", illustration: "劇情插畫" },
  ja: { open: "チャプター素材を見る", close: "チャプター素材を閉じる", scene: "チャプター場面", portrait: "人物ポートレート", illustration: "物語イラスト" },
  en: { open: "View chapter media", close: "Close chapter media", scene: "Chapter scene", portrait: "Character portrait", illustration: "Story illustration" },
  es: { open: "Ver recursos del capítulo", close: "Cerrar recursos", scene: "Escena del capítulo", portrait: "Retrato", illustration: "Ilustración narrativa" },
  de: { open: "Kapitelmedien ansehen", close: "Kapitelmedien schließen", scene: "Kapitelszene", portrait: "Porträt", illustration: "Storyillustration" },
  ru: { open: "Открыть материалы главы", close: "Закрыть материалы", scene: "Сцена главы", portrait: "Портрет", illustration: "Сюжетная иллюстрация" },
};

const TEXT = {
  "zh-CN": {
    title: "任务中心", kicker: "未完成的日志", story: "主线日志", daily: "常规委托", chapter: "章节", progress: "进度",
    available: "可接受", active: "进行中", ready: "可领取", locked: "未解锁", claimed: "已完成",
    accept: "接受任务", claim: "领取奖励", abandon: "放弃任务", close: "返回管理中心", money: "金钱", tp: "技术点",
    storyProgress: "日志进度", dailyNote: "每天根据呼号生成三份委托；最多同时进行两份，已接受的不会在换日时消失。",
    limit: "常规委托栏已满", targetCallsign: "优先监听", propagation: "只有当前传播允许时，目标台才会回应。",
    brief: "任务简报", debrief: "结算记录", contractClues: "通联合同", requiredPropagation: "传播", requiredTopics: "必需话题", recoveryActions: "恢复操作",
    relationship: "目标台关系", completedQsos: "已完成 QSO", weakSignalRecoveries: "弱信号恢复", launchEvent: "进入活动台", annualReplay: "年度复刻", practiceRun: "活动练习", launchExpedition: "进入山丘临时台", launchQslStory: "进入QSL调查", launchServiceNet: "进入公共服务台网", launchCoordinateRelay: "进入坐标中继", launchContest: "进入五分钟短赛", launchListening: "进入静默监听",
    story01Title: "第一次开机", story01Description: "陌生人的一句“听见你了”，让这间沉默的房间重新有了声音。", story01Objective: "完成并保存第一次 QSO。",
    story02Title: "纸页上的呼号", story02Description: "褪色日志里圈着 SIM3RA。对方是否还记得这本没有写完的日志？", story02Objective: "与 SIM3RA 完成 QSO，并在通联中至少使用一次 AGN K。",
    story03Title: "不同的节奏", story03Description: "有人谨慎，有人急促，也有人需要更慢的速度。先学会听见差异。", story03Objective: "完成来自三种不同操作员风格的 QSO。",
    story01Brief: "屋里很安静。发出第一遍 CQ，把你自己的呼号送到看不见的远方。", story01Debrief: "日志的第一行不再空白。世界某处确实有人停下来，听见了你。",
    story02Brief: "旧日志只留下 SIM3RA 和一段缺口。若信号没抄全，就用 AGN K 请对方再发一次。", story02Debrief: "一次请求重发没有切断联系，反而让那张旧纸终于等到了完整的回音。",
    story03Brief: "别只听点划，也听每个人停顿、确认和等待的方式。完成三种不同风格的通联。", story03Debrief: "三个不同的节奏，背后是三个不同的人。电波开始不再只是分数和字符。",
    story04Title: "雨幕另一边", story04Description: "雨声盖过窗外，SIM2DX 的天气报告在衰落中断断续续。", story04Objective: "在 P0–P2 与 SIM2DX 完成 WEATHER 交换，并用 AGN 或 QRS 从误抄中恢复。", story04Brief: "守住微弱信号，问清天气；听不清就用 AGN，请求过快就用 QRS。不要让雨幕吞掉消息。", story04Debrief: "天气报告被完整抄下。隔着雨和噪声，两间遥远的房间短暂地亮在同一条电波上。",
    story05Title: "空中灯火", story05Description: "五月的纪念呼号在夜色里亮起。SORA 把 SIM5LT 的电键交到你手中。", story05Objective: "完成空中灯火主线活动并至少取得基础评级。", story05Brief: "先追呼 SORA 操作的 SIM5LT，完成交换后接管活动台，在八分钟内从 pile-up 中逐个抄出呼号、RST 与地区。", story05Debrief: "最后一个 73 消失在底噪里。六个方向的灯火没有同处一地，却在你的日志上连成了同一晚。",
    story06Title: "山丘临时台", story06Description: "借来的电台、线天线与电池等待被带上风中的山丘。", story06Objective: "完成包含 QTH、PWR 与 ANT 的远征通联。", story06Brief: "选择一处虚构山丘，正确架设借用套件并在电量耗尽前完成交换。", story06Debrief: "收起线天线时，远方的回应已成为山风之外的另一段记忆。",
    story07Title: "QSL疑云", story07Description: "同一张山丘QSL留下两种叙述。SORA愿意在空中重新核对。", story07Objective: "发送QSL澄清电文，抄收SORA回应并作出最终判断。", story07Brief: "比对双方记录，以QSL案件编号和本台呼号请求澄清；需要时使用AGN或QRS。", story07Debrief: "事实被重新核对，而最后的判断由你留在人物档案中。",
    story08Title: "城市停电", story08Description: "一场虚构停电演练让三条公共服务报文同时涌入 SIM8PS。", story08Objective: "签到后按优先级确认三条报文的编号与优先级。", story08Brief: "这是虚构演练。抄收冻结报文，按优先级发送 ACK；需要时用 AGN 或 QRS。", story08Debrief: "三条回执按序落入日志。没有真实调度，只有清楚、克制的通信练习。",
    story09Title: "坐标", story09Description: "一条虚构像素网格报文必须在两个台站之间原样抵达。", story09Objective: "读回网格、UTC、人数和校验，再完成双台站中继。", story09Brief: "从 SIM9CR 抄收冻结报文，纠正硬字段后将同一规范报文中继给 SIM9RL。", story09Debrief: "两个台站和一条完整报文被同一组校验字段连接起来。",
    story10Title: "空中的拥挤", story10Description: "SIM0CT 打开一个虚构的五分钟短赛窗口。速度必须服从准确与礼貌。", story10Objective: "完成至少六台、RUN与S&P各两台、三个地区的比赛通联。", story10Brief: "在RUN pile-up和S&P台池间切换，发送准确的RST、序号、地区和功率；需要时用AGN或QRS。", story10Debrief: "拥挤的频率重新安静下来。分数记录了速度，也记录了你为准确与礼貌留下的每一次停顿。",
    story11Title: "听不见的人", story11Description: "SIM11LS不会回应。静默本身也是需要耐心记录的证据。", story11Objective: "观察三个窗口，发送一次定向呼叫，等待并记录静默。", story11Brief: "先观察传播与噪声，再用真实CW呼叫SIM11LS。最多允许第二次呼叫；不要把静默编成回复。", story11Debrief: "记录只说明没有听到回复。你学会了停止呼叫，也学会了认真倾听。",
    story12Title: "风暴中继", story12Description: "两份冲突报文抵达台网。先核实来源，再把唯一有效的修订版送达。", story12Objective: "报到、识别冲突、请求修订核实，并中继完整的MSG 214修订版二。", story12Brief: "这是虚构离线演练。逐项核对REV、GRID、PEOPLE、ITEM、QTY与CHECK，不要猜测。", story12Debrief: "你没有选择最先听到的数字，而是核实来源后送出了可追溯的修订版。",
    story13Title: "同一个夜晚", story13Description: "四位熟悉的人只在短暂而不同的窗口出现，不能让一次联络抹去其他人。", story13Objective: "按排班在三个互不重叠的窗口完成三次不同联络。", story13Brief: "观察离线作业板，在窗口开启时用真实CW呼叫并交换RST与模拟波段。", story13Debrief: "三位不同的人在同一个夜晚留下了各自的时间与声音。",
    story14Title: "未完成的约定", story14Description: "最后的收件人只承认你亲自走过的事实，不要求你模仿旧日志的主人。", story14Objective: "回看有限事实，以真实CW发送一条固定语气的最后报文。", story14Brief: "核对旧QSL、静默监听、中继与夜间排班，再呼叫虚构收件人SIM14FP。", story14Debrief: "旧日志的最后一页已封存；下一页将由你自己开始。",
    story15Title: "第一页", story15Description: "旧日志已经合上；现在用一次真实的普通联络写下属于你的第一页。", story15Objective: "接受任务后完成一次有正奖励的普通QSO，并选择开放电台的固定目标。", story15Brief: "进入普通电台完成联络。事件联络和接受前的记录不会计入。", story15Debrief: "第一页已经写下，开放电台从这里开始。",
    weatherTitle: "空中天气簿", weatherDescription: "替台站收下一份来自远方的天气记录。", weatherObjective: "完成一次 WEATHER 问答并让对方确认抄收。",
    relayTitle: "衰落中的接力", relayDescription: "信号跌入噪声时，耐心比功率更重要。", relayObjective: "在 P0–P2 完成一次使用 AGN 或 QRS 恢复的 QSO。",
    equipmentTitle: "设备试航", equipmentDescription: "让新电台或配件在真实通联里留下第一条记录。", equipmentObjective: "使用非初始电台或已安装配件完成一次 QSO。",
    contestTitle: "短促的比赛窗口", contestDescription: "频率拥挤，交换必须快而清楚。", contestObjective: "以至少 22 WPM、准确度 90、节奏 85 且无重发完成一次 QSO。",
    friendshipTitle: "熟悉的呼号", friendshipDescription: "再次听见认识的呼号，也交换一点信号报告之外的事情。", friendshipObjective: "与已认识的台通联，或完成一次个人话题交换。",
    cleanTitle: "整洁值守", cleanDescription: "稳定的基本功仍然是台站最可靠的收入。", cleanObjective: "接受后完成一次发报准确度不低于 85、节奏不低于 75 且无需重发的 QSO。",
    weakTitle: "微弱窗口", weakDescription: "在噪声和衰落里保留足够的耐心。", weakObjective: "接受后在 P0–P2 传播等级完成一次 QSO。",
    regionsTitle: "两地来波", regionsDescription: "在同一次值守中听见两个不同地区。", regionsObjective: "接受后完成来自两个不同地区的 QSO。",
    distanceTitle: "三千公里", distanceDescription: "抓住一次足以越过远方地平线的传播。", distanceObjective: "接受后完成一次距离不少于 3,000 km 的 QSO。",
    independentTitle: "独立值守", independentDescription: "关掉引导，只依靠自己的耳朵和判断。", independentObjective: "接受后完成一次未使用引导或视觉辅助的 QSO。",
  },
  "zh-TW": {
    title: "任務中心", kicker: "未完成的日誌", story: "主線日誌", daily: "常規委託", chapter: "章節", progress: "進度",
    available: "可接受", active: "進行中", ready: "可領取", locked: "未解鎖", claimed: "已完成",
    accept: "接受任務", claim: "領取獎勵", abandon: "放棄任務", close: "返回管理中心", money: "金錢", tp: "技術點",
    storyProgress: "日誌進度", dailyNote: "每天依呼號生成三份委託；最多同時進行兩份，已接受的任務不會在換日時消失。",
    limit: "常規委託欄已滿", targetCallsign: "優先監聽", propagation: "只有目前傳播允許時，目標臺才會回應。",
    brief: "任務簡報", debrief: "結算記錄", contractClues: "通聯條件", requiredPropagation: "傳播", requiredTopics: "必要話題", recoveryActions: "恢復操作",
    relationship: "目標臺關係", completedQsos: "已完成 QSO", weakSignalRecoveries: "弱訊號恢復", launchEvent: "進入活動臺", annualReplay: "年度復刻", practiceRun: "活動練習", launchExpedition: "進入山丘臨時臺", launchQslStory: "進入QSL調查", launchServiceNet: "進入公共服務臺網", launchCoordinateRelay: "進入座標中繼", launchContest: "進入五分鐘短賽", launchListening: "進入靜默監聽",
    story01Title: "第一次開機", story01Description: "陌生人的一句「聽見你了」，讓沉默的房間重新有了聲音。", story01Objective: "完成並儲存第一次 QSO。",
    story02Title: "紙頁上的呼號", story02Description: "褪色日誌裡圈著 SIM3RA。對方是否還記得這本未完成的日誌？", story02Objective: "與 SIM3RA 完成 QSO，並在通聯中至少使用一次 AGN K。",
    story03Title: "不同的節奏", story03Description: "有人謹慎，有人急促，也有人需要更慢的速度。先學會聽見差異。", story03Objective: "完成來自三種不同操作員風格的 QSO。",
    story01Brief: "房間很安靜。發出第一遍 CQ，把自己的呼號送往看不見的遠方。", story01Debrief: "日誌的第一行不再空白。世界某處確實有人停下來，聽見了你。",
    story02Brief: "舊日誌只留下 SIM3RA 和一段缺口。若訊號沒有抄全，就用 AGN K 請對方重發。", story02Debrief: "一次請求重發沒有切斷聯繫，反而讓那張舊紙終於等到完整的回音。",
    story03Brief: "別只聽點劃，也聽每個人停頓、確認和等待的方式。完成三種不同風格的通聯。", story03Debrief: "三個不同的節奏，背後是三個不同的人。電波開始不再只是分數和字元。",
    story04Title: "雨幕另一邊", story04Description: "雨聲蓋過窗外，SIM2DX 的天氣報告在衰落中斷斷續續。", story04Objective: "在 P0–P2 與 SIM2DX 完成 WEATHER 交換，並用 AGN 或 QRS 從誤抄中恢復。", story04Brief: "守住微弱訊號，問清天氣；聽不清就用 AGN，速度過快就用 QRS。別讓雨幕吞掉消息。", story04Debrief: "天氣報告被完整抄下。隔著雨和雜訊，兩間遙遠的房間短暫亮在同一條電波上。",
    story05Title: "空中燈火", story05Description: "五月的紀念呼號在夜色裡亮起。SORA 把 SIM5LT 的電鍵交到你手中。", story05Objective: "完成空中燈火主線活動並至少取得基礎評級。", story05Brief: "先追呼 SORA 操作的 SIM5LT，完成交換後接管活動臺，在八分鐘內從 pile-up 中逐一抄出呼號、RST 與地區。", story05Debrief: "最後一個 73 消失在底噪裡。六個方向的燈火沒有同處一地，卻在你的日誌上連成同一晚。",
    story06Title: "山丘臨時臺", story06Description: "借來的電臺、線天線與電池正等著被帶上風中的山丘。", story06Objective: "完成包含 QTH、PWR 與 ANT 的遠征通聯。", story06Brief: "選擇一處虛構山丘，正確架設借用套件並在電量耗盡前完成交換。", story06Debrief: "收起線天線時，遠方的回應已成為山風之外的另一段記憶。",
    story07Title: "QSL疑雲", story07Description: "同一張山丘QSL留下兩種敘述。SORA願意在空中重新核對。", story07Objective: "發送QSL澄清電文，抄收SORA回應並作出最終判斷。", story07Brief: "比對雙方記錄，以QSL案件編號與本臺呼號請求澄清；需要時使用AGN或QRS。", story07Debrief: "事實已重新核對，最後判斷由你留在人物檔案中。",
    story08Title: "城市停電", story08Description: "一場虛構停電演練讓三則公共服務報文同時湧入 SIM8PS。", story08Objective: "報到後依優先順序確認三則報文的編號與優先級。", story08Brief: "這是虛構演練。抄收凍結報文，依優先順序發送 ACK；需要時使用 AGN 或 QRS。", story08Debrief: "三則回執依序寫入日誌。沒有真實調度，只有清楚而克制的通信練習。",
    story09Title: "座標", story09Description: "一則虛構像素網格報文必須在兩個臺站之間原樣抵達。", story09Objective: "讀回網格、UTC、人數與校驗，再完成雙臺站中繼。", story09Brief: "從 SIM9CR 抄收凍結報文，修正硬欄位後把同一規範報文中繼給 SIM9RL。", story09Debrief: "兩個臺站與一則完整報文由同一組校驗欄位連接起來。",
    story10Title: "空中的擁擠", story10Description: "SIM0CT 開啟虛構五分鐘短賽；速度必須服從準確與禮貌。", story10Objective: "完成至少六臺、RUN與S&P各兩臺、三個地區的比賽通聯。", story10Brief: "在RUN pile-up與S&P臺池間切換，準確發送RST、序號、地區和功率；需要時用AGN或QRS。", story10Debrief: "擁擠頻率重新安靜。分數記錄速度，也記錄你為準確和禮貌留下的停頓。",
    story11Title: "聽不見的人", story11Description: "SIM11LS不會回應。靜默本身也是需要耐心記錄的證據。", story11Objective: "觀察三個視窗，傳送一次定向呼叫，等待並記錄靜默。", story11Brief: "先觀察傳播與雜訊，再用真實CW呼叫SIM11LS。最多允許第二次呼叫；不要把靜默編成回覆。", story11Debrief: "記錄只說明沒有聽到回覆。你學會停止呼叫，也學會仔細聆聽。",
    story12Title: "風暴中繼", story12Description: "兩份衝突報文抵達臺網。先核實來源，再把唯一有效的修訂版送達。", story12Objective: "報到、辨識衝突、請求修訂核實，並中繼完整的MSG 214修訂版二。", story12Brief: "這是虛構離線演練。逐項核對REV、GRID、PEOPLE、ITEM、QTY與CHECK，不要猜測。", story12Debrief: "你沒有選擇最先聽到的數字，而是核實來源後送出可追溯的修訂版。",
    story13Title: "同一個夜晚", story13Description: "四位熟悉的人只在短暫且不同的窗口出現，不能讓一次聯絡抹去其他人。", story13Objective: "依排班在三個互不重疊的窗口完成三次不同聯絡。", story13Brief: "觀察離線作業板，在窗口開啟時以真實CW呼叫並交換RST與模擬波段。", story13Debrief: "三位不同的人在同一個夜晚留下各自的時間與聲音。",
    story14Title: "未完成的約定", story14Description: "最後的收件人只承認你親自走過的事實，不要求你模仿舊日誌的主人。", story14Objective: "回看有限事實，以真實CW傳送固定語氣的最後報文。", story14Brief: "核對舊QSL、靜默監聽、中繼與夜間排班，再呼叫虛構收件人SIM14FP。", story14Debrief: "舊日誌的最後一頁已封存；下一頁將由你自己開始。",
    story15Title: "第一頁", story15Description: "舊日誌已經合上；現在以一次真實普通聯絡寫下屬於你的第一頁。", story15Objective: "接受任務後完成一次有正獎勵的普通QSO，並選擇開放電臺的固定目標。", story15Brief: "進入普通電臺完成聯絡。事件聯絡與接受前的記錄不會計入。", story15Debrief: "第一頁已經寫下，開放電臺從這裡開始。",
    weatherTitle: "空中天氣簿", weatherDescription: "替臺站收下一份來自遠方的天氣記錄。", weatherObjective: "完成一次 WEATHER 問答並讓對方確認抄收。",
    relayTitle: "衰落中的接力", relayDescription: "訊號跌入雜訊時，耐心比功率更重要。", relayObjective: "在 P0–P2 完成一次使用 AGN 或 QRS 恢復的 QSO。",
    equipmentTitle: "設備試航", equipmentDescription: "讓新電臺或配件在真實通聯裡留下第一條記錄。", equipmentObjective: "使用非初始電臺或已安裝配件完成一次 QSO。",
    contestTitle: "短促的比賽窗口", contestDescription: "頻率擁擠，交換必須快而清楚。", contestObjective: "以至少 22 WPM、準確度 90、節奏 85 且無重發完成一次 QSO。",
    friendshipTitle: "熟悉的呼號", friendshipDescription: "再次聽見認識的呼號，也交換一點訊號報告之外的事情。", friendshipObjective: "與已認識的臺通聯，或完成一次個人話題交換。",
    cleanTitle: "整潔值守", cleanDescription: "穩定的基本功仍是臺站最可靠的收入。", cleanObjective: "接受後完成一次發報準確度不低於 85、節奏不低於 75 且無需重發的 QSO。",
    weakTitle: "微弱窗口", weakDescription: "在雜訊和衰落裡保留足夠的耐心。", weakObjective: "接受後在 P0–P2 傳播等級完成一次 QSO。",
    regionsTitle: "兩地來波", regionsDescription: "在同一次值守中聽見兩個不同地區。", regionsObjective: "接受後完成來自兩個不同地區的 QSO。",
    distanceTitle: "三千公里", distanceDescription: "抓住一次足以越過遠方地平線的傳播。", distanceObjective: "接受後完成一次距離不少於 3,000 km 的 QSO。",
    independentTitle: "獨立值守", independentDescription: "關掉引導，只依靠自己的耳朵和判斷。", independentObjective: "接受後完成一次未使用引導或視覺輔助的 QSO。",
  },
  ja: {
    title: "ミッションセンター", kicker: "未完のログブック", story: "メインログ", daily: "通常依頼", chapter: "章", progress: "進捗",
    available: "受注可能", active: "進行中", ready: "受取可能", locked: "未解放", claimed: "完了",
    accept: "受注する", claim: "報酬を受け取る", abandon: "依頼を破棄", close: "管理センターへ", money: "所持金", tp: "技術ポイント",
    storyProgress: "ログ進捗", dailyNote: "コールサインを基に毎日3件生成。通常依頼は同時に2件までで、受注済みの依頼は日付が変わっても残ります。",
    limit: "通常依頼枠が満杯です", targetCallsign: "優先受信", propagation: "現在の伝搬が届く場合だけ対象局が応答します。",
    brief: "ミッション概要", debrief: "完了報告", contractClues: "交信条件", requiredPropagation: "伝搬", requiredTopics: "必須話題", recoveryActions: "復旧操作",
    relationship: "対象局との関係", completedQsos: "完了した QSO", weakSignalRecoveries: "弱信号からの復帰", launchEvent: "記念局へ", annualReplay: "年次再演", practiceRun: "イベント練習", launchExpedition: "丘の移動運用へ", launchQslStory: "QSL調査へ", launchServiceNet: "公共サービスネットへ", launchCoordinateRelay: "座標リレーへ", launchContest: "5分コンテストへ", launchListening: "沈黙の受信へ",
    story01Title: "初めての電源", story01Description: "見知らぬ誰かの「聞こえた」が、静かな部屋にもう一度音を戻します。", story01Objective: "最初のQSOを完了し、ログに保存する。",
    story02Title: "紙に残ったコール", story02Description: "色あせたログにはSIM3RAが囲まれています。相手は未完のログを覚えているでしょうか。", story02Objective: "SIM3RAとQSOし、交信中にAGN Kを1回以上使用する。",
    story03Title: "それぞれのリズム", story03Description: "慎重な人、速い人、ゆっくりでなければ聞けない人。まず違いを聞き分けます。", story03Objective: "3種類のオペレータースタイルとQSOする。",
    story01Brief: "部屋は静かです。最初の CQ を送り、自分のコールサインを見えない遠方へ届けてください。", story01Debrief: "ログの一行目はもう空白ではありません。世界のどこかで誰かが足を止め、あなたを聞きました。",
    story02Brief: "古いログには SIM3RA と欠けた記録だけが残っています。取り切れなければ AGN K で再送を頼みましょう。", story02Debrief: "再送のお願いはつながりを切らず、古い紙にようやく完全な返事を残しました。",
    story03Brief: "短点と長点だけでなく、間、確認、待ち方にも耳を澄ませ、三つの異なる運用スタイルと交信します。", story03Debrief: "三つの異なるリズムの向こうに、三人の異なる人がいました。電波はもう点数と文字だけではありません。",
    story04Title: "雨幕の向こう", story04Description: "窓を打つ雨の中、SIM2DX の気象報告がフェージングで途切れています。", story04Objective: "P0–P2 で SIM2DX と WEATHER を交換し、AGN または QRS で誤受信から復帰する。", story04Brief: "弱い信号を保ち、天気を聞き取ります。取れなければ AGN、速すぎれば QRS。雨に報告を消させないでください。", story04Debrief: "気象報告は最後まで記録されました。雨と雑音を越え、遠い二つの部屋が同じ電波に短く灯りました。",
    story05Title: "空をつなぐ灯", story05Description: "五月の記念コールが夜に灯り、SORA は SIM5LT のキーをあなたへ渡します。", story05Objective: "記念イベント本編を完走し、基礎以上の評価を得る。", story05Brief: "SORA の SIM5LT を追い、交換後に記念局を引き継ぎます。8分間の pile-up からコール、RST、地域を一局ずつ取ってください。", story05Debrief: "最後の 73 が底雑音へ消えました。別々の場所の灯が、あなたのログで同じ夜につながりました。",
    story06Title: "丘の移動運用", story06Description: "借りた無線機、ワイヤーアンテナ、バッテリーを風の丘へ運びます。", story06Objective: "QTH・PWR・ANT を含む移動運用 QSO を完了する。", story06Brief: "架空の丘を選び、貸出セットを正しく設営し、電力が尽きる前に交換を終えます。", story06Debrief: "アンテナを畳むころ、遠方の返事は山風とは別の記憶になりました。",
    story07Title: "QSLの疑問", story07Description: "丘のQSLに二つの記述が残り、SORAは無線での再確認に応じます。", story07Objective: "QSL確認電文を送り、SORAの返答を受けて最終判断を残す。", story07Brief: "双方の記録を比べ、案件番号と自局コールで確認します。必要ならAGNまたはQRSを使います。", story07Debrief: "事実を確認し直し、最後の判断は人物記録に残りました。",
    story08Title: "街の停電", story08Description: "架空の停電訓練で三通の公共サービス電文が SIM8PS に同時到着します。", story08Objective: "チェックイン後、優先順に三通の番号と優先度を確認する。", story08Brief: "これは架空の訓練です。固定電文を受信し、優先順に ACK を返してください。必要なら AGN または QRS を使います。", story08Debrief: "三通の受領記録が順に残りました。実在の派遣ではなく、明確で落ち着いた通信訓練です。",
    story09Title: "座標", story09Description: "架空のピクセルグリッド電文を二局間でそのまま届けます。", story09Objective: "グリッド、UTC、人数、チェックを復唱し、二局の中継を完了する。", story09Brief: "SIM9CR の固定電文を受信し、硬い項目を訂正して同じ標準電文を SIM9RL へ中継します。", story09Debrief: "二局と完全な一通の電文が同じチェック項目で結ばれました。",
    story10Title: "混み合う空", story10Description: "SIM0CTが架空の5分窓を開きます。速度は正確さと礼儀に従います。", story10Objective: "6局以上、RUN/S&P各2局、3地域を満たして完走する。", story10Brief: "RUN pile-upとS&P局プールを切り替え、RST、連番、地域、電力を正確に送ります。必要ならAGN/QRSを使います。", story10Debrief: "混み合った周波数は静かになりました。得点には速さだけでなく、正確さと礼儀のための間も残りました。",
    story11Title: "聞こえない人", story11Description: "SIM11LSは応答しません。沈黙そのものも忍耐強く記録する証拠です。", story11Objective: "3つの窓を観測し、指向呼出を1回送り、待って沈黙を記録する。", story11Brief: "伝搬と雑音を観測してから実際のCWでSIM11LSを呼びます。2回目までは許されますが、沈黙を応答に変えてはいけません。", story11Debrief: "記録は応答を聞かなかったことだけを示します。呼ぶのを止め、よく聞くことを学びました。",
    story12Title: "嵐のリレー", story12Description: "競合する二つの電文がネットに届きます。送信元を確認し、唯一有効な改訂を届けます。", story12Objective: "チェックインし、競合を認識し、改訂を確認してMSG 214改訂2を完全に中継する。", story12Brief: "架空のオフライン訓練です。REV、GRID、PEOPLE、ITEM、QTY、CHECKを推測せず照合します。", story12Debrief: "最初に聞いた数字を選ばず、送信元を確認して追跡可能な改訂を送りました。",
    story13Title: "同じ夜", story13Description: "なじみの四人は短く異なる窓に現れます。一交信で他の人を消してはいけません。", story13Objective: "重ならない三つの窓で異なる三人との交信を完了する。", story13Brief: "オフライン運用板を見て、窓が開いたら実際のCWで呼び、RSTと模擬バンドを交換します。", story13Debrief: "同じ夜に三人それぞれの時間と声が記録されました。",
    story14Title: "未完の約束", story14Description: "最後の受取人はあなた自身の事実だけを認め、古い持ち主の模倣を求めません。", story14Objective: "限定された事実を読み、実際のCWで固定調子の最終電文を送る。", story14Brief: "QSL、沈黙の受信、中継、夜間日程を確認し、架空局SIM14FPを呼びます。", story14Debrief: "古いログの最終ページを封印しました。次のページはあなた自身のものです。",
    story15Title: "最初のページ", story15Description: "古いログを閉じ、通常QSOで自分の最初のページを書きます。", story15Objective: "受諾後に正の報酬を持つ通常QSOを完了し、オープン局の固定目標を選ぶ。", story15Brief: "通常局へ入り交信します。イベント交信と受諾前の記録は数えません。", story15Debrief: "最初のページが書かれ、オープン局が始まりました。",
    weatherTitle: "空の気象ログ", weatherDescription: "遠方から届く気象記録を局のログに残します。", weatherObjective: "WEATHER の質問と回答を完了し、相手に受信を確認してもらう。",
    relayTitle: "フェージング・リレー", relayDescription: "信号が雑音へ沈むとき、出力より忍耐が役立ちます。", relayObjective: "P0–P2 で AGN または QRS を使って復帰し、QSOを完了する。",
    equipmentTitle: "機材の実地試験", equipmentDescription: "新しい無線機や付属品で最初の実交信を記録します。", equipmentObjective: "初期機以外の無線機、または装着した付属品を使ってQSOする。",
    contestTitle: "短いコンテスト窓", contestDescription: "混雑した周波数で、交換を速く明瞭にまとめます。", contestObjective: "22 WPM以上、精度90、リズム85以上、再送なしでQSOする。",
    friendshipTitle: "聞き覚えのあるコール", friendshipDescription: "既知のコールと再会し、RST以外のことも少し交換します。", friendshipObjective: "既知局とQSOするか、個人的な話題の交換を完了する。",
    cleanTitle: "クリーン・ウォッチ", cleanDescription: "確かな基本操作は今も局の最も安定した収入です。", cleanObjective: "受注後、送信精度85以上、リズム75以上、再送なしのQSOを1回完了する。",
    weakTitle: "弱い窓", weakDescription: "雑音とフェージングの中でも急がずに待ちます。", weakObjective: "受注後、伝搬レベルP0–P2でQSOを1回完了する。",
    regionsTitle: "二つの地域", regionsDescription: "一度の運用で異なる二地域の信号を聞きます。", regionsObjective: "受注後、異なる二地域とQSOする。",
    distanceTitle: "三千キロ", distanceDescription: "遠い地平線を越える伝搬を一度つかみます。", distanceObjective: "受注後、3,000 km以上のQSOを1回完了する。",
    independentTitle: "単独運用", independentDescription: "ガイドを閉じ、自分の耳と判断だけで運用します。", independentObjective: "受注後、ガイドと視覚補助なしでQSOを1回完了する。",
  },
  en: {
    title: "Mission Center", kicker: "The Unfinished Logbook", story: "Story Log", daily: "Regular Commissions", chapter: "Chapter", progress: "Progress",
    available: "Available", active: "Active", ready: "Reward Ready", locked: "Locked", claimed: "Completed",
    accept: "Accept Mission", claim: "Claim Reward", abandon: "Abandon", close: "Back to Management Center", money: "Money", tp: "Technology Point",
    storyProgress: "Log Progress", dailyNote: "Three commissions are generated daily from your station seed. Up to two may be active; accepted work survives the day change.",
    limit: "Regular commission slots are full", targetCallsign: "Priority Listener", propagation: "The target station answers only when current propagation reaches it.",
    brief: "Mission Brief", debrief: "Debrief", contractClues: "Contact Contract", requiredPropagation: "Propagation", requiredTopics: "Required Topics", recoveryActions: "Recovery Actions",
    relationship: "Target Relationship", completedQsos: "Completed QSOs", weakSignalRecoveries: "Weak-Signal Recoveries", launchEvent: "Enter Event Station", annualReplay: "Annual Replay", practiceRun: "Event Practice", launchExpedition: "Enter Hilltop Field Station", launchQslStory: "Enter QSL Investigation", launchServiceNet: "Enter Public Service Net", launchCoordinateRelay: "Enter Coordinate Relay", launchContest: "Enter Five-minute Contest", launchListening: "Enter Silent Listening",
    story01Title: "First Power-On", story01Description: "A stranger's “I hear you” brings sound back into the silent room.", story01Objective: "Complete and save your first QSO.",
    story02Title: "The Callsign on Paper", story02Description: "SIM3RA is circled in the faded log. Does that operator still remember the unfinished page?", story02Objective: "Complete a QSO with SIM3RA and use AGN K at least once during the contact.",
    story03Title: "Different Rhythms", story03Description: "Some operators are cautious, some rush, and some need a slower pace. Learn to hear the difference.", story03Objective: "Complete QSOs with three distinct operator styles.",
    story01Brief: "The room is quiet. Send your first CQ and carry your own callsign into the unseen distance.", story01Debrief: "The first line of the log is no longer blank. Somewhere, someone stopped and heard you.",
    story02Brief: "Only SIM3RA and a gap remain in the old log. If the signal is incomplete, ask for it again with AGN K.", story02Debrief: "A request for repetition did not break the contact. It finally gave the old page a complete reply.",
    story03Brief: "Listen beyond dots and dashes to how each person pauses, confirms, and waits. Contact three different operating styles.", story03Debrief: "Three different rhythms belonged to three different people. Radio is no longer only scores and characters.",
    story04Title: "Beyond the Rain Curtain", story04Description: "Rain fills the window while SIM2DX's weather report breaks apart in the fading.", story04Objective: "Exchange WEATHER with SIM2DX at P0–P2 and recover a missed copy with AGN or QRS.", story04Brief: "Hold the weak signal and copy the weather. Use AGN when words are lost and QRS when the sending is too fast. Do not let the rain take the message.", story04Debrief: "The weather report is complete. Across rain and noise, two distant rooms briefly shared the same signal.",
    story05Title: "Lights Across the Air", story05Description: "A May memorial call lights the dark. SORA places the SIM5LT key in your hands.", story05Objective: "Complete the story event and earn at least the Base grade.", story05Brief: "First chase SORA at SIM5LT. After the exchange, take over the event station and pull callsigns, RSTs, and regions from an eight-minute pile-up.", story05Debrief: "The final 73 fades into receiver noise. Lights in six directions never shared a field, yet met on one page of your log.",
    story06Title: "Hilltop Field Station", story06Description: "A loan radio, wire antenna and battery wait to be carried into the hill wind.", story06Objective: "Complete an expedition QSO containing QTH, PWR and ANT.", story06Brief: "Choose a fictional hill, set up the loan kit correctly, and complete the exchange before power runs out.", story06Debrief: "As the wire comes down, the distant reply remains as a memory beyond the hill wind.",
    story07Title: "The QSL Question", story07Description: "One hilltop QSL holds two accounts. SORA agrees to compare them over the air.", story07Objective: "Send a QSL clarification, copy SORA's reply, and record a final judgment.", story07Brief: "Compare both accounts and request clarification with the case ID and your callsign; use AGN or QRS if needed.", story07Debrief: "The facts were checked again, and your final judgment now remains in the people record.",
    story08Title: "City Blackout", story08Description: "A fictional blackout exercise sends three public-service messages into SIM8PS at once.", story08Objective: "Check in, then acknowledge all three message IDs and priorities in order.", story08Brief: "This is a fictional exercise. Copy the frozen messages and send each ACK by priority; use AGN or QRS when needed.", story08Debrief: "Three receipts entered the log in order. No real dispatch occurred—only clear, restrained communications practice.",
    story09Title: "Coordinates", story09Description: "A fictional Pixel Grid packet must arrive unchanged between two stations.", story09Objective: "Read back grid, UTC, people, and check, then complete the two-station relay.", story09Brief: "Copy the frozen packet from SIM9CR, correct every hard field, and relay the same canonical packet to SIM9RL.", story09Debrief: "Two stations and one complete packet now share the same verified fields.",
    story10Title: "Crowded Air", story10Description: "SIM0CT opens a fictional five-minute window where speed must answer to accuracy and courtesy.", story10Objective: "Complete at least six contacts, two each in RUN and S&P, across three regions.", story10Brief: "Switch between a RUN pile-up and S&P pool. Send exact RST, serial, region, and power; use AGN or QRS when needed.", story10Debrief: "The crowded frequency falls quiet. The score remembers speed, but also every pause made for accuracy and courtesy.",
    story11Title: "The One Who Cannot Hear", story11Description: "SIM11LS will not answer. Silence itself is evidence that deserves patient recording.", story11Objective: "Observe three windows, send one directed call, wait, and record silence.", story11Brief: "Observe propagation and noise before calling SIM11LS with real CW. A second call is tolerated; never invent a reply from silence.", story11Debrief: "The record says only that no reply was heard. You learned when to stop calling and how to keep listening.",
    story12Title: "The Storm Relay", story12Description: "Two conflicting messages reach the net. Verify the source, then deliver the only valid revision.", story12Objective: "Check in, identify the conflict, request revision verification, and relay complete MSG 214 revision two.", story12Brief: "This is a fictional offline exercise. Verify REV, GRID, PEOPLE, ITEM, QTY, and CHECK without guessing.", story12Debrief: "You did not choose the first numbers heard. You verified the source and sent a traceable revision.",
    story13Title: "The Same Night", story13Description: "Four familiar people appear in short, separate windows; one contact must not erase the others.", story13Objective: "Complete three distinct contacts in three non-overlapping scheduled windows.", story13Brief: "Watch the offline operations board. When a window opens, call with physical CW and exchange RST plus the simulated band.", story13Debrief: "Three different people left their own time and voice in the same night.",
    story14Title: "The Unfinished Promise", story14Description: "The final recipient recognizes only what you did yourself and never asks you to imitate the old log's owner.", story14Objective: "Review bounded facts and send one fixed-tone final message with physical CW.", story14Brief: "Review the QSL, patient listening, corrected relay, and night schedule, then call fictional recipient SIM14FP.", story14Debrief: "The old log's final page is sealed. Its next page will be your own.",
    story15Title: "The First Page", story15Description: "The old log is closed. Write your own first page with one real ordinary contact.", story15Objective: "Complete one positive-reward ordinary QSO after acceptance and choose a fixed Open Station goal.", story15Brief: "Enter the ordinary station and complete a contact. Event and pre-acceptance QSOs do not count.", story15Debrief: "The first page is written. Open Station begins here.",
    weatherTitle: "Weather on the Air", weatherDescription: "Add one distant weather observation to the station log.", weatherObjective: "Complete a WEATHER question and answer that the other station acknowledges.",
    relayTitle: "Relay Through the Fade", relayDescription: "When a signal falls into noise, patience matters more than power.", relayObjective: "At P0–P2, recover with AGN or QRS and complete the QSO.",
    equipmentTitle: "Equipment Shakedown", equipmentDescription: "Give a new radio or accessory its first record in a real contact.", equipmentObjective: "Complete a QSO with a non-starter radio or an installed accessory.",
    contestTitle: "Short Contest Window", contestDescription: "The band is crowded, so the exchange must be quick and clear.", contestObjective: "Complete a QSO at 22 WPM or faster with 90 accuracy, 85 rhythm, and no repeats.",
    friendshipTitle: "A Familiar Callsign", friendshipDescription: "Meet a known callsign again and exchange something beyond a signal report.", friendshipObjective: "Contact a known station or complete one personal-topic exchange.",
    cleanTitle: "Clean Watch", cleanDescription: "Steady fundamentals remain the station's most dependable income.", cleanObjective: "After accepting, complete one QSO with at least 85 transmit accuracy, 75 rhythm, and no repeats.",
    weakTitle: "Weak Window", weakDescription: "Keep enough patience through noise and fading.", weakObjective: "After accepting, complete one QSO at propagation level P0–P2.",
    regionsTitle: "Signals from Two Regions", regionsDescription: "Hear two different regions during the same watch.", regionsObjective: "After accepting, complete QSOs with two different regions.",
    distanceTitle: "Three Thousand Kilometers", distanceDescription: "Catch one opening that reaches beyond a distant horizon.", distanceObjective: "After accepting, complete one QSO of at least 3,000 km.",
    independentTitle: "Independent Watch", independentDescription: "Close the guidance and rely on your own ears and judgment.", independentObjective: "After accepting, complete one QSO without guidance or visual assistance.",
  },
  es: {
    title: "Centro de misiones", kicker: "El registro inacabado", story: "Registro principal", daily: "Encargos habituales", chapter: "Capítulo", progress: "Progreso",
    available: "Disponible", active: "En curso", ready: "Recompensa lista", locked: "Bloqueado", claimed: "Completado",
    accept: "Aceptar misión", claim: "Recibir recompensa", abandon: "Abandonar", close: "Volver al Centro de Gestión", money: "Dinero", tp: "Punto tecnológico",
    storyProgress: "Progreso del registro", dailyNote: "Cada día se generan tres encargos según tu estación. Puedes mantener dos activos; los aceptados no desaparecen al cambiar el día.",
    limit: "Los espacios de encargos están llenos", targetCallsign: "Escucha prioritaria", propagation: "La estación objetivo solo responderá si la propagación actual la alcanza.",
    brief: "Informe de misión", debrief: "Informe final", contractClues: "Condiciones del contacto", requiredPropagation: "Propagación", requiredTopics: "Temas obligatorios", recoveryActions: "Maniobras de recuperación",
    relationship: "Relación con la estación", completedQsos: "QSO completados", weakSignalRecoveries: "Recuperaciones con señal débil", launchEvent: "Entrar en la estación", annualReplay: "Repetición anual", practiceRun: "Práctica del evento", launchExpedition: "Entrar en la estación de la colina", launchQslStory: "Entrar en la investigación QSL", launchServiceNet: "Entrar en la red de servicio público", launchCoordinateRelay: "Entrar en el relevo de coordenadas", launchContest: "Entrar en el concurso de cinco minutos", launchListening: "Entrar en la escucha silenciosa",
    story01Title: "Primer encendido", story01Description: "El «te escucho» de un desconocido devuelve el sonido a la habitación silenciosa.", story01Objective: "Completa y guarda tu primer QSO.",
    story02Title: "El indicativo en el papel", story02Description: "SIM3RA está rodeado en el registro descolorido. ¿Recordará aún esa página inacabada?", story02Objective: "Completa un QSO con SIM3RA y usa AGN K al menos una vez.",
    story03Title: "Ritmos diferentes", story03Description: "Algunos son prudentes, otros rápidos y otros necesitan más calma. Aprende a oír la diferencia.", story03Objective: "Completa QSO con tres estilos de operador distintos.",
    story01Brief: "La habitación está en silencio. Envía tu primer CQ y lleva tu indicativo hacia una distancia que no puedes ver.", story01Debrief: "La primera línea del registro ya no está vacía. En algún lugar, alguien se detuvo y te escuchó.",
    story02Brief: "Solo quedan SIM3RA y un hueco en el registro antiguo. Si falta parte de la señal, pide repetir con AGN K.", story02Debrief: "Pedir una repetición no rompió el contacto; por fin dio una respuesta completa a la página antigua.",
    story03Brief: "Escucha más allá de puntos y rayas: las pausas, confirmaciones y esperas. Contacta con tres estilos distintos.", story03Debrief: "Tres ritmos distintos pertenecían a tres personas distintas. La radio ya no es solo puntuación y caracteres.",
    story04Title: "Al otro lado de la cortina de lluvia", story04Description: "La lluvia cubre la ventana mientras el informe meteorológico de SIM2DX se rompe con el desvanecimiento.", story04Objective: "Intercambia WEATHER con SIM2DX en P0–P2 y recupera una copia perdida con AGN o QRS.", story04Brief: "Mantén la señal débil y copia el tiempo. Usa AGN si faltan palabras y QRS si transmite demasiado rápido. No dejes que la lluvia se lleve el mensaje.", story04Debrief: "El informe meteorológico está completo. Entre lluvia y ruido, dos habitaciones lejanas compartieron por un instante la misma señal.",
    story05Title: "Luces en el aire", story05Description: "Un indicativo conmemorativo de mayo ilumina la noche. SORA pone la llave de SIM5LT en tus manos.", story05Objective: "Completa el evento de historia y consigue al menos el nivel Base.", story05Brief: "Primero llama a SORA en SIM5LT. Después toma la estación y extrae indicativos, RST y regiones de un pile-up de ocho minutos.", story05Debrief: "El último 73 se pierde en el ruido. Luces de seis direcciones se encuentran en una misma página de tu registro.",
    story06Title: "Estación portátil en la colina", story06Description: "Una radio, antena de hilo y batería prestadas esperan el viento de la colina.", story06Objective: "Completa un QSO de expedición con QTH, PWR y ANT.", story06Brief: "Elige una colina ficticia, monta bien el equipo prestado y termina antes de agotar la batería.", story06Debrief: "Al recoger el hilo, la respuesta lejana queda como recuerdo más allá del viento.",
    story07Title: "La duda QSL", story07Description: "Una QSL de la colina contiene dos relatos. SORA acepta compararlos por radio.", story07Objective: "Envía una aclaración QSL, copia la respuesta de SORA y registra una decisión final.", story07Brief: "Compara ambos relatos y pide aclaración con el caso y tu indicativo; usa AGN o QRS si hace falta.", story07Debrief: "Los hechos se revisaron y tu decisión final queda en el registro de personas.",
    story08Title: "Apagón urbano", story08Description: "Un simulacro ficticio envía tres mensajes de servicio público a SIM8PS al mismo tiempo.", story08Objective: "Regístrate y confirma en orden los identificadores y prioridades de los tres mensajes.", story08Brief: "Es un ejercicio ficticio. Copia los mensajes fijos y envía cada ACK por prioridad; usa AGN o QRS si hace falta.", story08Debrief: "Los tres recibos quedaron registrados en orden. No hubo despacho real, solo práctica de comunicación clara y serena.",
    story09Title: "Coordenadas", story09Description: "Un paquete ficticio de Cuadrícula Pixel debe llegar intacto entre dos estaciones.", story09Objective: "Repite cuadrícula, UTC, personas y control, y completa el relevo entre dos estaciones.", story09Brief: "Copia el paquete fijo de SIM9CR, corrige los campos y relévalo sin cambios a SIM9RL.", story09Debrief: "Dos estaciones y un paquete completo quedaron unidos por los mismos campos verificados.",
    story10Title: "Aire congestionado", story10Description: "SIM0CT abre una ventana ficticia de cinco minutos donde la velocidad obedece a la precisión y la cortesía.", story10Objective: "Completa seis contactos, dos en RUN y dos en S&P, en tres regiones.", story10Brief: "Alterna entre pile-up RUN y grupo S&P. Envía RST, número, región y potencia exactos; usa AGN o QRS si hace falta.", story10Debrief: "La frecuencia queda en silencio. La puntuación recuerda la velocidad y también las pausas por precisión y cortesía.",
    story11Title: "Quien no puede oír", story11Description: "SIM11LS no responderá. El silencio también es evidencia que merece paciencia.", story11Objective: "Observa tres ventanas, envía una llamada dirigida, espera y registra el silencio.", story11Brief: "Observa propagación y ruido antes de llamar a SIM11LS con CW real. Se tolera una segunda llamada; nunca inventes una respuesta.", story11Debrief: "El registro solo dice que no se oyó respuesta. Aprendiste cuándo dejar de llamar y seguir escuchando.",
    story12Title: "El relevo de la tormenta", story12Description: "Dos mensajes contradictorios llegan a la red. Verifica la fuente y entrega la única revisión válida.", story12Objective: "Regístrate, identifica el conflicto, solicita verificación y retransmite MSG 214 revisión dos.", story12Brief: "Es un ejercicio ficticio sin conexión. Comprueba REV, GRID, PEOPLE, ITEM, QTY y CHECK sin adivinar.", story12Debrief: "No elegiste los primeros números recibidos; verificaste la fuente y enviaste una revisión rastreable.",
    story13Title: "La misma noche", story13Description: "Cuatro personas conocidas aparecen en ventanas breves y separadas; un contacto no debe borrar a los demás.", story13Objective: "Completa tres contactos distintos en tres ventanas programadas sin solapamiento.", story13Brief: "Observa el panel sin conexión. Cuando se abra una ventana, llama con CW físico e intercambia RST y banda simulada.", story13Debrief: "Tres personas distintas dejaron su propio tiempo y voz en la misma noche.",
    story14Title: "La promesa inacabada", story14Description: "El destinatario final reconoce solo lo que hiciste tú y no pide imitar al dueño anterior.", story14Objective: "Revisa hechos limitados y envía un mensaje final de tono fijo con CW físico.", story14Brief: "Revisa QSL, escucha paciente, relevo corregido y horario nocturno; luego llama a SIM14FP.", story14Debrief: "La última página del registro antiguo queda sellada; la siguiente será tuya.",
    story15Title: "La primera página", story15Description: "El registro antiguo se cierra. Escribe tu primera página con un contacto ordinario real.", story15Objective: "Completa un QSO ordinario con recompensa tras aceptar y elige un objetivo fijo de Estación Abierta.", story15Brief: "Entra en la estación ordinaria. Los QSO de evento o anteriores no cuentan.", story15Debrief: "La primera página está escrita. Aquí comienza la Estación Abierta.",
    weatherTitle: "El tiempo en el aire", weatherDescription: "Añade al registro una observación meteorológica llegada desde lejos.", weatherObjective: "Completa una pregunta y respuesta WEATHER que la otra estación confirme.",
    relayTitle: "Relevo entre desvanecimientos", relayDescription: "Cuando la señal cae en el ruido, la paciencia importa más que la potencia.", relayObjective: "En P0–P2, recupérate con AGN o QRS y completa el QSO.",
    equipmentTitle: "Prueba de equipo", equipmentDescription: "Da a una radio o accesorio nuevo su primer contacto real.", equipmentObjective: "Completa un QSO con una radio distinta de la inicial o un accesorio instalado.",
    contestTitle: "Breve ventana de concurso", contestDescription: "La banda está llena; el intercambio debe ser rápido y claro.", contestObjective: "Completa un QSO a 22 WPM o más, con precisión 90, ritmo 85 y sin repeticiones.",
    friendshipTitle: "Un indicativo familiar", friendshipDescription: "Vuelve a encontrar un indicativo conocido e intercambia algo más que el reporte de señal.", friendshipObjective: "Contacta con una estación conocida o completa un intercambio de tema personal.",
    cleanTitle: "Guardia limpia", cleanDescription: "Los fundamentos firmes siguen siendo el ingreso más fiable.", cleanObjective: "Tras aceptar, completa un QSO con precisión mínima 85, ritmo 75 y sin repeticiones.",
    weakTitle: "Ventana débil", weakDescription: "Conserva la paciencia entre ruido y desvanecimiento.", weakObjective: "Tras aceptar, completa un QSO con propagación P0–P2.",
    regionsTitle: "Dos regiones", regionsDescription: "Escucha dos regiones distintas durante una misma guardia.", regionsObjective: "Tras aceptar, completa QSO con dos regiones diferentes.",
    distanceTitle: "Tres mil kilómetros", distanceDescription: "Aprovecha una apertura que cruce un horizonte lejano.", distanceObjective: "Tras aceptar, completa un QSO de al menos 3.000 km.",
    independentTitle: "Guardia independiente", independentDescription: "Cierra la guía y confía en tus propios oídos.", independentObjective: "Tras aceptar, completa un QSO sin guía ni ayuda visual.",
  },
  de: {
    title: "Missionszentrale", kicker: "Das unvollendete Logbuch", story: "Handlungslog", daily: "Reguläre Aufträge", chapter: "Kapitel", progress: "Fortschritt",
    available: "Verfügbar", active: "Aktiv", ready: "Belohnung bereit", locked: "Gesperrt", claimed: "Abgeschlossen",
    accept: "Mission annehmen", claim: "Belohnung abholen", abandon: "Aufgeben", close: "Zurück zum Verwaltungszentrum", money: "Geld", tp: "Technologiepunkt",
    storyProgress: "Logbuchfortschritt", dailyNote: "Täglich entstehen drei Aufträge aus deinem Stations-Seed. Zwei dürfen gleichzeitig aktiv sein; angenommene Aufträge bleiben über den Tageswechsel erhalten.",
    limit: "Alle regulären Auftragsplätze sind belegt", targetCallsign: "Prioritätsempfang", propagation: "Die Zielstation antwortet nur, wenn die aktuelle Ausbreitung sie erreicht.",
    brief: "Missionsbriefing", debrief: "Abschlussbericht", contractClues: "Funkbedingungen", requiredPropagation: "Ausbreitung", requiredTopics: "Pflichtthemen", recoveryActions: "Wiederherstellung",
    relationship: "Beziehung zur Zielstation", completedQsos: "Abgeschlossene QSOs", weakSignalRecoveries: "Schwachsignal-Rettungen", launchEvent: "Sonderstation betreten", annualReplay: "Jährliche Wiederholung", practiceRun: "Event-Übung", launchExpedition: "Feldstation auf dem Hügel betreten", launchQslStory: "QSL-Untersuchung starten", launchServiceNet: "Öffentliches Servicenetz starten", launchCoordinateRelay: "Koordinatenrelais starten", launchContest: "Fünf-Minuten-Contest starten", launchListening: "Stilles Hören starten",
    story01Title: "Erstes Einschalten", story01Description: "Das „Ich höre dich“ eines Fremden bringt Klang in den stillen Raum zurück.", story01Objective: "Das erste QSO abschließen und speichern.",
    story02Title: "Das Rufzeichen auf Papier", story02Description: "SIM3RA ist im verblichenen Log eingekreist. Erinnert sich der Operator noch an die unvollendete Seite?", story02Objective: "Ein QSO mit SIM3RA abschließen und dabei mindestens einmal AGN K verwenden.",
    story03Title: "Verschiedene Rhythmen", story03Description: "Manche funken vorsichtig, manche schnell, andere brauchen mehr Ruhe. Höre zuerst den Unterschied.", story03Objective: "QSOs mit drei unterschiedlichen Operatorstilen abschließen.",
    story01Brief: "Der Raum ist still. Sende deinen ersten CQ-Ruf und trage dein Rufzeichen in die unsichtbare Ferne.", story01Debrief: "Die erste Logzeile ist nicht mehr leer. Irgendwo hielt jemand inne und hörte dich.",
    story02Brief: "Im alten Log blieben nur SIM3RA und eine Lücke. Fehlt ein Teil des Signals, bitte mit AGN K um Wiederholung.", story02Debrief: "Die Bitte um Wiederholung unterbrach die Verbindung nicht, sondern gab der alten Seite endlich eine vollständige Antwort.",
    story03Brief: "Höre nicht nur Punkte und Striche, sondern auch Pausen, Bestätigungen und Geduld. Kontaktiere drei Betriebsstile.", story03Debrief: "Drei verschiedene Rhythmen gehörten zu drei verschiedenen Menschen. Funk ist nicht mehr nur Wertung und Zeichen.",
    story04Title: "Hinter dem Regenvorhang", story04Description: "Regen füllt das Fenster, während der Wetterbericht von SIM2DX im Schwund zerbricht.", story04Objective: "Mit SIM2DX bei P0–P2 WEATHER austauschen und Fehlstellen mit AGN oder QRS beheben.", story04Brief: "Halte das schwache Signal und nimm das Wetter auf. Nutze AGN bei Lücken und QRS bei zu hohem Tempo. Lass den Regen die Nachricht nicht verschlucken.", story04Debrief: "Der Wetterbericht ist vollständig. Durch Regen und Rauschen teilten zwei ferne Räume kurz dasselbe Signal.",
    story05Title: "Lichter über Funk", story05Description: "Ein Gedenkruf im Mai leuchtet in der Nacht. SORA legt dir die Taste von SIM5LT in die Hand.", story05Objective: "Den Story-Event abschließen und mindestens die Basisstufe erreichen.", story05Brief: "Rufe zuerst SORA bei SIM5LT. Übernimm danach die Sonderstation und nimm in acht Minuten Rufzeichen, RST und Regionen aus dem Pile-up auf.", story05Debrief: "Das letzte 73 verschwindet im Rauschen. Lichter aus sechs Richtungen treffen sich auf einer Seite deines Logs.",
    story06Title: "Feldstation auf dem Hügel", story06Description: "Leihfunkgerät, Drahtantenne und Batterie warten auf den Wind am Hügel.", story06Objective: "Ein Expeditions-QSO mit QTH, PWR und ANT abschließen.", story06Brief: "Wähle einen fiktiven Hügel, baue den Leihsatz korrekt auf und schließe den Austausch vor Batterieschluss ab.", story06Debrief: "Beim Einholen des Drahts bleibt die ferne Antwort als Erinnerung jenseits des Windes.",
    story07Title: "Die QSL-Frage", story07Description: "Eine Hügel-QSL enthält zwei Berichte. SORA vergleicht sie mit dir über Funk.", story07Objective: "Eine QSL-Klärung senden, SORAs Antwort aufnehmen und ein Urteil speichern.", story07Brief: "Vergleiche beide Berichte und frage mit Fallnummer und Rufzeichen nach; nutze bei Bedarf AGN oder QRS.", story07Debrief: "Die Fakten wurden erneut geprüft und dein Urteil bleibt im Personenprotokoll.",
    story08Title: "Stromausfall in der Stadt", story08Description: "Eine fiktive Übung leitet drei öffentliche Servicemeldungen zugleich an SIM8PS.", story08Objective: "Einchecken und Kennung sowie Priorität aller drei Meldungen der Reihe nach bestätigen.", story08Brief: "Dies ist eine fiktive Übung. Nimm die feststehenden Meldungen auf und sende die ACKs nach Priorität; nutze bei Bedarf AGN oder QRS.", story08Debrief: "Drei Empfangsbestätigungen wurden geordnet protokolliert. Kein realer Einsatz, nur klare und ruhige Funkpraxis.",
    story09Title: "Koordinaten", story09Description: "Ein fiktives Pixelraster-Paket muss unverändert zwischen zwei Stationen ankommen.", story09Objective: "Raster, UTC, Personen und Prüfwert zurücklesen und das Zwei-Stationen-Relais abschließen.", story09Brief: "Nimm das feste Paket von SIM9CR auf, korrigiere alle Felder und leite dasselbe kanonische Paket an SIM9RL weiter.", story09Debrief: "Zwei Stationen und ein vollständiges Paket sind durch dieselben geprüften Felder verbunden.",
    story10Title: "Gedrängte Luft", story10Description: "SIM0CT öffnet ein fiktives Fünf-Minuten-Fenster, in dem Tempo Genauigkeit und Höflichkeit folgt.", story10Objective: "Mindestens sechs Kontakte, je zwei RUN/S&P und drei Regionen abschließen.", story10Brief: "Wechsle zwischen RUN-Pile-up und S&P-Pool. Sende RST, Nummer, Region und Leistung exakt; nutze bei Bedarf AGN/QRS.", story10Debrief: "Die gedrängte Frequenz wird still. Die Wertung bewahrt Tempo und jede Pause für Genauigkeit und Höflichkeit.",
    story11Title: "Der Mensch, der nicht hören kann", story11Description: "SIM11LS antwortet nicht. Auch Stille ist ein Befund, der geduldig erfasst werden muss.", story11Objective: "Drei Fenster beobachten, einmal gerichtet rufen, warten und die Stille erfassen.", story11Brief: "Beobachte Ausbreitung und Rauschen, bevor du SIM11LS mit echtem CW rufst. Ein zweiter Ruf ist erlaubt; erfinde nie eine Antwort.", story11Debrief: "Das Protokoll sagt nur, dass keine Antwort gehört wurde. Du hast gelernt aufzuhören und weiter zuzuhören.",
    story12Title: "Das Sturmrelais", story12Description: "Zwei widersprüchliche Meldungen erreichen das Netz. Prüfe die Quelle und leite nur die gültige Revision weiter.", story12Objective: "Einchecken, Konflikt erkennen, Revision prüfen und MSG 214 Revision zwei vollständig weitergeben.", story12Brief: "Fiktive Offline-Übung. Prüfe REV, GRID, PEOPLE, ITEM, QTY und CHECK ohne zu raten.", story12Debrief: "Du hast nicht die ersten Zahlen gewählt, sondern die Quelle geprüft und eine nachvollziehbare Revision gesendet.",
    story13Title: "Dieselbe Nacht", story13Description: "Vier bekannte Menschen erscheinen in kurzen getrennten Fenstern; ein Kontakt darf die anderen nicht verdrängen.", story13Objective: "Drei verschiedene Kontakte in drei überschneidungsfreien Fenstern abschließen.", story13Brief: "Beobachte den Offline-Betriebsplan. Rufe im offenen Fenster mit echtem CW und tausche RST plus simuliertes Band.", story13Debrief: "Drei Menschen hinterließen in derselben Nacht ihre eigene Zeit und Stimme.",
    story14Title: "Das unerfüllte Versprechen", story14Description: "Der letzte Empfänger erkennt nur deine eigenen Taten an und verlangt keine Nachahmung des früheren Besitzers.", story14Objective: "Begrenzte Fakten prüfen und eine feste Schlussnachricht mit echtem CW senden.", story14Brief: "QSL, geduldiges Hören, korrigiertes Relais und Nachtplan prüfen, dann SIM14FP rufen.", story14Debrief: "Die letzte Seite des alten Logs ist versiegelt; die nächste gehört dir.",
    story15Title: "Die erste Seite", story15Description: "Das alte Log ist geschlossen. Schreibe deine erste Seite mit einem echten gewöhnlichen Kontakt.", story15Objective: "Nach Annahme ein gewöhnliches QSO mit positiver Belohnung abschließen und ein festes Open-Station-Ziel wählen.", story15Brief: "Betritt die normale Station. Ereignis- und frühere QSOs zählen nicht.", story15Debrief: "Die erste Seite ist geschrieben. Open Station beginnt hier.",
    weatherTitle: "Wetter über Funk", weatherDescription: "Füge dem Stationslog eine Wetterbeobachtung aus der Ferne hinzu.", weatherObjective: "Einen bestätigten WEATHER-Frage-und-Antwort-Austausch abschließen.",
    relayTitle: "Staffel durch den Schwund", relayDescription: "Sinkt das Signal ins Rauschen, zählt Geduld mehr als Leistung.", relayObjective: "Bei P0–P2 mit AGN oder QRS zurückfinden und das QSO abschließen.",
    equipmentTitle: "Geräteerprobung", equipmentDescription: "Gib einem neuen Funkgerät oder Zubehör den ersten echten Kontakt.", equipmentObjective: "Ein QSO mit einem anderen als dem Startgerät oder mit montiertem Zubehör abschließen.",
    contestTitle: "Kurzes Contest-Fenster", contestDescription: "Das Band ist voll; der Austausch muss schnell und klar sein.", contestObjective: "Ein QSO mit mindestens 22 WPM, Genauigkeit 90, Rhythmus 85 und ohne Wiederholung abschließen.",
    friendshipTitle: "Ein bekanntes Rufzeichen", friendshipDescription: "Triff ein bekanntes Rufzeichen wieder und tausche mehr als einen Rapport aus.", friendshipObjective: "Eine bekannte Station kontaktieren oder einen persönlichen Themenaustausch abschließen.",
    cleanTitle: "Saubere Wache", cleanDescription: "Sichere Grundlagen bleiben die verlässlichste Einnahme der Station.", cleanObjective: "Nach Annahme ein QSO mit mindestens 85 Sendegenauigkeit, 75 Rhythmus und ohne Wiederholung abschließen.",
    weakTitle: "Schwaches Fenster", weakDescription: "Bewahre Geduld zwischen Rauschen und Schwund.", weakObjective: "Nach Annahme ein QSO bei Ausbreitungsstufe P0–P2 abschließen.",
    regionsTitle: "Zwei Regionen", regionsDescription: "Höre während einer Wache zwei verschiedene Regionen.", regionsObjective: "Nach Annahme QSOs mit zwei verschiedenen Regionen abschließen.",
    distanceTitle: "Dreitausend Kilometer", distanceDescription: "Nutze eine Öffnung über einen fernen Horizont.", distanceObjective: "Nach Annahme ein QSO über mindestens 3.000 km abschließen.",
    independentTitle: "Selbstständige Wache", independentDescription: "Schließe die Führung und vertraue den eigenen Ohren.", independentObjective: "Nach Annahme ein QSO ohne Führung oder visuelle Hilfe abschließen.",
  },
  ru: {
    title: "Центр заданий", kicker: "Незавершённый журнал", story: "Сюжетный журнал", daily: "Обычные поручения", chapter: "Глава", progress: "Прогресс",
    available: "Доступно", active: "Выполняется", ready: "Награда готова", locked: "Закрыто", claimed: "Завершено",
    accept: "Принять задание", claim: "Получить награду", abandon: "Отказаться", close: "Назад в Центр управления", money: "Деньги", tp: "Очко технологии",
    storyProgress: "Прогресс журнала", dailyNote: "Каждый день создаются три поручения по данным станции. Одновременно активны не более двух; принятые поручения сохраняются после смены дня.",
    limit: "Все места обычных поручений заняты", targetCallsign: "Приоритетный приём", propagation: "Целевая станция ответит, только если текущая трасса распространения её достигает.",
    brief: "Сводка задания", debrief: "Итоговый отчёт", contractClues: "Условия связи", requiredPropagation: "Прохождение", requiredTopics: "Обязательные темы", recoveryActions: "Восстановление связи",
    relationship: "Связь с целевой станцией", completedQsos: "Завершённые QSO", weakSignalRecoveries: "Восстановления слабого сигнала", launchEvent: "Войти на спецстанцию", annualReplay: "Ежегодный повтор", practiceRun: "Практика события", launchExpedition: "Войти на полевую станцию", launchQslStory: "Начать расследование QSL", launchServiceNet: "Войти в сеть общественной службы", launchCoordinateRelay: "Начать ретрансляцию координат", launchContest: "Начать пятиминутный контест", launchListening: "Начать тихое прослушивание",
    story01Title: "Первое включение", story01Description: "Слова незнакомца «я вас слышу» возвращают звук в тихую комнату.", story01Objective: "Завершите и сохраните первое QSO.",
    story02Title: "Позывной на бумаге", story02Description: "SIM3RA обведён в выцветшем журнале. Помнит ли оператор незавершённую страницу?", story02Objective: "Проведите QSO с SIM3RA и хотя бы один раз используйте AGN K.",
    story03Title: "Разные ритмы", story03Description: "Кто-то осторожен, кто-то спешит, кому-то нужен медленный темп. Научитесь слышать различия.", story03Objective: "Проведите QSO с тремя разными стилями операторов.",
    story01Brief: "В комнате тихо. Передайте первый CQ и отправьте свой позывной в невидимую даль.", story01Debrief: "Первая строка журнала больше не пуста. Где-то кто-то остановился и услышал вас.",
    story02Brief: "В старом журнале остались только SIM3RA и пробел. Если сигнал принят не полностью, попросите повторить через AGN K.", story02Debrief: "Просьба повторить не оборвала связь, а наконец дала старой странице полный ответ.",
    story03Brief: "Слушайте не только точки и тире, но и паузы, подтверждения и ожидание. Свяжитесь с тремя стилями работы.", story03Debrief: "За тремя разными ритмами оказались три разных человека. Радио — уже не только очки и знаки.",
    story04Title: "По ту сторону дождя", story04Description: "Дождь заполняет окно, а метеосводка SIM2DX распадается в замираниях.", story04Objective: "Обменяться WEATHER с SIM2DX при P0–P2 и восстановить пропуск командой AGN или QRS.", story04Brief: "Удержите слабый сигнал и примите погоду. При пропусках используйте AGN, при высокой скорости — QRS. Не дайте дождю унести сообщение.", story04Debrief: "Метеосводка записана полностью. Сквозь дождь и шум две далёкие комнаты ненадолго разделили один сигнал.",
    story05Title: "Огни в эфире", story05Description: "Майский памятный позывной загорается в ночи. SORA передаёт вам ключ SIM5LT.", story05Objective: "Завершите сюжетное событие и получите не ниже базового уровня.", story05Brief: "Сначала вызовите SORA на SIM5LT. Затем примите спецстанцию и за восемь минут разберите позывные, RST и регионы из pile-up.", story05Debrief: "Последнее 73 растворяется в шуме. Огни с шести направлений встречаются на одной странице вашего журнала.",
    story06Title: "Полевая станция на холме", story06Description: "Заёмные радио, проволочная антенна и батарея ждут ветра на холме.", story06Objective: "Проведите полевое QSO с QTH, PWR и ANT.", story06Brief: "Выберите вымышленный холм, правильно установите комплект и завершите обмен до разряда батареи.", story06Debrief: "Когда провод убран, дальний ответ остаётся памятью за пределами ветра.",
    story07Title: "Вопрос QSL", story07Description: "В одной QSL с холма остались две версии. SORA согласна сверить их в эфире.", story07Objective: "Передайте уточнение QSL, примите ответ SORA и сохраните итоговое решение.", story07Brief: "Сравните записи и запросите уточнение по номеру дела и своему позывному; при необходимости используйте AGN или QRS.", story07Debrief: "Факты проверены снова, а ваше решение осталось в записи о людях.",
    story08Title: "Город без света", story08Description: "Учебное вымышленное отключение направляет три служебных сообщения на SIM8PS одновременно.", story08Objective: "Зарегистрируйтесь и по порядку подтвердите номера и приоритеты трёх сообщений.", story08Brief: "Это вымышленное учение. Примите фиксированные сообщения и отправьте ACK по приоритету; при необходимости используйте AGN или QRS.", story08Debrief: "Три квитанции вошли в журнал по порядку. Реальной диспетчеризации не было — только ясная и спокойная тренировка связи.",
    story09Title: "Координаты", story09Description: "Вымышленный пакет Пиксельной сетки должен без изменений пройти между двумя станциями.", story09Objective: "Повторите сетку, UTC, число людей и проверку, затем завершите ретрансляцию.", story09Brief: "Примите пакет SIM9CR, исправьте жёсткие поля и передайте тот же канонический пакет SIM9RL.", story09Debrief: "Две станции и один полный пакет теперь связаны одинаковыми проверенными полями.",
    story10Title: "Тесный эфир", story10Description: "SIM0CT открывает вымышленное пятиминутное окно, где скорость подчиняется точности и вежливости.", story10Objective: "Проведите шесть связей, по две RUN/S&P, минимум с тремя регионами.", story10Brief: "Переключайтесь между RUN-пайлапом и S&P-пулом. Точно передавайте RST, номер, регион и мощность; при необходимости используйте AGN/QRS.", story10Debrief: "Тесная частота затихла. Счёт запомнил скорость и паузы ради точности и вежливости.",
    story11Title: "Тот, кто не слышит", story11Description: "SIM11LS не ответит. Тишина тоже является наблюдением, которое требует терпения.", story11Objective: "Наблюдайте три окна, передайте один направленный вызов, подождите и запишите тишину.", story11Brief: "Сначала наблюдайте прохождение и шум, затем вызовите SIM11LS настоящим CW. Второй вызов допустим; не выдумывайте ответ.", story11Debrief: "Запись говорит лишь, что ответа не было слышно. Вы научились прекращать вызов и продолжать слушать.",
    story12Title: "Штормовая ретрансляция", story12Description: "В сеть поступают два противоречивых сообщения. Проверьте источник и передайте единственную верную редакцию.", story12Objective: "Зарегистрируйтесь, выявите конфликт, запросите проверку и передайте MSG 214 редакции два.", story12Brief: "Это вымышленное автономное упражнение. Проверяйте REV, GRID, PEOPLE, ITEM, QTY и CHECK без догадок.", story12Debrief: "Вы не выбрали первые услышанные цифры, а проверили источник и передали отслеживаемую редакцию.",
    story13Title: "Та же ночь", story13Description: "Четыре знакомых человека появляются в коротких отдельных окнах; одна связь не должна стирать остальных.", story13Objective: "Проведите три разные связи в трёх неперекрывающихся окнах.", story13Brief: "Следите за автономной панелью. В открытом окне вызовите настоящим CW и передайте RST с условным диапазоном.", story13Debrief: "Три разных человека оставили своё время и голос в одной ночи.",
    story14Title: "Незавершённое обещание", story14Description: "Последний получатель признаёт только ваши действия и не требует подражать прежнему владельцу.", story14Objective: "Проверьте ограниченные факты и передайте фиксированное итоговое сообщение настоящим CW.", story14Brief: "Проверьте QSL, терпеливое прослушивание, исправленную ретрансляцию и ночное расписание, затем вызовите SIM14FP.", story14Debrief: "Последняя страница старого журнала запечатана; следующая будет вашей.",
    story15Title: "Первая страница", story15Description: "Старый журнал закрыт. Напишите свою первую страницу настоящей обычной связью.", story15Objective: "После принятия проведите обычную QSO с положительной наградой и выберите фиксированную цель Открытой станции.", story15Brief: "Войдите в обычную станцию. Событийные и прежние QSO не учитываются.", story15Debrief: "Первая страница написана. Здесь начинается Открытая станция.",
    weatherTitle: "Погода в эфире", weatherDescription: "Добавьте в журнал станции наблюдение погоды издалека.", weatherObjective: "Завершите вопрос и ответ WEATHER с подтверждением другой станции.",
    relayTitle: "Эстафета сквозь замирания", relayDescription: "Когда сигнал тонет в шуме, терпение важнее мощности.", relayObjective: "При P0–P2 восстановите связь через AGN или QRS и завершите QSO.",
    equipmentTitle: "Испытание аппаратуры", equipmentDescription: "Дайте новой радиостанции или аксессуару первый настоящий контакт.", equipmentObjective: "Проведите QSO не на начальной станции или с установленным аксессуаром.",
    contestTitle: "Короткое окно соревнования", contestDescription: "Диапазон загружен; обмен должен быть быстрым и ясным.", contestObjective: "Завершите QSO на 22 WPM или быстрее, с точностью 90, ритмом 85 и без повторов.",
    friendshipTitle: "Знакомый позывной", friendshipDescription: "Снова встретьте знакомый позывной и обменяйтесь чем-то кроме рапорта.", friendshipObjective: "Свяжитесь со знакомой станцией или завершите обмен на личную тему.",
    cleanTitle: "Чистая вахта", cleanDescription: "Уверенная основа остаётся самым надёжным доходом станции.", cleanObjective: "После принятия проведите QSO с точностью не ниже 85, ритмом не ниже 75 и без повторов.",
    weakTitle: "Слабое окно", weakDescription: "Сохраняйте терпение среди шума и замираний.", weakObjective: "После принятия проведите QSO при уровне распространения P0–P2.",
    regionsTitle: "Два региона", regionsDescription: "Услышьте два разных региона за одну вахту.", regionsObjective: "После принятия проведите QSO с двумя разными регионами.",
    distanceTitle: "Три тысячи километров", distanceDescription: "Поймайте прохождение за далёкий горизонт.", distanceObjective: "После принятия проведите QSO на расстоянии не менее 3 000 км.",
    independentTitle: "Самостоятельная вахта", independentDescription: "Отключите подсказки и полагайтесь на собственный слух.", independentObjective: "После принятия проведите QSO без подсказок и визуальной помощи.",
  },
};

function statusText(t, status) {
  return t[status] ?? status;
}
function missionNarrative(mission, t) {
  const showDebrief = ["ready", "claimed"].includes(mission.status);
  const key = showDebrief ? mission.debriefKey : mission.briefKey;
  return {
    kind: showDebrief ? "debrief" : "brief",
    label: showDebrief ? t.debrief : t.brief,
    text: (key && t[key]) || t[mission.descriptionKey],
  };
}

function missionContractClues(mission, t) {
  const contract = mission.contract ?? {};
  const weakObjective = ["weak-qso", "recovered-qso"].includes(mission.objective);
  const maximumPropagationLevel = contract.maximumPropagationLevel ?? (weakObjective ? 2 : null);
  const requiredTopics = contract.requiredTopics?.length
    ? contract.requiredTopics : mission.objective === "weather-exchange" ? ["WEATHER"] : [];
  const recoveryActions = contract.recoveryActions?.length
    ? contract.recoveryActions : mission.objective === "recovered-qso" ? ["AGN", "QRS"] : [];
  return [
    maximumPropagationLevel !== null
      ? { kind: "propagation", label: t.requiredPropagation, value: `P0–P${maximumPropagationLevel}` } : null,
    requiredTopics.length
      ? { kind: "topics", label: t.requiredTopics, value: requiredTopics.join(" / ") } : null,
    recoveryActions.length
      ? { kind: "recovery", label: t.recoveryActions, value: recoveryActions.join(" / ") } : null,
  ].filter(Boolean);
}

function MissionCard({ mission, t, mediaText, lightsCopy, openStationTitle, dailyLimitReached, lightsModes, expeditionReplay, serviceNetReplay, coordinateRelayReplay, contestReplay, listeningReplay, stormRelayReplay, nightOperationsReplay, finalPromiseReplay, onAccept, onClaim, onAbandon, onLaunchChapterOne, onLaunchLights, onLaunchExpedition, onLaunchQslStory, onLaunchServiceNet, onLaunchCoordinateRelay, onLaunchContest, onLaunchListening, onLaunchStormRelay, onLaunchNightOperations, onLaunchFinalPromise, onLaunchFirstPageQso, onOpenStation, onOpenMedia }) {
  const ready = mission.status === "ready";
  const active = mission.status === "active";
  const available = mission.status === "available";
  const acceptDisabled = mission.type === "daily" && dailyLimitReached;
  const percent = Math.max(0, Math.min(100, Math.round((mission.current / Math.max(1, mission.target)) * 100)));
  const narrative = missionNarrative(mission, t);
  const contractClues = missionContractClues(mission, t);
  const completedQsos = Math.max(0, Math.floor(Number(mission.relationship?.completedQsos) || 0));
  const weakSignalRecoveries = Math.max(0, Math.floor(Number(mission.relationship?.weakSignalRecoveries) || 0));
  const media = mission.type === "story" ? chapterMedia(mission.chapter) : null;
  return (
    <article className={`mission-card mission-${mission.status}`} data-mission-id={mission.id} data-mission-status={mission.status}>
      <div className="mission-card-code">
        <span>{mission.type === "story" ? `${t.chapter} ${String(mission.chapter).padStart(2, "0")}` : mission.dayKey}</span>
        <b>{statusText(t, mission.status)}</b>
      </div>
      <div className="mission-card-title">
        {mission.status === "locked" ? <LockKey size={24} weight="fill" /> : mission.type === "story" ? <BookOpenText size={24} weight="fill" /> : <Crosshair size={24} weight="duotone" />}
        <div><h3>{t[mission.titleKey]}</h3></div>
      </div>
      {media && <button type="button" className="mission-media-preview" onClick={() => onOpenMedia(mission)} disabled={mission.status === "locked"} aria-label={`${mediaText.open}: ${t[mission.titleKey]}`}>
        <img className="mission-media-scene" src={media.scene} loading="lazy" alt="" />
        <img className="mission-media-portrait" src={media.portrait} loading="lazy" alt="" />
        <span>{mediaText.open}</span>
      </button>}
      <div className="mission-narrative" data-mission-narrative={narrative.kind}>
        <b>{narrative.label}</b><p>{narrative.text}</p>
      </div>
      {mission.id === "story-05" && ["available", "active"].includes(mission.status) && <div className="mission-lights-announcement"
        data-lights-narrative-key={lightsNarrativeBeat({ stage: "announcement" }).textKey}>
        <p>{lightsCopy.narrativeNovaAnnouncement}</p>
      </div>}
      <div className="mission-objective"><SealCheck size={18} weight="fill" /><span>{t[mission.objectiveKey]}</span></div>
      {contractClues.length > 0 && <div className="mission-contract" data-mission-contract={mission.contract?.missionPhase ?? mission.objective}>
        <b>{t.contractClues}</b>
        <ul>{contractClues.map((clue) => <li key={clue.kind} data-contract-clue={clue.kind}><span>{clue.label}</span><strong>{clue.value}</strong></li>)}</ul>
      </div>}
      {mission.targetCallsign && <div className="mission-target" data-relationship-callsign={mission.targetCallsign}>
        <div className="mission-target-identity"><b>{t.targetCallsign}</b><strong>{mission.targetCallsign}</strong><small>{t.propagation}</small></div>
        <div className="mission-relationship">
          <b>{t.relationship}</b>
          <span data-relationship-stat="completedQsos">{t.completedQsos}<strong>{completedQsos}</strong></span>
          <span data-relationship-stat="weakSignalRecoveries">{t.weakSignalRecoveries}<strong>{weakSignalRecoveries}</strong></span>
        </div>
      </div>}
      <div className="mission-progress-row">
        <span>{t.progress}</span><strong>{mission.current}/{mission.target}</strong>
        <div className="mission-progress-track"><i style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="mission-reward"><Coins size={17} weight="fill" /><span>+{mission.moneyReward} {t.money}</span>{mission.technologyPointsReward > 0 && <em>+{mission.technologyPointsReward} TP</em>}</div>
      <div className="mission-actions">
        {available && <button data-action="accept-mission" data-mission-action-id={mission.id} disabled={acceptDisabled} onClick={() => onAccept(mission.id)}><Play size={17} weight="fill" />{acceptDisabled ? t.limit : t.accept}</button>}
        {mission.id === "story-01" && (active || ready) && onLaunchChapterOne && <button data-action="launch-chapter-one" onClick={onLaunchChapterOne}><BookOpenText size={17} />{t[mission.titleKey]}</button>}
        {mission.id === "story-05" && active && <button data-action="launch-lights-story" onClick={() => onLaunchLights("story")}><Play size={17} weight="fill" />{t.launchEvent}</button>}
        {mission.id === "story-06" && active && <button data-action="launch-expedition-story" onClick={onLaunchExpedition}><Play size={17} weight="fill" />{t.launchExpedition}</button>}
        {mission.id === "story-06" && expeditionReplay && !active && <button data-action="launch-expedition-replay" onClick={onLaunchExpedition}><Play size={17} weight="fill" />{t.launchExpedition}</button>}
        {mission.id === "story-07" && active && <button data-action="launch-qsl-story" onClick={onLaunchQslStory}><Play size={17} weight="fill" />{t.launchQslStory}</button>}
        {mission.id === "story-08" && (active || serviceNetReplay) && <button data-action="launch-service-net" onClick={onLaunchServiceNet}><Play size={17} weight="fill" />{t.launchServiceNet}</button>}
        {mission.id === "story-09" && (active || coordinateRelayReplay) && <button data-action="launch-coordinate-relay" onClick={onLaunchCoordinateRelay}><Play size={17} weight="fill" />{t.launchCoordinateRelay}</button>}
        {mission.id === "story-10" && (active || contestReplay) && <button data-action="launch-contest" onClick={onLaunchContest}><Play size={17} weight="fill" />{t.launchContest}</button>}
        {mission.id === "story-11" && (active || listeningReplay) && <button data-action="launch-listening" onClick={onLaunchListening}><Play size={17} weight="fill" />{t.launchListening}</button>}
        {mission.id === "story-12" && (active || stormRelayReplay) && <button data-action="launch-storm-relay" onClick={onLaunchStormRelay}><Play size={17} weight="fill" />{t[mission.titleKey]}</button>}
        {mission.id === "story-13" && (active || nightOperationsReplay) && <button data-action="launch-night-operations" onClick={onLaunchNightOperations}><Play size={17} weight="fill" />{t[mission.titleKey]}</button>}
        {mission.id === "story-14" && (active || finalPromiseReplay) && <button data-action="launch-final-promise" onClick={onLaunchFinalPromise}><Play size={17} weight="fill" />{t[mission.titleKey]}</button>}
        {mission.id === "story-15" && active && <button data-action="launch-first-page-qso" onClick={onLaunchFirstPageQso}><Radio size={17} weight="fill" />{t[mission.titleKey]}</button>}
        {mission.id === "story-15" && mission.status === "claimed" && <button data-action="open-station-dashboard" onClick={onOpenStation}><Radio size={17} weight="fill" />{openStationTitle}</button>}
        {active && <button className="mission-abandon" data-action="abandon-mission" data-mission-action-id={mission.id} onClick={() => onAbandon(mission.id)}><Trash size={17} />{t.abandon}</button>}
        {ready && <button className="mission-claim" data-action="claim-mission" data-mission-action-id={mission.id} onClick={() => onClaim(mission.id)}><CheckCircle size={17} weight="fill" />{t.claim}</button>}
        {mission.id === "story-05" && mission.status === "claimed" && <>
          <button data-action="launch-lights-annual" disabled={!lightsModes?.annualAvailable} onClick={() => onLaunchLights("annual")}><CalendarDots size={17} weight="fill" />{t.annualReplay}</button>
          <button data-action="launch-lights-practice" disabled={!lightsModes?.practiceAvailable} onClick={() => onLaunchLights("practice")}><Play size={17} weight="fill" />{t.practiceRun}</button>
        </>}
      </div>
    </article>
  );
}

export function MissionCenterModal({ language, save, onAccept, onClaim, onAbandon, onLaunchChapterOne, onLaunchLights, onLaunchExpedition, onLaunchQslStory, onLaunchServiceNet, onLaunchCoordinateRelay, onLaunchContest, onLaunchListening, onLaunchStormRelay, onLaunchNightOperations, onLaunchFinalPromise, onLaunchFirstPageQso, onOpenStation, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const mediaText = MEDIA_TEXT[language] ?? MEDIA_TEXT.en;
  const lightsCopy = lightsText(language);
  const openStationTitle = (OPEN_STATION_TEXT[language] ?? OPEN_STATION_TEXT.en).title;
  const [tab, setTab] = useState("story");
  const [selectedMediaMission, setSelectedMediaMission] = useState(null);
  const board = useMemo(() => missionBoard(save), [save]);
  const summary = useMemo(() => missionSummary(save), [save]);
  const lightsModes = useMemo(() => lightsEntryModes(save, new Date()), [save]);
  const expeditionReplay = expeditionReplayAvailable(save);
  const serviceNetReplay = serviceNetReplayAvailable(save);
  const coordinateRelayReplay = coordinateRelayReplayAvailable(save);
  const contestReplay = contestReplayAvailable(save);
  const listeningReplay = listeningReplayAvailable(save);
  const stormRelayReplay = stormRelayReplayAvailable(save);
  const nightOperationsReplay = nightOperationsReplayAvailable(save);
  const finalPromiseReplay = finalPromiseReplayAvailable(save);
  const activeDaily = board.daily.filter(({ status }) => ["active", "ready"].includes(status)).length;
  const missions = tab === "story" ? board.story : board.daily;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (selectedMediaMission) setSelectedMediaMission(null);
      else onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedMediaMission]);

  const selectedMedia = chapterMedia(selectedMediaMission?.chapter);

  return (
    <div className="modal-backdrop mission-center-backdrop" data-testid="mission-center-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="mission-center-modal" data-testid="mission-center-modal" role="dialog" aria-modal="true" aria-labelledby="mission-center-title">
        <header>
          <BookOpenText size={38} weight="fill" />
          <div><span>{t.kicker}</span><h2 id="mission-center-title">{t.title}</h2></div>
          <div className="mission-center-summary"><small>{t.storyProgress}</small><strong>{summary.storyClaimed}/{summary.storyTotal}</strong><b><Coins size={16} weight="fill" />{save.money}</b></div>
          <button className="icon-button" data-action="close-missions" onClick={onClose} aria-label={t.close}><X size={22} weight="bold" /></button>
        </header>
        <nav className="mission-center-tabs" aria-label={t.title}>
          <button className={tab === "story" ? "selected" : ""} data-mission-tab="story" onClick={() => { setTab("story"); setSelectedMediaMission(null); }}><BookOpenText size={20} weight="fill" />{t.story}</button>
          <button className={tab === "daily" ? "selected" : ""} data-mission-tab="daily" onClick={() => { setTab("daily"); setSelectedMediaMission(null); }}><CalendarDots size={20} weight="fill" />{t.daily}<span>{activeDaily}/{MAX_ACTIVE_DAILY_MISSIONS}</span></button>
        </nav>
        <div className="mission-center-body">
          {tab === "daily" && <p className="mission-daily-note">{t.dailyNote}</p>}
          {selectedMedia && <section className="chapter-media-viewer" data-chapter-media-viewer={selectedMedia.chapter} aria-label={`${mediaText.open}: ${t[selectedMediaMission.titleKey]}`}>
            <header><div><span>{t.chapter} {String(selectedMedia.chapter).padStart(2, "0")}</span><h3>{t[selectedMediaMission.titleKey]}</h3></div><button type="button" onClick={() => setSelectedMediaMission(null)} aria-label={mediaText.close}><X size={18} weight="bold" />{mediaText.close}</button></header>
            <figure className="chapter-media-illustration"><img src={selectedMedia.illustration} alt={`${t[selectedMediaMission.titleKey]} — ${mediaText.illustration}`} /><figcaption>{mediaText.illustration}</figcaption></figure>
            <figure><img src={selectedMedia.scene} alt={`${t[selectedMediaMission.titleKey]} — ${mediaText.scene}`} /><figcaption>{mediaText.scene}</figcaption></figure>
            <figure><img src={selectedMedia.portrait} alt={`${t[selectedMediaMission.titleKey]} — ${mediaText.portrait}`} /><figcaption>{mediaText.portrait}</figcaption></figure>
          </section>}
          <div className="mission-list">
            {missions.map((mission) => <MissionCard key={mission.id} mission={mission} t={t} mediaText={mediaText} lightsCopy={lightsCopy} openStationTitle={openStationTitle} dailyLimitReached={activeDaily >= MAX_ACTIVE_DAILY_MISSIONS} lightsModes={lightsModes} expeditionReplay={expeditionReplay} serviceNetReplay={serviceNetReplay} coordinateRelayReplay={coordinateRelayReplay} contestReplay={contestReplay} listeningReplay={listeningReplay} stormRelayReplay={stormRelayReplay} nightOperationsReplay={nightOperationsReplay} finalPromiseReplay={finalPromiseReplay} onAccept={onAccept} onClaim={onClaim} onAbandon={onAbandon} onLaunchChapterOne={onLaunchChapterOne} onLaunchLights={onLaunchLights} onLaunchExpedition={onLaunchExpedition} onLaunchQslStory={onLaunchQslStory} onLaunchServiceNet={onLaunchServiceNet} onLaunchCoordinateRelay={onLaunchCoordinateRelay} onLaunchContest={onLaunchContest} onLaunchListening={onLaunchListening} onLaunchStormRelay={onLaunchStormRelay} onLaunchNightOperations={onLaunchNightOperations} onLaunchFinalPromise={onLaunchFinalPromise} onLaunchFirstPageQso={onLaunchFirstPageQso} onOpenStation={onOpenStation} onOpenMedia={setSelectedMediaMission} />)}
          </div>
        </div>
        <footer><span>{save.callsign} // {summary.ready} {t.ready}</span><button data-action="close-missions-footer" onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.close}</button></footer>
      </section>
    </div>
  );
}
