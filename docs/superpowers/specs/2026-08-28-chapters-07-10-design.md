# 第 7–10 章完整实现设计

> 状态：已批准的实现规格。本文把《未完成的日志》现有十五章路线落实为第 7、8、9、10 章的可玩纵向切片，并冻结本轮范围、安全边界与验收门槛。

## 1. 目标与版本边界

本轮在 v0.37.0 基线上完成以下内容，并以 v0.40.0 作为最终发布边界：

1. 完成第 7 章“没有寄出的 QSL”，把现有 QSL / 人物选择基础变成完整剧情与可验证通联流程。
2. 完成第 8 章“城市停电”，交付虚构公共服务点名与结构化报文确认玩法。
3. 完成第 9 章“坐标”，交付数字组、游戏网格坐标、UTC 时间与逐字段复核玩法。
4. 完成第 10 章“空中的拥挤”，交付 RUN / S&P 双模式、比赛交换、重复通联和准确率压力。
5. 四章按 `story-07 → story-08 → story-09 → story-10` 顺序解锁；每章必须可失败、重试、重载和幂等结算。
6. 保持 Windows x64 离线便携、七语言界面、本地 INT8 语义模型、固定 21.060 MHz 游戏频率、真实 Z/X 或空格电键输入和现有 500 KiB 自有 JS 分块预算。

本轮不实现第 11–15 章、开放台站模式、联网排行榜、多人通信、真实应急调度、真实紧急频率、任意自由聊天或空中人物肖像。

## 2. 设计原则

### 2.1 逐章纵切片，不先造万能事件引擎

每章拥有独立纯状态机、独立归一化器和独立结算器；第 8、9、10 章只共享字段词法、数字组和硬字段验证工具。共享层不包含剧情、奖励、UI 或章节推进，避免把不同玩法压成难以审计的通用工作流。

### 2.2 硬字段决定推进，语义模型只能否决

呼号、报文编号、优先级、物资、数量、游戏网格、UTC 时间、比赛序号、地区和功率全部由确定性解析器提取。cwformer 可识别程序词、意图和安全性，但不能补写缺失硬字段；`safeToCommit=false` 必须阻止推进。

### 2.3 没有自由文本持久化

存档只保存版本号、稳定 ID、枚举、受限数字、固定叙述 key、时间戳和结算证明。玩家原始发报、模型候选、解释性自由文本、真实姓名、真实地址和真实应急信息均不进入存档。

### 2.4 事实先于奖励

每个章节结算必须原子写入章节完成摘要、专用有界证明、关联 QSO / eventRun 事实和任务进度；任务领取只验证这些相互一致的事实。重复结算、重复领取、重放和二次存档归一化必须是精确 no-op。

## 3. 总体架构

### 3.1 新模块

- `src/game/storyContinuationState.js`：聚合第 7–10 章的版本化存档子状态，调用各章归一化器并提供统一空状态。
- `src/game/structuredMessage.js`：共享的受限 token、数字组、程序词、枚举和字段冲突检测；不含任何章节状态。
- `src/game/qslStoryRun.js`：第 7 章 QSL 复核状态机、案件归档和结算证明。
- `src/game/serviceNetRun.js`：第 8 章公共服务点名、消息优先级、回执和失败恢复。
- `src/game/coordinateRelayRun.js`：第 9 章游戏网格、UTC、人数、数字组、读回和中继状态机。
- `src/game/contestRun.js`：第 10 章 RUN / S&P、来台调度、交换、重复检查、计分和结算。
- `src/screens/QslStoryScreen.jsx`、`ServiceNetScreen.jsx`、`CoordinateRelayScreen.jsx`、`ContestScreen.jsx`：四个按路由懒加载的独立像素界面。
- 对应 `*Text.js` 文件：每个界面的七语言同形字典；无线电阶段只显示文字和信号状态，不显示肖像。

### 3.2 现有模块的职责变化

- `missionSystem.js` 增加 `story-07` 至 `story-10`，但不自行解释章节运行记录；它只调用各章导出的完成证明验证器。
- `saveStore.js` 增加 `storyContinuationStateVersion` 与 `storyContinuationState`，旧存档得到空状态，不回填完成记录和奖励。
- `App.jsx` 只负责路由、持久化事务、设置暂停和跨界面提交；章节规则保留在纯模块中。
- `HomeScreen.jsx` 和 `MissionCenterModal.jsx` 在任务已接受或章节树已解锁后提供进入 / 重放入口；永久 Home 场景与永久装备不被替换。
- `qsoLog.js`、`operatorRelationships.js` 与 `personIdentity.js` 继续作为身份和联系人事实源；章节事件日志明确携带 `eventRunId` 和 `eventKind`。

### 3.3 存档总形状

