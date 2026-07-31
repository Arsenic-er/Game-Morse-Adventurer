import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Broadcast, Check, Crosshair, Ear, Eye, EyeSlash,
  GearSix, Keyboard, Lightning, Play, Radio, SpeakerHigh, X,
} from "@phosphor-icons/react";
import { encodeTextToEvents } from "../cw/morse.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  emptyPracticeRecords, practiceLessonPlan, practiceMasteryFeedback, practiceStatsByMode, practiceWeakTargets, recordPracticeAttempt,
  summarizePracticeProgress,
  updatePracticePreference,
} from "./practiceRecords.js";
import {
  PRACTICE_DIFFICULTIES, PRACTICE_MODES, PRACTICE_SESSION_TYPES, completePracticeSession, createPracticeSession,
  createWeaknessReviewSession, currentPracticeQuestion,
  evaluateReception, evaluateSending, isReceptionMode, isSendingMode, normalizePracticeStats,
  practiceDifficultyProfile, practiceLessonContent, practiceLessonCount, practiceReceiveWpm, settlePracticeQuestion, summarizePracticeSession,
  WEAKNESS_REVIEW_QUESTION_LIMIT,
} from "./practiceEngine.js";
import { PRACTICE_CALLSIGN_REGIONS, normalizePracticeCallsignRegion } from "./practiceCallsignCatalog.js";

const ASSETS = {
  room: "./assets/radio-room-bg.png",
  manual: "./assets/manual-key.png",
  automatic: "./assets/automatic-key.png",
};