```js
{
  version: 1,
  chapter07: { activeRun: null, cases: [], settledRunIds: [] },
  chapter08: { activeRun: null, receipts: [], settledRunIds: [], taskTreeUnlocked: false },
  chapter09: { activeRun: null, packets: [], settledRunIds: [], toolUnlocked: false },
  chapter10: { activeRun: null, records: [], settledRunIds: [], taskTreeUnlocked: false }
}
```

所有数组必须 own-property 读取、固定形状、去重并保留尾部：QSL 案件最多 40 条，公共服务回执 80 条，坐标报文 80 条，比赛纪录 40 条，每章结算 ID 100 条。规范记录按完成时间升序、同时间按 ID 升序排列。任一保留窗口内的洞、访问器、继承槽位、重复 ID、非法记录或逆序记录使该子账本整体 fail-closed；不能跳过坏项后继续相信同本账本的目标证明。

所有真实完成的空中会话均写入 event-scoped QSO 日志并带 `eventRunId`、`eventKind` 和稳定人物 / 台站身份；这些日志的普通 QSO 金钱固定为 0，章节奖励只由章节结算发放。第 7、8、9 章每轮最多各写一条联系人日志；第 10 章每个有效联系人写一条。人物关系只在新的、已结算联系人事实首次出现时更新一次。

## 4. 第 7 章：没有寄出的 QSL

### 4.1 叙事与前置

前置为已领取 `story-06`，并存在一张由真实远征结算生成、关联 SORA / `SIM6JP` 的 QSL。旧存档若只有任务领取标记而没有 QSL，不进行推测性回填；任务卡明确要求重放一次远征来生成可验证记录。

玩家先在人物与 QSL 页面看到自己的记忆与 SORA 的记忆。若源 QSL 尚未确认，任务先要求玩家作出一次 `believe / request-review / defer` 选择；该选择随后作为初始立场保留，不能被章节逻辑改写。玩家再通过一次定向 CW 联系请求 SORA 复核同一 `qslId`，接收固定叙述 key 对应的澄清，并在章节末把新的最终立场写入 QSL 案件而不是改写源 QSL。初始立场和最终立场可以不同，剧情不把任何一方标记为说谎。

### 4.2 状态机

```text
CASE_OPEN
→ PLAYER_REVIEWED_BOTH_ACCOUNTS
→ PLAYER_CLARIFICATION_CALL
→ SORA_CLARIFICATION_REPLY
→ PLAYER_FINAL_CHOICE
→ COMPLETED | FAILED | ABANDONED
```

澄清呼叫接受 `QSL <caseId> DE <playerCallsign> PSE K` 的规范与紧凑形式，允许 `AGN K` / `QRS K` 重听同一冻结回复。错误 caseId、呼号或缺少 `QSL` 不推进。最终选择仍限定为 `believe / request-review / defer`，确认后不可修改；重复确认返回 no-op。

### 4.3 结算

完成摘要绑定 `runId`、源 `qslId`、`person:sora`、`station:sim6jp`、澄清 QSO ID、初始选择、最终选择和完成时间。结算创建一条零普通金钱的事件 QSO、更新 SORA 关系一次，并写入固定叙述 key，不保存玩家原文。

`story-07` 奖励固定为 750 金钱和 3 技术点；领取后解锁人物关系任务树入口。重放不再发放任务、QSO、关系或选择奖励。

## 5. 第 8 章：城市停电

### 5.1 安全定位

玩法明确标注“虚构公共服务演练”。电台 `SIM8PS` 和城市、机构、物资均为游戏虚构内容；不显示真实应急频率、真实机构联络方式或可被误用的现实操作指令。

### 5.2 报文合同

每次运行冻结三条消息。字段为：

```text
MSG <001..999> PRI <1..3> PEOPLE <0..99> ITEM <WATER|POWER|MEDKIT|SHELTER> QTY <0..99>
```

玩家先发送签到，再按优先级顺序读回 `ACK <messageId> PRI <priority> K`。同优先级保持原接收顺序。报文编号、优先级或顺序错误必须得到字段级反馈；`AGN K` 重放当前消息，`QRS K` 降速重放，二者不重排队列。

### 5.3 状态机与结果

```text
BRIEFING → CHECK_IN → RECEIVE_MESSAGE → PLAYER_ACK
→ NEXT_MESSAGE | COMPLETED | FAILED | ABANDONED
```

最多允许每条消息两次错误回执；第三次错误结束本轮，但允许从签到后重试且沿用同一冻结消息集。成功需三条消息全部按优先级正确确认。

结算保存三条规范化回执、一次事件联系人记录和专用完成证明。`story-08` 奖励固定为 850 金钱和 4 技术点；领取后 `taskTreeUnlocked=true`，开放可重复的虚构公共服务日常任务，但故事奖励不重复。

## 6. 第 9 章：坐标

### 6.1 游戏网格与报文