const TEXT = {
  "zh-CN": {
    title: "CW 练习台", back: "返回开始界面", settings: "设置", independent: "独立训练环境 · 不受传播影响",
    characterRx: "字符接收", callsignRx: "呼号接收", manualTx: "手键练习", paddleTx: "双桨练习",
    listen: "播放题目", answer: "输入抄收到的内容", submit: "提交成绩", next: "下一题", replay: "回放输入",
    visualOn: "关闭视觉辅助", visualOff: "开启视觉辅助", target: "训练目标", decoded: "当前解码",
    fixedSpeed: "系统速度", detectedSpeed: "识别速度", automaticSpeed: "自动键速度", correct: "正确", wrong: "不正确", waiting: "等待输入",
    attempts: "题数", correctCount: "正确题数", accuracy: "正确率", rhythm: "平均节奏", weak: "薄弱字符", noWeak: "暂无",
    manualHint: "按住空格键发报", paddleHint: "Z 点桨 / X 划桨", sim: "所有呼号均为程序生成的 SIM 虚构台站",
    session: "本次训练", lifetime: "累计记录", recordingTo: "成绩记录至", sessionOnly: "仅本次训练 · 选择存档后可保存成绩",
    endSession: "结束训练", summaryTitle: "训练总结", summarySubtitle: "本次练习已经结算", continueTraining: "继续训练", leavePractice: "返回开始界面",
    difficulty: "难度", guided: "引导", standard: "标准", challenge: "挑战", lesson: "课程", lessonProgress: "课程进度",
    pass: "课程通过", retry: "尚未达标，请重试", unlocked: "已解锁下一课", completed: "课程全部完成", switchLocked: "答题后将在下一轮切换",
    lessonContents: "本课内容", introduced: "本课新增", practiceRange: "练习题池", masteryProgress: "本课达标进度",
    completedLessons: "已完成课程", currentBlock: "当前计分块", passRule: "达标规则", remainingQuestions: "剩余题数", correctNeeded: "尚需答对",
    thresholdSecured: "所需正确题数已满足，请完成剩余题目", cannotPass: "本计分块已无法达标，完成后将重新开始", blockProgressing: "继续完成本计分块", blockNotStarted: "尚未开始本课计分",
    replayNoProgress: "复习已完成课程，不计入当前课程达标进度", curriculumOverview: "课程总览",
    callsignRegion: "呼号地区", callsignRegions: { all: "全部", japan: "日本", usa: "美国", china: "中国", europe: "欧洲" },
    weakReview: "薄弱专项复习", weakReviewActive: "专项复习中", weakReviewTargets: "专项题池", weakReviewUnavailable: "完成错题后开放",
    weakReviewRecoveryHint: "专项中答对会削减该字符的薄弱权重", recoveredPoints: "恢复点数", remainingWeakness: "剩余薄弱权重",
    weakReviewComplete: "专项复习完成", weaknessMastered: "薄弱项已掌握", weaknessMasteredDetail: "薄弱权重已归零，下次不再进入专项；正式课程进度不变", weakReviewNoProgress: "累计成绩已更新，正式课程进度没有变化", returnToLesson: "返回正式课程",
  },
  "zh-TW": {
    title: "CW 練習臺", back: "返回開始介面", settings: "設定", independent: "獨立訓練環境 · 不受傳播影響",
    characterRx: "字元接收", callsignRx: "呼號接收", manualTx: "手鍵練習", paddleTx: "雙槳練習",
    listen: "播放題目", answer: "輸入抄收到的內容", submit: "提交成績", next: "下一題", replay: "重播輸入",
    visualOn: "關閉視覺輔助", visualOff: "開啟視覺輔助", target: "訓練目標", decoded: "目前解碼",
    fixedSpeed: "系統速度", detectedSpeed: "識別速度", automaticSpeed: "自動鍵速度", correct: "正確", wrong: "不正確", waiting: "等待輸入",
    attempts: "題數", correctCount: "正確題數", accuracy: "正確率", rhythm: "平均節奏", weak: "薄弱字元", noWeak: "暫無",
    manualHint: "按住空白鍵發報", paddleHint: "Z 點槳 / X 劃槳", sim: "所有呼號均為程式生成的 SIM 虛構臺站",
    session: "本次訓練", lifetime: "累計記錄", recordingTo: "成績儲存至", sessionOnly: "僅限本次訓練 · 選擇存檔後可儲存成績",
    endSession: "結束訓練", summaryTitle: "訓練總結", summarySubtitle: "本次練習已完成結算", continueTraining: "繼續訓練", leavePractice: "返回開始介面",
    difficulty: "難度", guided: "引導", standard: "標準", challenge: "挑戰", lesson: "課程", lessonProgress: "課程進度",
    pass: "課程通過", retry: "尚未達標，請重試", unlocked: "已解鎖下一課", completed: "課程全部完成", switchLocked: "作答後將於下一輪切換",
    lessonContents: "本課內容", introduced: "本課新增", practiceRange: "練習題庫", masteryProgress: "本課達標進度",
    completedLessons: "已完成課程", currentBlock: "目前計分區塊", passRule: "達標規則", remainingQuestions: "剩餘題數", correctNeeded: "尚需答對",
    thresholdSecured: "所需正確題數已滿足，請完成剩餘題目", cannotPass: "本計分區塊已無法達標，完成後將重新開始", blockProgressing: "繼續完成本計分區塊", blockNotStarted: "尚未開始本課計分",
    replayNoProgress: "複習已完成課程，不計入目前課程達標進度", curriculumOverview: "課程總覽",
    callsignRegion: "呼號地區", callsignRegions: { all: "全部", japan: "日本", usa: "美國", china: "中國", europe: "歐洲" },
    weakReview: "薄弱專項複習", weakReviewActive: "專項複習中", weakReviewTargets: "專項題庫", weakReviewUnavailable: "完成錯題後開放",
    weakReviewRecoveryHint: "專項中答對會削減該字元的薄弱權重", recoveredPoints: "恢復點數", remainingWeakness: "剩餘薄弱權重",
    weakReviewComplete: "專項複習完成", weaknessMastered: "薄弱項已掌握", weaknessMasteredDetail: "薄弱權重已歸零，下次不再進入專項；正式課程進度不變", weakReviewNoProgress: "累計成績已更新，正式課程進度沒有變化", returnToLesson: "返回正式課程",
  },
  ja: {
    title: "CW 練習台", back: "開始画面へ戻る", settings: "設定", independent: "独立した練習環境・伝搬の影響なし",
    characterRx: "文字受信", callsignRx: "コール受信", manualTx: "縦振り練習", paddleTx: "パドル練習",
    listen: "課題を再生", answer: "受信内容を入力", submit: "採点", next: "次の課題", replay: "入力を再生",
    visualOn: "視覚補助を閉じる", visualOff: "視覚補助を開く", target: "練習目標", decoded: "現在の復号",
    fixedSpeed: "システム速度", detectedSpeed: "認識速度", automaticSpeed: "オートキー速度", correct: "正解", wrong: "不正解", waiting: "入力待ち",
    attempts: "課題数", correctCount: "正解数", accuracy: "正解率", rhythm: "平均リズム", weak: "苦手文字", noWeak: "なし",
    manualHint: "スペースを押して送信", paddleHint: "Z 短点 / X 長点", sim: "すべてのコールはプログラム生成の架空 SIM 局です",
    session: "今回の練習", lifetime: "通算記録", recordingTo: "記録先", sessionOnly: "このセッションのみ・セーブを選ぶと記録できます",
    endSession: "練習を終了", summaryTitle: "練習結果", summarySubtitle: "今回の練習を集計しました", continueTraining: "練習を続ける", leavePractice: "開始画面へ戻る",
    difficulty: "難易度", guided: "ガイド", standard: "標準", challenge: "挑戦", lesson: "レッスン", lessonProgress: "進捗",
    pass: "レッスン合格", retry: "基準未達・再挑戦", unlocked: "次のレッスンを解放", completed: "全課程を完了", switchLocked: "解答後は次回から変更できます",
    lessonContents: "レッスン内容", introduced: "今回追加", practiceRange: "出題範囲", masteryProgress: "このレッスンの合格進捗",
    completedLessons: "完了レッスン", currentBlock: "現在の採点ブロック", passRule: "合格条件", remainingQuestions: "残り問題", correctNeeded: "あと必要な正解",
    thresholdSecured: "必要正解数に到達。残りを完了してください", cannotPass: "このブロックでは合格不可。完了後に再挑戦します", blockProgressing: "採点ブロックを続けてください", blockNotStarted: "このレッスンは未採点です",
    replayNoProgress: "完了済みレッスンの復習は現在の合格進捗に加算されません", curriculumOverview: "カリキュラム",
    callsignRegion: "コール地域", callsignRegions: { all: "すべて", japan: "日本", usa: "米国", china: "中国", europe: "欧州" },
    weakReview: "弱点集中練習", weakReviewActive: "集中練習中", weakReviewTargets: "集中出題", weakReviewUnavailable: "誤答後に利用できます",
    weakReviewRecoveryHint: "集中練習で正解すると、その文字の弱点ウェイトが減ります", recoveredPoints: "回復ポイント", remainingWeakness: "残り弱点ウェイト",
    weakReviewComplete: "弱点練習完了", weaknessMastered: "弱点を克服しました", weaknessMasteredDetail: "弱点ウェイトはゼロになり、次回の集中練習には入りません。正式レッスンの進捗は変わりません", weakReviewNoProgress: "通算成績のみ更新し、正式レッスンの進捗は変わりません", returnToLesson: "正式レッスンへ戻る",
  },
  en: {
    title: "CW Practice", back: "Back to title", settings: "Settings", independent: "Independent training · propagation disabled",
    characterRx: "Character RX", callsignRx: "Callsign RX", manualTx: "Straight key", paddleTx: "Paddle key",
    listen: "Play prompt", answer: "Type what you copied", submit: "Score attempt", next: "Next prompt", replay: "Replay input",
    visualOn: "Hide visual aid", visualOff: "Show visual aid", target: "Target", decoded: "Decoded",
    fixedSpeed: "System speed", detectedSpeed: "Detected speed", automaticSpeed: "Automatic key speed", correct: "Correct", wrong: "Not correct", waiting: "Waiting for input",
    attempts: "Attempts", correctCount: "Correct", accuracy: "Accuracy", rhythm: "Avg rhythm", weak: "Weak characters", noWeak: "None",
    manualHint: "Hold Space to key", paddleHint: "Z dot / X dash", sim: "All callsigns are program-generated fictional SIM stations",
    session: "This session", lifetime: "Lifetime record", recordingTo: "Recording to", sessionOnly: "Session only · select a save to keep results",
    endSession: "End session", summaryTitle: "Session summary", summarySubtitle: "This practice session has been scored", continueTraining: "Keep training", leavePractice: "Back to title",
    difficulty: "Difficulty", guided: "Guided", standard: "Standard", challenge: "Challenge", lesson: "Lesson", lessonProgress: "Lesson progress",
    pass: "Lesson passed", retry: "Target missed — retry", unlocked: "Next lesson unlocked", completed: "Curriculum complete", switchLocked: "Switch next round after answering",
    lessonContents: "Lesson contents", introduced: "New this lesson", practiceRange: "Practice pool", masteryProgress: "This lesson's pass progress",
    completedLessons: "Lessons completed", currentBlock: "Current scored block", passRule: "Pass rule", remainingQuestions: "Questions left", correctNeeded: "Correct answers needed",
    thresholdSecured: "Required correct answers reached; finish the remaining questions", cannotPass: "This block can no longer pass; finish it to restart", blockProgressing: "Continue this scored block", blockNotStarted: "This lesson has not started scoring",
    replayNoProgress: "Reviewing a completed lesson does not advance the current pass block", curriculumOverview: "Curriculum",
    callsignRegion: "Callsign region", callsignRegions: { all: "All", japan: "Japan", usa: "USA", china: "China", europe: "Europe" },
    weakReview: "Weak-target review", weakReviewActive: "Review in progress", weakReviewTargets: "Review pool", weakReviewUnavailable: "Available after a missed target",
    weakReviewRecoveryHint: "Correct review answers reduce that character's weakness weight", recoveredPoints: "Recovered", remainingWeakness: "Weakness left",
    weakReviewComplete: "Weak-target review complete", weaknessMastered: "Weak target mastered", weaknessMasteredDetail: "Its weakness weight is now zero, so it will not enter the next review; formal lesson progress is unchanged", weakReviewNoProgress: "Lifetime results updated; formal lesson progress is unchanged", returnToLesson: "Return to lesson",
  },
};