第 9 章不使用真实经纬度。所有地点属于虚构的 Pixel Grid，以 `PX-<east>-<north>` 表示，两个坐标均为四位数字 `0000..9999`。每条报文同时包含 UTC 时间、人数和校验号：

```text
MSG <001..999> GRID PX <0000> <0000> TIME <0000..2359>Z PEOPLE <0..99> CHECK <00..99>
```

`CHECK` 为规范化字段串的确定性模 97 校验值。解析器接受标签间的合法程序词和紧凑空格，不接受字段重排造成的歧义、重复字段、冲突数字、非法 UTC、越界坐标或调用者提供的校验结果。

### 6.2 玩法流程

玩家从 `SIM9CR` 接收一条冻结报文，允许 AGN / QRS，然后完整读回。任一字段错误时，对方只指出固定错误 key，并重发对应完整字段；游戏不会自动替玩家填入正确值。读回正确后，玩家把同一规范化报文中继给第二个固定程序化台站，并等待包含消息号与校验号的确认。

```text
BRIEFING → RECEIVE_PACKET → PLAYER_READBACK → FIELD_CORRECTION
→ RELAY_PACKET → RELAY_CONFIRMATION → COMPLETED | FAILED | ABANDONED
```

三次完整读回失败结束本轮；纠正后重试不重新生成报文。结算证明必须同时链接源站、目的站、packetId、规范字段、读回尝试、relay QSO 和完成时间。

`story-09` 奖励固定为 950 金钱和 4 技术点；领取后 `toolUnlocked=true`，Home 的日志工具增加只读结构化报文页。页面只显示规范字段和固定错误 key，不显示玩家原始输入。

## 7. 第 10 章：空中的拥挤

### 7.1 比赛边界

本章是无现实品牌、无联网排名的五分钟虚构短赛。比赛台和操作员来自现有程序化 NPC 目录；比赛主控使用稳定 `npcId`，呼号为 `SIM0CT`。故事首次运行不受现实日期限制，通关后只开放确定性练习和任务树，不伪装成真实赛事日历。

### 7.2 RUN 与 S&P

玩家必须在同一轮完成 RUN 和 S&P 两种模式：

- RUN：发送比赛 CQ，从 2–3 台冻结 pile-up 中抄出并点名来台。
- S&P：从当前传播地图给出的冻结台池选择目标，完成定向呼叫。

比赛交换为：

```text
<peerCallsign> DE <selfCallsign> RST <3 digits> NR <001..999> REGION <2 letters> PWR <1..1000> K
```

硬字段必须匹配当前联系人冻结事实。合法缩写和程序词可容忍，但错误呼号、重复序号、错地区、错功率或重复联系人不计分。`AGN K` / `QRS K` 可恢复链路并扣除小量效率分；抢在当前来台结束前发射记一次礼貌违规并清空本次交换，不产生联系人。

### 7.3 计分与完成

```text
score = validContacts * 100
      + uniqueRegions * 40
      + bothModesBonus(150)
      + cleanExchangeBonus(每条 20，上限 120)
      - repeatPenalty(每次 10，上限 60)
      - bustedCallPenalty(每次 40，上限 160)
      - interruptionPenalty(每次 30，上限 120)
```

一轮最多记录十个有效联系人。达到最低条件后玩家可主动结束，五分钟到时也立即结算；未达到条件则失败。完成条件为六个有效联系人、RUN 与 S&P 各至少两个、至少三个地区、无重复联系人。成绩分为 `complete`、`silver`、`gold`：完成条件即 `complete`；分数至少 900 为 `silver`；至少 1100 且无 busted call / interruption 为 `gold`。七个以上联系人和更多地区使金牌在五分钟内可达。速度影响时间利用率，但不能绕过字段正确性和礼貌要求。

每个联系人写入带 `eventRunId` 的零普通金钱 QSO 日志，并按真实联系人更新人物关系一次。比赛结算一次性写入六个联系人、地区、两种模式、罚分、总分和成绩证明。

`story-10` 奖励固定为 1,100 金钱和 5 技术点；领取后 `taskTreeUnlocked=true`，开放比赛任务树和 RUN / S&P 练习。重复运行只更新个人最佳，不重复故事奖励。

## 8. 任务、奖励与迁移

### 8.1 顺序与领取

- `story-07` 前置 `story-06`；`story-08` 前置 `story-07`；依此类推。
- 同时只能接受一项故事任务，沿用现有规则。
- `ready` 必须由章节完成摘要、章节专用结算 ID、专用证明和关联日志四方一致得出。
- 领取使用安全整数饱和加法；历史记录固定保存实际领取金额和技术点。
- 领取后的重放入口由持久解锁位控制，不依赖任务卡仍处于 active。

### 8.2 旧存档