const MODE_ICONS = {
  [PRACTICE_MODES.CHARACTER_RX]: Ear,
  [PRACTICE_MODES.CALLSIGN_RX]: Radio,
  [PRACTICE_MODES.MANUAL_TX]: Lightning,
  [PRACTICE_MODES.PADDLE_TX]: Keyboard,
};

function IconButton({ label, children, ...props }) {
  return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

function recordForMode(persistentStats, mode) {
  const source = persistentStats?.modes?.[mode] ?? persistentStats?.[mode] ?? null;
  const stats = normalizePracticeStats(source?.stats ?? source);
  const recentTargets = Array.isArray(source?.recentTargets) ? source.recentTargets : [];
  return {
    stats,
    recentTargets,
    difficulty: source?.difficulty ?? PRACTICE_DIFFICULTIES.GUIDED,
    lesson: Number(source?.lesson) || 1,
    lessonAttempts: Number(source?.lessonAttempts) || 0,
    lessonCorrect: Number(source?.lessonCorrect) || 0,
    completedLessons: Number(source?.completedLessons) || 0,
    callsignRegion: mode === PRACTICE_MODES.CALLSIGN_RX
      ? normalizePracticeCallsignRegion(source?.callsignRegion)
      : PRACTICE_CALLSIGN_REGIONS.ALL,
  };
}

function recordSnapshot(record) {
  return {
    ...record.stats,
    recentTargets: [...record.recentTargets],
    difficulty: record.difficulty,
    lesson: record.lesson,
    lessonAttempts: record.lessonAttempts,
    lessonCorrect: record.lessonCorrect,
    completedLessons: record.completedLessons,
    callsignRegion: record.callsignRegion,
  };
}

function weaknessDelta(current = {}, baseline = {}) {
  return Object.fromEntries(Object.entries(current)
    .map(([character, count]) => [character, Math.max(0, Number(count) - Number(baseline[character] ?? 0))])
    .filter(([, count]) => count > 0));
}

function weaknessRecovery(current = {}, baseline = {}) {
  return Object.fromEntries(Object.entries(baseline)
    .map(([character, count]) => [character, Math.max(0, Number(count) - Number(current[character] ?? 0))])
    .filter(([, count]) => count > 0));
}

function weaknessWeight(weaknesses = {}) {
  return Object.values(weaknesses)
    .reduce((total, count) => total + Math.max(0, Number(count) || 0), 0);
}

function sessionSummary(session, baselineWeaknesses, baselineProgress = {}) {
  const summary = summarizePracticeSession(session);
  const weaknesses = weaknessDelta(summary.weaknesses, baselineWeaknesses);
  const recoveredWeaknesses = weaknessRecovery(summary.weaknesses, baselineWeaknesses);
  const recoveredPoints = weaknessWeight(recoveredWeaknesses);
  const remainingWeaknessWeight = weaknessWeight(summary.weaknesses);
  const remainingWeakCharacters = Object.entries(summary.weaknesses)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([character, misses]) => ({ character, misses }));
  const baselineCompletedLessons = Number(baselineProgress.completedLessons) || 0;
  const baselineAttempts = Number(baselineProgress.lessonAttempts) || 0;
  const baselineCorrect = Number(baselineProgress.lessonCorrect) || 0;
  const progressionEligible = summary.progressionEligible && baselineProgress.eligible === true;
  const reviewCompleted = summary.sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
    && summary.questionCount >= (session.questionLimit ?? WEAKNESS_REVIEW_QUESTION_LIMIT);
  const lessonAttempts = progressionEligible ? baselineAttempts + summary.questionCount : baselineAttempts;
  const lessonCorrect = progressionEligible ? baselineCorrect + summary.correctCount : baselineCorrect;
  const lessonAccuracy = lessonAttempts ? Math.round((lessonCorrect / lessonAttempts) * 100) : 0;
  const lessonPassed = progressionEligible && lessonAttempts >= summary.requiredAttempts
    && lessonAccuracy >= summary.requiredAccuracy;
  const nextLesson = summary.lesson === null
    ? null
    : Math.min(summary.lessonCount, summary.lesson + (lessonPassed ? 1 : 0));
  return {
    ...summary,
    progressionEligible,
    lessonAttempts,
    lessonCorrect,
    lessonAccuracy,
    lessonPassed,
    reviewCompleted,
    nextLesson,
    nextLessonUnlocked: lessonPassed && progressionEligible && summary.lesson < summary.lessonCount && summary.lesson > baselineCompletedLessons,
    curriculumCompleted: lessonPassed && progressionEligible && summary.lesson === summary.lessonCount && summary.lesson > baselineCompletedLessons,
    recoveredWeaknesses,
    recoveredPoints,
    remainingWeaknessWeight,
    remainingWeakCharacters,
    weaknesses,
    weakCharacters: Object.entries(weaknesses)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([character, misses]) => ({ character, misses })),
  };
}

function createSessionRun(mode, persistentStats, overrides = {}) {
  const record = recordForMode(persistentStats, mode);
  const weaknesses = overrides.weaknesses ?? record.stats.weaknesses;
  const recentTargets = overrides.recentTargets ?? record.recentTargets;
  const difficulty = overrides.difficulty ?? record.difficulty;
  const lesson = overrides.lesson ?? record.lesson;
  const callsignRegion = mode === PRACTICE_MODES.CALLSIGN_RX
    ? normalizePracticeCallsignRegion(overrides.callsignRegion ?? record.callsignRegion)
    : PRACTICE_CALLSIGN_REGIONS.ALL;
  const plan = practiceLessonPlan(record, mode, difficulty, lesson);
  const startedAt = new Date().toISOString();
  return {
    baselineWeaknesses: { ...weaknesses },
    baselineProgress: {
      eligible: plan.eligible,
      completedLessons: plan.completedLessons,
      lessonAttempts: plan.baselineAttempts,
      lessonCorrect: plan.baselineCorrect,
    },
    session: createPracticeSession({
      mode,
      callsignRegion,
      difficulty,
      lesson,
      startedAt,
      seed: `${mode}:${startedAt}:${Math.random().toString(36).slice(2, 10)}`,
      weaknesses,
      recentTargets,
      questionLimit: plan.questionLimit,
    }),
  };
}

function createWeaknessReviewRun(mode, persistentStats, overrides = {}) {
  const record = recordForMode(persistentStats, mode);
  const difficulty = overrides.difficulty ?? record.difficulty;
  const lesson = overrides.lesson ?? record.lesson;
  const callsignRegion = mode === PRACTICE_MODES.CALLSIGN_RX
    ? normalizePracticeCallsignRegion(overrides.callsignRegion ?? record.callsignRegion)
    : PRACTICE_CALLSIGN_REGIONS.ALL;
  const targets = practiceWeakTargets(recordSnapshot(record), mode, { lesson, limit: 5, callsignRegion });
  if (!targets.length) return null;
  const startedAt = new Date().toISOString();
  const session = createWeaknessReviewSession({
    mode,
    callsignRegion,
    difficulty,
    lesson,
    targetPool: targets.map(({ target }) => target),
    startedAt,
    seed: `${mode}:weak:${startedAt}:${Math.random().toString(36).slice(2, 10)}`,
    weaknesses: record.stats.weaknesses,
    recentTargets: record.recentTargets,
  });
  if (!session) return null;
  return {
    baselineWeaknesses: { ...record.stats.weaknesses },
    baselineProgress: {
      eligible: false,
      completedLessons: record.completedLessons,
      lessonAttempts: record.lessonAttempts,
      lessonCorrect: record.lessonCorrect,
    },
    session,
  };
}