- 所有 v0.37 及更早存档获得空的 v1 continuation state。
- 已领取 `story-06` 的存档仍需真实完成第 7 章前置 QSL；不根据旧任务标志制造 QSL、章节摘要或奖励。
- 二次 `normalizeSave(JSON.parse(JSON.stringify(normalizeSave(save))))` 必须深度相等。
- 迁移不得增加 money、technologyPoints、QSO 数、关系计数、已领取成就或任务历史。

## 9. UI、输入与可访问性

- 四个界面均为独立懒加载路由，使用现有像素设计令牌；最大自有 JS chunk 继续限制为 512,000 bytes。
- 1439×912、1280×720 和宽度 820 px 以下均需可用；窄视口允许纵向滚动，不允许把发报、确认、重试或返回按钮推到不可达区域。
- 无线电阶段不显示人物肖像。人物页可显示稳定 ID、呼号、关系和固定 QSL 文本，但本轮仍不引入肖像资产。
- Esc 打开设置并暂停章节时钟、音频和接收；关闭后只有窗口可见且真正获得焦点才恢复，暂停期间不补扣时间或电量。
- 活动中离开、已完成但未结算、已有未确认选择均触发通用离开保护；保存完成或明确放弃后允许退出。
- 所有按钮具备文本标签，状态变化进入 polite live region；颜色不是优先级、错误或成绩的唯一编码。

## 10. 错误处理与信任边界

- 解析器对超长输入先截断再扫描，单条输入最多 256 字符、64 个 token；候选数组最多读取尾部 80 项。
- 所有持久数组使用 own plain-data descriptor 读取；访问器、Proxy 异常、继承字段、稀疏槽位、重复 ID 和非规范排序均 fail-closed。
- 时间戳必须是有效 ISO，完成时间不得早于创建 / 接受时间；运行 elapsed 使用单调时钟，重载只恢复累计值，不相信调用者 wall-clock 差值。
- 语义 IPC 目录继续受数量、长度、字符集与字段名白名单限制。模型不可返回持久化叙述或直接判定章节完成。
- 公共服务和坐标界面始终显示“虚构演练”；任何真实紧急信息、真实组织和真实频率均不进入内容目录。

## 11. 测试与发布验收

### 11.1 自动测试

每章按 RED → GREEN 覆盖：

- 纯解析器、纯状态机、暂停计时、失败 / 重试、放弃与完整成功路径；
- hostile input、超长数组、洞、继承、访问器、重复和安全整数边界；
- 结算原子性、重复 no-op、存档双重归一化和无回溯奖励；
- mission 顺序、证明一致性、重放入口和 economy 模拟；
- 七语言字典同形、无原始 key、无空文案、无空中肖像；
- 820 px 响应式结构、Esc、离开保护和 live region。

### 11.2 Packaged QA

现有外部监督器增加四个顺序 scope：

```text
bootstrap → inventory → equipment → practice → qso → expedition
→ qsl-story → service-net → coordinate-relay → contest
```

Lights 继续作为独立 scope。新增截图数冻结为：第 7 章 8 张、第 8 章 10 张、第 9 章 10 张、第 10 章 12 张；与现有 102 张合计 142 张。每段使用独立 userData、同一随机 `qaRunId`、显式三键状态 envelope 和 OS 级硬超时。

每个 scope 必须证明：入口、真实 CW、至少一个字段错误、AGN 或 QRS 恢复、成功、结算、任务领取、重载、重复结算 / 领取 no-op。截图继续验证 PNG CRC、inflate、尺寸、可见像素、受控重复组和精确 manifest；console error 必须为 0，任何 failure / timeout marker 阻止根 manifest。

### 11.3 最终发布门槛

- `pnpm test`
- `pnpm qso:simulate:poor`
- `pnpm qso:calibrate`
- `pnpm mission:economy`
- `pnpm build` 且所有自有 JS chunk ≤ 512,000 bytes
- `pnpm desktop:build`
- packaged semantic smoke 使用 `onnxruntime-node` 和固定 v0.4 模型 / 合同哈希
- fresh 142 图、11 scope、console 0、无 failure / timeout 的监督器结果
- PE / MZ、未签名状态、EXE SHA-256、OFL、模型字节、secret scan、`git diff --check`
- 对完整分支进行一次宽审查；所有 Critical / Important 修复后再做 scoped re-review

## 12. 实施顺序

1. 先建立共享 continuation state、结构化字段工具和第 7 章完整闭环。
2. 第 8 章在共享字段工具上增加公共服务消息，不加入坐标和比赛规则。
3. 第 9 章增加游戏网格、UTC、校验和中继，不复用第 8 章剧情状态。
4. 第 10 章复用联系人 / pile-up / 字段工具，实现独立比赛状态、计分与个人最佳。
5. 每章完成后运行定向、全量和 build，并独立审查；最后统一升级 v0.40.0、重建 portable 和执行 fresh 142 图验收。