export function PracticeScreen({
  language,
  automaticKeyWpm = 18,
  persistentStats = null,
  recordingCallsign = "",
  onRecordAttempt,
  onPreferenceChange,
  onSessionComplete,
  onBack,
  onSettings,
  inputBlocked = false,
}) {
  const t = TEXT[language] ?? TEXT.en;
  const [sessionOnlyRecords, setSessionOnlyRecords] = useState(() => emptyPracticeRecords());
  const effectivePersistentStats = recordingCallsign
    ? persistentStats
    : practiceStatsByMode(sessionOnlyRecords);
  const curriculumProgress = summarizePracticeProgress(effectivePersistentStats);
  const [run, setRun] = useState(() => createSessionRun(PRACTICE_MODES.CHARACTER_RX, effectivePersistentStats));
  const [answer, setAnswer] = useState("");
  const [visualAid, setVisualAid] = useState(false);
  const [result, setResult] = useState(null);
  const [summaryState, setSummaryState] = useState(null);
  const notifiedQuestionIdsRef = useRef(new Set());
  const session = run.session;
  const mode = session.mode;
  const callsignRegion = mode === PRACTICE_MODES.CALLSIGN_RX
    ? normalizePracticeCallsignRegion(session.callsignRegion)
    : PRACTICE_CALLSIGN_REGIONS.ALL;
  const difficulty = session.difficulty;
  const lesson = session.lesson ?? 1;
  const lessonCount = practiceLessonCount(mode);
  const difficultyProfile = practiceDifficultyProfile(difficulty);
  const question = useMemo(() => currentPracticeQuestion(session), [session]);
  const displayedQuestion = result?.question ?? question;
  const target = displayedQuestion?.target ?? "";
  const sessionStats = session.stats;
  const lifetimeRecord = useMemo(
    () => recordForMode(effectivePersistentStats, mode),
    [effectivePersistentStats, mode],
  );
  const lifetimeStats = lifetimeRecord.stats;
  const weakReviewTargets = useMemo(
    () => practiceWeakTargets(recordSnapshot(lifetimeRecord), mode, { lesson, limit: 5, callsignRegion }),
    [callsignRegion, lesson, lifetimeRecord, mode],
  );
  const reviewingWeaknesses = session.sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW;
  const lessonContent = useMemo(() => practiceLessonContent(mode, lesson, callsignRegion), [callsignRegion, lesson, mode]);
  const mastery = useMemo(
    () => practiceMasteryFeedback(lifetimeRecord, mode, { difficulty, lesson }),
    [difficulty, lesson, lifetimeRecord, mode],
  );
  const maxUnlockedLesson = Math.min(lessonCount, lifetimeRecord.completedLessons + 1);
  const sessionWeaknesses = weaknessDelta(sessionStats.weaknesses, run.baselineWeaknesses);
  const sessionWeakEntries = Object.entries(sessionWeaknesses).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const liveRecoveredPoints = weaknessWeight(weaknessRecovery(sessionStats.weaknesses, run.baselineWeaknesses));
  const liveRemainingWeakness = weaknessWeight(sessionStats.weaknesses);
  const lifetimeWeakEntries = Object.entries(lifetimeStats.weaknesses).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const cw = useCwCore({ targetText: target, automaticWpm: automaticKeyWpm });
  const receiving = isReceptionMode(mode);
  const sending = isSendingMode(mode);
  const manual = mode === PRACTICE_MODES.MANUAL_TX;
  const receiveWpm = practiceReceiveWpm(difficulty, mode);
  const morse = useMemo(() => encodeTextToEvents(target, { wpm: receiveWpm }).morse, [receiveWpm, target]);
  const resultState = result ? (result.correct ? "correct" : "wrong") : "waiting";
  const switchLocked = sessionStats.attempts > 0 || Boolean(result) || Boolean(answer.trim()) || cw.analysis.pulseCount > 0;
  const masteryStatus = mastery.curriculumCompleted
    ? t.completed
    : mastery.status === "replay"
      ? t.replayNoProgress
      : mastery.status === "cannot-pass"
      ? t.cannotPass
      : mastery.status === "threshold-secured"
        ? t.thresholdSecured
        : mastery.status === "not-started"
          ? t.blockNotStarted
          : `${t.correctNeeded}: ${mastery.correctNeeded} · ${t.remainingQuestions}: ${mastery.attemptsRemaining}`;
  const summaryReviewMastered = Boolean(summaryState?.summary.reviewCompleted
    && summaryState.summary.remainingWeaknessWeight === 0);

  useEffect(() => {
    cw.clearInput();
    setAnswer("");
  }, [cw.clearInput, displayedQuestion?.id]);

  useEffect(() => {
    if (!sending) return undefined;
    function onDown(event) {
      if (inputBlocked || result || session.completedAt || event.repeat) return;
      if (["Space", "KeyZ", "KeyX"].includes(event.code)) event.preventDefault();
      if (manual && event.code === "Space") cw.beginManual();
      if (!manual && event.code === "KeyZ") cw.beginAutomatic(".");
      if (!manual && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function onUp(event) {
      if (manual && event.code === "Space") {
        event.preventDefault();
        cw.endManual();
      }
      if (!manual && event.code === "KeyZ") {
        event.preventDefault();
        cw.endAutomatic(".");
      }
      if (!manual && event.code === "KeyX") {
        event.preventDefault();
        cw.endAutomatic("-");
      }
    }
    function onBlur() { cw.stopAll(); }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      cw.stopAll();
    };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, inputBlocked, manual, result, sending, session.completedAt]);

  function completedPayload(sourceSession, reason) {
    const completed = completePracticeSession(sourceSession);
    return {
      mode: completed.mode,
      reason,
      session: completed,
      summary: sessionSummary(completed, run.baselineWeaknesses, run.baselineProgress),
      recentTargets: completed.recentTargets,
    };
  }

  function notifyCompletion(sourceSession, reason) {
    if (!sourceSession.completedAt && sourceSession.stats.attempts > 0) {
      onSessionComplete?.(completedPayload(sourceSession, reason).summary);
    }
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return;
    cw.stopAll();
    notifyCompletion(session, "mode-change");
    setRun(createSessionRun(nextMode, effectivePersistentStats));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function changeDifficulty(nextDifficulty) {
    if (nextDifficulty === difficulty || switchLocked || reviewingWeaknesses) return;
    cw.stopAll();
    setRun(createSessionRun(mode, effectivePersistentStats, { difficulty: nextDifficulty, lesson, callsignRegion }));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function changeLesson(nextLesson) {
    if (nextLesson === lesson || nextLesson > maxUnlockedLesson || switchLocked || reviewingWeaknesses) return;
    cw.stopAll();
    setRun(createSessionRun(mode, effectivePersistentStats, { difficulty, lesson: nextLesson, callsignRegion }));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function changeCallsignRegion(value) {
    const nextRegion = normalizePracticeCallsignRegion(value);
    if (mode !== PRACTICE_MODES.CALLSIGN_RX || nextRegion === callsignRegion || switchLocked || reviewingWeaknesses) return;
    cw.stopAll();
    setRun(createSessionRun(mode, effectivePersistentStats, {
      difficulty,
      lesson,
      callsignRegion: nextRegion,
      recentTargets: [],
    }));
    if (!recordingCallsign) {
      setSessionOnlyRecords((current) => updatePracticePreference(current, mode, { callsignRegion: nextRegion }));
    }
    onPreferenceChange?.(mode, { callsignRegion: nextRegion });
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function startWeaknessReview() {
    if (reviewingWeaknesses || switchLocked || !weakReviewTargets.length) return;
    cw.stopAll();
    const nextRun = createWeaknessReviewRun(mode, effectivePersistentStats, { difficulty, lesson, callsignRegion });
    if (!nextRun) return;
    setRun(nextRun);
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function scoreAttempt() {
    if (!question || result || session.completedAt || notifiedQuestionIdsRef.current.has(question.id)) return;
    notifiedQuestionIdsRef.current.add(question.id);
    const nextResult = receiving ? evaluateReception(answer, question.target) : evaluateSending(cw.analysis, question.target);
    const nextSession = settlePracticeQuestion(session, question.id, nextResult);
    if (nextSession.questionIndex === session.questionIndex) {
      notifiedQuestionIdsRef.current.delete(question.id);
      return;
    }
    const scoredResult = { ...nextResult, question };
    setRun((current) => ({ ...current, session: nextSession }));
    setResult(scoredResult);
    onRecordAttempt?.(mode, {
      ...nextResult,
      question,
      questionId: question.id,
      target: question.target,
      recentTargets: nextSession.recentTargets,
      difficulty,
      lesson,
      callsignRegion,
      sessionType: session.sessionType,
    });
    if (!recordingCallsign) {
      setSessionOnlyRecords((current) => recordPracticeAttempt(current, mode, {
        ...nextResult,
        target: question.target,
        difficulty,
        lesson,
        callsignRegion,
        sessionType: session.sessionType,
      }));
    }
    if (nextSession.completedAt) {
      const payload = {
        mode,
        reason: reviewingWeaknesses ? "weakness-review-complete" : "lesson-complete",
        session: nextSession,
        summary: sessionSummary(nextSession, run.baselineWeaknesses, run.baselineProgress),
        recentTargets: nextSession.recentTargets,
      };
      setSummaryState(payload);
      onSessionComplete?.(payload.summary);
    }
  }

  function nextPrompt() {
    if (!result || session.completedAt) return;
    setResult(null);
  }

  function endSession() {
    cw.stopAll();
    const completed = completePracticeSession(session);
    const payload = {
      mode,
      reason: "ended",
      session: completed,
      summary: sessionSummary(completed, run.baselineWeaknesses, run.baselineProgress),
      recentTargets: completed.recentTargets,
    };
    setRun((current) => ({ ...current, session: completed }));
    setSummaryState(payload);
    if (!session.completedAt) onSessionComplete?.(payload.summary);
  }

  function continueTraining() {
    if (summaryState?.summary.reviewCompleted) {
      setRun(createSessionRun(mode, effectivePersistentStats, { difficulty, lesson, callsignRegion }));
      notifiedQuestionIdsRef.current = new Set();
      setResult(null);
      setSummaryState(null);
      return;
    }
    const latestWeaknesses = { ...session.stats.weaknesses };
    const nextLesson = summaryState?.summary.nextLessonUnlocked
      ? summaryState.summary.nextLesson
      : lesson;
    setRun(createSessionRun(mode, effectivePersistentStats, {
      weaknesses: latestWeaknesses,
      recentTargets: session.recentTargets,
      difficulty,
      lesson: nextLesson,
      callsignRegion,
    }));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setSummaryState(null);
  }

  function leavePractice() {
    cw.stopAll();
    notifyCompletion(session, "back");
    onBack();
  }

  function pointerDown(event) {
    if (result || session.completedAt) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (manual) {
      cw.beginManual();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    cw.beginAutomatic(event.clientX < bounds.left + bounds.width / 2 ? "." : "-");
  }

  function pointerEnd() {
    if (manual) {
      cw.endManual();
      return;
    }
    cw.endAutomatic(".");
    cw.endAutomatic("-");
  }

  const modeLabels = {
    [PRACTICE_MODES.CHARACTER_RX]: t.characterRx,
    [PRACTICE_MODES.CALLSIGN_RX]: t.callsignRx,
    [PRACTICE_MODES.MANUAL_TX]: t.manualTx,
    [PRACTICE_MODES.PADDLE_TX]: t.paddleTx,
  };
  const difficultyLabels = {
    [PRACTICE_DIFFICULTIES.GUIDED]: t.guided,
    [PRACTICE_DIFFICULTIES.STANDARD]: t.standard,
    [PRACTICE_DIFFICULTIES.CHALLENGE]: t.challenge,
  };

  return (
    <main
      className="screen practice-screen"
      data-practice-mode={mode}
      data-practice-callsign-region={callsignRegion}
      data-practice-difficulty={difficulty}
      data-practice-lesson={lesson}
      data-practice-lessons-completed={lifetimeRecord.completedLessons}
      data-practice-lesson-attempts={lifetimeRecord.lessonAttempts}
      data-practice-lesson-required={difficultyProfile.requiredAttempts}
      data-practice-lesson-new={lessonContent.introducedTargets.join(",")}
      data-practice-lesson-pool={lessonContent.targetPool.join(",")}
      data-practice-mastery-attempts={mastery.blockAttempts}
      data-practice-mastery-correct={mastery.blockCorrect}
      data-practice-mastery-remaining={mastery.attemptsRemaining}
      data-practice-mastery-can-pass={mastery.canStillPass ? "true" : "false"}
      data-practice-session-type={session.sessionType}
      data-practice-review-recovered={reviewingWeaknesses ? liveRecoveredPoints : 0}
      data-practice-review-remaining={reviewingWeaknesses ? liveRemainingWeakness : weaknessWeight(lifetimeStats.weaknesses)}
      data-practice-review-targets={(session.targetPool ?? weakReviewTargets.map(({ target: item }) => item)).join(",")}
      data-practice-weak-review-available={weakReviewTargets.length ? "true" : "false"}
      data-practice-question-id={displayedQuestion?.id ?? ""}
      data-practice-target={window.cwgameSystem?.qaCapture ? target : undefined}
      data-practice-attempts={sessionStats.attempts}
      data-practice-lifetime-attempts={lifetimeStats.attempts}
      data-practice-lifetime-correct={lifetimeStats.correct}
      data-practice-result={resultState}
      data-practice-recording={recordingCallsign ? "save" : "session"}
      data-pulse-count={cw.analysis.pulseCount}
      data-keyer-wpm={automaticKeyWpm}
      style={{ "--room": `url(${ASSETS.room})` }}
    >
      <header className="practice-topbar station-topbar">
        <div className="practice-title">
          <Radio size={20} weight="fill" />
          <strong>{t.title}</strong>
          <span>{t.independent}</span>
          <small className={`practice-recording-status ${recordingCallsign ? "persistent" : "session-only"}`}>
            {recordingCallsign ? `${t.recordingTo}: ${recordingCallsign}` : t.sessionOnly}
          </small>
        </div>
        <div className="top-actions"><IconButton label={t.back} data-action="practice-back" onClick={leavePractice}><ArrowLeft size={21} /></IconButton><IconButton label={t.settings} onClick={onSettings}><GearSix size={21} /></IconButton></div>
      </header>

      <div className="practice-layout">
        <aside className="practice-sidebar metal-panel">
          <div className="panel-title"><span>{t.curriculumOverview}</span><b>M2 / TRAIN</b></div>
          <nav className="practice-mode-list" aria-label={t.curriculumOverview}>
            {Object.values(PRACTICE_MODES).map((id) => {
              const ModeIcon = MODE_ICONS[id];
              const progress = curriculumProgress.modes[id];
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`practice-mode-option-${id}`}
                  data-practice-mode-option={id}
                  data-practice-mode-completed={progress.completedLessons}
                  data-practice-mode-total={progress.totalLessons}
                  data-practice-mode-percent={progress.percent}
                  className={mode === id ? "selected" : ""}
                  aria-label={`${modeLabels[id]} ${progress.completedLessons}/${progress.totalLessons}`}
                  disabled={reviewingWeaknesses}
                  onClick={() => changeMode(id)}
                >
                  <ModeIcon className="practice-mode-icon" size={22} weight="fill" />
                  <span className="practice-mode-copy">
                    <strong>{modeLabels[id]}</strong>
                    <small aria-hidden="true">{progress.completedLessons}/{progress.totalLessons}</small>
                    <span
                      className="practice-mode-progress"
                      data-testid={`practice-mode-progress-${id}`}
                      aria-hidden="true"
                    ><i style={{ width: `${progress.percent}%` }} /></span>
                  </span>
                </button>
              );
            })}
          </nav>
          <section className="practice-curriculum" aria-label={t.lessonProgress}>
            {mode === PRACTICE_MODES.CALLSIGN_RX && (
              <div className="practice-callsign-region-picker" data-testid="practice-callsign-region" data-callsign-region={callsignRegion}>
                <span>{t.callsignRegion}</span>
                <div className="practice-callsign-region-options" role="radiogroup" aria-label={t.callsignRegion}>
                  {Object.values(PRACTICE_CALLSIGN_REGIONS).map((id, index, regionIds) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={callsignRegion === id}
                      tabIndex={callsignRegion === id ? 0 : -1}
                      aria-label={t.callsignRegions[id]}
                      title={t.callsignRegions[id]}
                      data-callsign-region-option={id}
                      className={callsignRegion === id ? "selected" : ""}
                      disabled={switchLocked || reviewingWeaknesses}
                      onClick={() => changeCallsignRegion(id)}
                      onKeyDown={(event) => {
                        const delta = event.key === "ArrowLeft" || event.key === "ArrowUp"
                          ? -1
                          : event.key === "ArrowRight" || event.key === "ArrowDown"
                            ? 1
                            : 0;
                        if (!delta) return;
                        event.preventDefault();
                        const nextId = regionIds[(index + delta + regionIds.length) % regionIds.length];
                        changeCallsignRegion(nextId);
                        event.currentTarget.parentElement
                          ?.querySelector(`[data-callsign-region-option="${nextId}"]`)
                          ?.focus();
                      }}
                    >{t.callsignRegions[id]}</button>
                  ))}
                </div>
              </div>
            )}
            <header><span>{t.difficulty}</span><b>{difficultyLabels[difficulty]}</b></header>
            <div className="practice-difficulty-options">
              {Object.values(PRACTICE_DIFFICULTIES).map((id) => (
                <button
                  key={id}
                  type="button"
                  data-practice-difficulty-option={id}
                  className={difficulty === id ? "selected" : ""}
                  disabled={switchLocked || reviewingWeaknesses}
                  onClick={() => changeDifficulty(id)}
                >{difficultyLabels[id]}</button>
              ))}
            </div>
            <header><span>{t.lesson}</span><b>{lesson}/{lessonCount}</b></header>
            <div className="practice-lesson-options">
              {Array.from({ length: lessonCount }, (_, index) => index + 1).map((id) => (
                <button
                  key={id}
                  type="button"
                  data-practice-lesson-option={id}
                  className={lesson === id ? "selected" : lifetimeRecord.completedLessons >= id ? "completed" : ""}
                  disabled={switchLocked || reviewingWeaknesses || id > maxUnlockedLesson}
                  onClick={() => changeLesson(id)}
                >{id}</button>
              ))}
            </div>
            <small>{switchLocked ? t.switchLocked : `${difficultyProfile.requiredAttempts} / ${difficultyProfile.requiredAccuracy}%`}</small>
            <div className="practice-lesson-content" data-testid="practice-lesson-content">
              <span>{t.lessonContents}</span>
              <p><b>{t.introduced}</b><strong>{lessonContent.introducedTargets.join(" · ")}</strong></p>
              <p><b>{t.practiceRange}</b><code title={lessonContent.targetPool.join(" · ")}>{lessonContent.targetPool.join(" · ")}</code></p>
            </div>
            <button
              type="button"
              aria-label={`${reviewingWeaknesses ? t.weakReviewActive : t.weakReview}. ${t.weakReviewRecoveryHint}`}
              className={`practice-weak-review-button ${reviewingWeaknesses ? "active" : ""}`}
              data-action="practice-weak-review"
              data-testid="practice-weak-review"
              data-weak-review-available={weakReviewTargets.length ? "true" : "false"}
              data-weak-review-active={reviewingWeaknesses ? "true" : "false"}
              data-weak-review-targets={(session.targetPool ?? weakReviewTargets.map(({ target: item }) => item)).join(",")}
              data-weak-review-recovered={reviewingWeaknesses ? liveRecoveredPoints : 0}
              data-weak-review-remaining={reviewingWeaknesses ? liveRemainingWeakness : weaknessWeight(lifetimeStats.weaknesses)}
              disabled={reviewingWeaknesses || switchLocked || !weakReviewTargets.length}
              onClick={startWeaknessReview}
            >
              <Crosshair size={18} weight="bold" />
              <span>
                <b>{reviewingWeaknesses ? t.weakReviewActive : t.weakReview}</b>
                <small>{reviewingWeaknesses
                  ? `${t.recoveredPoints}: ${liveRecoveredPoints} · ${t.remainingWeakness}: ${liveRemainingWeakness}`
                  : weakReviewTargets.length
                    ? `${t.weakReviewTargets}: ${weakReviewTargets.map(({ target: item }) => item).join(" · ")}`
                    : t.weakReviewUnavailable}</small>
                <em title={t.weakReviewRecoveryHint}>{t.weakReviewRecoveryHint}</em>
              </span>
            </button>
          </section>
          <div className="practice-policy"><Radio size={18} /><span>{t.sim}</span></div>
        </aside>

        <section className="practice-workspace metal-panel">
          <header><span className="panel-kicker">{receiving ? "RX / COPY" : "TX / KEYING"} · {difficultyLabels[difficulty]} · {reviewingWeaknesses ? t.weakReviewActive : `${t.lesson} ${lesson}`}</span><h1>{modeLabels[mode]}</h1></header>
          <div className="practice-prompt">
            <span>{t.target}</span>
            <strong>{receiving && !visualAid && !result ? "?".repeat(Math.min(target.length, 6)) : target}</strong>
            {visualAid && <code>{morse}</code>}
            <small>{receiving ? `${t.fixedSpeed}: ${receiveWpm} WPM` : manual ? `${t.detectedSpeed}: ${cw.analysis.wpm} WPM` : `${t.automaticSpeed}: ${automaticKeyWpm} WPM`}</small>
          </div>

          {receiving ? (
            <div className="reception-controls">
              <button className="primary-button" data-action="practice-listen" onClick={() => cw.playIncoming(target, receiveWpm)} disabled={cw.isPlaying || session.completedAt}><SpeakerHigh size={21} weight="fill" />{t.listen}</button>
              <input data-testid="practice-answer" aria-label={t.answer} value={answer} disabled={Boolean(result || session.completedAt)} onChange={(event) => setAnswer(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && scoreAttempt()} placeholder={t.answer} autoComplete="off" spellCheck="false" />
            </div>
          ) : (
            <div className="practice-key-area">
              <img src={manual ? ASSETS.manual : ASSETS.automatic} alt={manual ? t.manualTx : t.paddleTx} onPointerDown={pointerDown} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} draggable="false" />
              <div><strong>{manual ? t.manualHint : t.paddleHint}</strong><span>{t.decoded}: {cw.analysis.decoded || "---"}</span><span>{t.rhythm}: {cw.analysis.rhythm}%</span></div>
            </div>
          )}

          <footer className="practice-actions">
            <button onClick={() => setVisualAid((current) => !current)}>{visualAid ? <EyeSlash size={19} /> : <Eye size={19} />}{visualAid ? t.visualOn : t.visualOff}</button>
            {sending && <button onClick={cw.replayInput} disabled={!cw.analysis.pulseCount || cw.isPlaying}><Broadcast size={19} />{t.replay}</button>}
            <button className="primary-button" data-action="practice-submit" onClick={scoreAttempt} disabled={Boolean(result || session.completedAt || (receiving ? !answer.trim() : !cw.analysis.pulseCount))}><Check size={20} weight="bold" />{t.submit}</button>
            <button data-action="practice-next" onClick={nextPrompt} disabled={!result || session.completedAt}><ArrowRight size={20} />{t.next}</button>
            <button data-action="practice-end" onClick={endSession} disabled={reviewingWeaknesses}><X size={19} />{t.endSession}</button>
          </footer>

          <div className={`practice-result ${result ? (result.correct ? "correct" : "wrong") : ""}`} aria-live="polite">
            {result ? <><strong>{result.correct ? t.correct : t.wrong}</strong><span>{t.target}: {result.target} // {t.decoded}: {result.answer || "---"}</span></> : <span>{t.waiting}</span>}
          </div>
        </section>

        <aside className="practice-stats metal-panel">
          <div className="panel-title"><span>{t.session}</span><b>LIVE</b></div>
          <dl className="practice-session-stats">
            <div><dt>{t.attempts}</dt><dd>{sessionStats.attempts}</dd></div>
            <div><dt>{t.accuracy}</dt><dd>{sessionStats.accuracy}%</dd></div>
            <div><dt>{t.rhythm}</dt><dd>{sessionStats.averageRhythm}%</dd></div>
          </dl>
          <section className="practice-session-weaknesses"><h2>{t.session} · {t.weak}</h2>{sessionWeakEntries.length ? <div className="weak-list">{sessionWeakEntries.map(([character, count]) => <span key={character}><b>{character}</b><i>{count}</i></span>)}</div> : <p>{t.noWeak}</p>}</section>
          <section className="practice-lifetime-stats" data-testid="practice-lifetime-stats">
            <div
              className={`practice-mastery-card ${mastery.status}`}
              data-testid="practice-mastery-feedback"
              data-mastery-status={mastery.status}
              data-mastery-completed-lessons={mastery.completedLessons}
              data-mastery-block-attempts={mastery.blockAttempts}
              data-mastery-block-correct={mastery.blockCorrect}
              data-mastery-attempts-remaining={mastery.attemptsRemaining}
              data-mastery-correct-needed={mastery.correctNeeded}
              data-mastery-can-pass={mastery.canStillPass ? "true" : "false"}
            >
              <h2>{t.masteryProgress}</h2>
              <p><span>{t.completedLessons}</span><b>{mastery.completedLessons}/{mastery.lessonCount}</b></p>
              {mastery.progressionEligible && (
                <>
                  <p><span>{t.currentBlock}</span><b>{mastery.blockAttempts}/{mastery.requiredAttempts} · {mastery.blockCorrect} {t.correctCount}</b></p>
                  <p><span>{t.accuracy}</span><b>{mastery.blockAccuracy}%</b></p>
                  <p><span>{t.passRule}</span><b>≥ {mastery.requiredCorrect}/{mastery.requiredAttempts} · {mastery.requiredAccuracy}%</b></p>
                </>
              )}
              <small>{masteryStatus}</small>
            </div>
            <h2>{t.lifetime}</h2>
            <dl>
              <div><dt>{t.attempts}</dt><dd>{lifetimeStats.attempts}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{lifetimeStats.accuracy}%</dd></div>
            </dl>
            <h2>{t.weak}</h2>
            {lifetimeWeakEntries.length ? <div className="weak-list">{lifetimeWeakEntries.map(([character, count]) => <span key={character}><b>{character}</b><i>{count}</i></span>)}</div> : <p>{t.noWeak}</p>}
          </section>
          <div className="practice-light"><i className={cw.isTransmitting ? "on" : ""} /><span>{cw.isTransmitting ? "TX" : receiving && cw.isPlaying ? "RX" : "READY"}</span></div>
        </aside>
      </div>

      {summaryState && (
        <div className="practice-summary-backdrop" data-testid="practice-summary-backdrop">
          <section
            className="practice-summary-modal metal-panel"
            data-testid="practice-summary-modal"
            data-summary-mode={summaryState.mode}
            data-summary-session-type={summaryState.summary.sessionType}
            data-summary-progression-eligible={summaryState.summary.progressionEligible ? "true" : "false"}
            data-summary-attempts={summaryState.summary.questionCount}
            data-summary-correct={summaryState.summary.correctCount}
            data-summary-recovered={summaryState.summary.recoveredPoints}
            data-summary-remaining-weakness={summaryState.summary.remainingWeaknessWeight}
            data-summary-review-mastered={summaryReviewMastered ? "true" : "false"}
            data-summary-lesson={summaryState.summary.lesson}
            data-summary-lesson-passed={summaryState.summary.lessonPassed ? "true" : "false"}
            data-summary-next-lesson={summaryState.summary.nextLesson ?? ""}
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-summary-title"
          >
            <header>
              <div><span>SESSION COMPLETE</span><h2 id="practice-summary-title">{t.summaryTitle}</h2><p>{t.summarySubtitle}</p></div>
              <IconButton label={summaryState.summary.reviewCompleted ? t.returnToLesson : t.continueTraining} data-action="practice-summary-close" onClick={continueTraining}><X size={20} weight="bold" /></IconButton>
            </header>
            <div className={`practice-summary-progress ${summaryReviewMastered ? "mastered" : summaryState.summary.reviewCompleted ? "review" : summaryState.summary.lessonPassed ? "passed" : "retry"}`}>
              <strong>{summaryState.summary.reviewCompleted
                ? summaryReviewMastered ? t.weaknessMastered : t.weakReviewComplete
                : summaryState.summary.lessonPassed ? t.pass : t.retry}</strong>
              <span>{summaryState.summary.reviewCompleted
                ? summaryReviewMastered ? t.weaknessMasteredDetail : t.weakReviewNoProgress
                : summaryState.summary.curriculumCompleted
                  ? t.completed
                  : summaryState.summary.nextLessonUnlocked
                    ? `${t.unlocked}: ${summaryState.summary.nextLesson}`
                    : `${summaryState.summary.lessonCorrect}/${summaryState.summary.lessonAttempts} · ${summaryState.summary.lessonAccuracy}% / ${summaryState.summary.requiredAccuracy}%`}</span>
            </div>
            <dl className={summaryState.summary.reviewCompleted ? "practice-summary-metrics review" : "practice-summary-metrics"}>
              <div><dt>{t.attempts}</dt><dd>{summaryState.summary.questionCount}</dd></div>
              <div><dt>{t.correctCount}</dt><dd>{summaryState.summary.correctCount}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{summaryState.summary.averageAccuracy}%</dd></div>
              <div><dt>{t.rhythm}</dt><dd>{summaryState.summary.averageRhythm}%</dd></div>
              {summaryState.summary.reviewCompleted
                && <div className="recovered"><dt>{t.recoveredPoints}</dt><dd>+{summaryState.summary.recoveredPoints}</dd></div>}
            </dl>
            <section className="practice-summary-weaknesses">
              <h3>{summaryState.summary.reviewCompleted ? t.remainingWeakness : t.weak}</h3>
              {(summaryState.summary.reviewCompleted ? summaryState.summary.remainingWeakCharacters : summaryState.summary.weakCharacters).length
                ? <div className="weak-list">{(summaryState.summary.reviewCompleted ? summaryState.summary.remainingWeakCharacters : summaryState.summary.weakCharacters).slice(0, 8).map(({ character, misses }) => <span key={character}><b>{character}</b><i>{misses}</i></span>)}</div>
                : <p>{summaryReviewMastered ? t.weaknessMastered : t.noWeak}</p>}
            </section>
            <footer>
              <button data-action="practice-summary-back" onClick={leavePractice}><ArrowLeft size={19} />{t.leavePractice}</button>
              <button className="primary-button" data-action="practice-summary-continue" onClick={continueTraining}><ArrowRight size={19} />{summaryState.summary.reviewCompleted ? t.returnToLesson : t.continueTraining}</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
