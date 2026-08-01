import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Broadcast,
  FloppyDisk,
  Keyboard,
  MapTrifold,
  X,
} from "@phosphor-icons/react";

const TEXT = {
  "zh-CN": {
    title: "台站手册",
    kicker: "CW 值守员快速指南",
    close: "关闭台站手册",
    previous: "上一章",
    next: "下一章",
    chapter: "章节",
    noteLabel: "值守员提示",
    shortcut: "方向键翻页 · ESC 关闭",
    chapters: [
      {
        tab: "开始值守",
        code: "入门与存档",
        title: "建立你的第一座台站",
        summary: "新游戏会先建立独立存档。你的呼号、地点、设备和信用点都会随该存档保存。",
        cards: [
          { title: "设置呼号", body: "呼号最多 7 个字符，只能使用英文字母和数字。输入的小写字母会自动转换为大写。游戏内其他呼号均为虚构。" },
          { title: "选择地点", body: "从中国、日本、美国或欧洲的初始城市中选择所在地。地点会决定存档卡片、管理中心窗景和通联场景。" },
          { title: "读取存档", body: "点击“开始值守”后会先进入存档选择。卡片会显示呼号、所在地、当前电台、天线和信用点，选择后再进入管理中心。" },
          { title: "管理中心", body: "桌上的电台进入通联台，柜子打开仓库，笔记本进入商店；通联日志与报纸成就页也可以直接交互。" },
        ],
        tip: "建议先确认呼号与地点；建立存档后，它们会成为这座台站的身份。",
      },
      {
        tab: "监听与 CQ",
        code: "接收与呼叫",
        title: "进入台站，频率已经打开",
        summary: "进入通联界面后接收机立即开始监听，持续的背景噪声表示你正在守听；无需再点击“接收”。",
        cards: [
          { title: "先听后发", body: "刚进入频率时通常只有背景噪声。观察传播状态并听清频道，准备好后再开始呼叫。" },
          { title: "完整发送 CQ", body: "使用电键发完 CQ 呼叫。系统只会在识别到有效且完整的 CQ 后，尝试让远方电台回应。" },
          { title: "等待回话", body: "回话不会在每次 CQ 后必然出现。系统根据最终传播等级决定回应概率；噪声与 QSB 衰落只影响你听到的清晰度。" },
          { title: "完成通联", body: "根据当前目标继续交换呼号与报告。成功后保存日志，结算信用点，并返回台站或开始下一次 QSO。" },
        ],
        tip: "背景噪声不是故障：它是接收机已开启、正在监听频率的声音。",
      },
      {
        tab: "电键操作",
        code: "手键与自动键",
        title: "选择适合你的发报方式",
        summary: "手键由你控制每次按下的长度；自动键生成标准短音和长音。两者使用同一固定音调，但速度规则不同。",
        cards: [
          { title: "手键 · Space", body: "按住空格键开始发射，松开时结束当前脉冲。短按形成点，长按形成划；系统会从你的实际操作自动检测速度与节奏。" },
          { title: "自动键 · Z / X", body: "Z 发送短音，X 发送长音。持续按住任一键会按标准间隔连续发报，松开即停止。" },
          { title: "调整自动键 WPM", body: "在设置菜单选择自动键后，可用减号、加号或滑杆设定 5–40 WPM。这个数值会保存到当前存档。" },
          { title: "提交与记录", body: "自动键采用设定 WPM，手键速度由系统检测。键入 CQ 或回复后点击发送按钮，或按 F2 提交；QSO 成功后按 F3 写入日志，失败时按 F3 重新开始。" },
        ],
        tip: "自动键：Z = ·，X = −。长按可以连续发送，不必反复敲击按键。",
      },
      {
        tab: "传播与装备",
        code: "地图、天线、配件",
        title: "让设备与电波共同决定结果",
        summary: "传播地图不是装饰：地图上的场强会实际参与信号强度、噪声、衰落和远方电台回应的计算。",
        cards: [
          { title: "切换地图模式", body: "地图下方的地球按钮显示普通世界地图，热力图按钮显示传播等级。点击地图可展开大图，查看当前区域的传播情况。" },
          { title: "装备天线", body: "在仓库的天线分类中选择并装备天线。未装备天线时，室外天线位置会保持空置，RF 通联功能会完全停用。" },
          { title: "使用配件", body: "仓库设有一个当前可用的配件槽和三个预留槽。配件需要先在商店购买，再回到仓库装备。" },
          { title: "CW-500 滤波器", body: "CW-500 以 650 Hz 为中心提供 500 Hz 窄带接收，降低 35% 接收噪声。它能改善听感，但不会直接改变传播等级或提高回应概率。" },
        ],
        tip: "好天线改善台站能力；好传播决定路径；滤波器只处理你最终听到的接收噪声。",
      },
    ],
  },
  "zh-TW": {
    title: "臺站手冊",
    kicker: "CW 值守員快速指南",
    close: "關閉臺站手冊",
    previous: "上一章",
    next: "下一章",
    chapter: "章節",
    noteLabel: "值守員提示",
    shortcut: "方向鍵翻頁 · ESC 關閉",
    chapters: [
      {
        tab: "開始值守",
        code: "入門與存檔",
        title: "建立你的第一座臺站",
        summary: "新遊戲會先建立獨立存檔。你的呼號、地點、設備和信用點都會隨該存檔保存。",
        cards: [
          { title: "設定呼號", body: "呼號最多 7 個字元，只能使用英文字母和數字。輸入的小寫字母會自動轉換為大寫。遊戲內其他呼號均為虛構。" },
          { title: "選擇地點", body: "從中國、日本、美國或歐洲的初始城市中選擇所在地。地點會決定存檔卡片、管理中心窗景和通聯場景。" },
          { title: "讀取存檔", body: "點擊「開始值守」後會先進入存檔選擇。卡片會顯示呼號、所在地、目前電臺、天線和信用點，選擇後再進入管理中心。" },
          { title: "管理中心", body: "桌上的電臺進入通聯臺，櫃子開啟倉庫，筆記型電腦進入商店；通聯日誌與報紙成就頁也可以直接互動。" },
        ],
        tip: "建議先確認呼號與地點；建立存檔後，它們會成為這座臺站的身分。",
      },
      {
        tab: "監聽與 CQ",
        code: "接收與呼叫",
        title: "進入臺站，頻率已經開啟",
        summary: "進入通聯介面後接收機立即開始監聽，持續的背景雜訊表示你正在守聽；無需再點擊「接收」。",
        cards: [
          { title: "先聽後發", body: "剛進入頻率時通常只有背景雜訊。觀察傳播狀態並聽清頻道，準備好後再開始呼叫。" },
          { title: "完整發送 CQ", body: "使用電鍵發完 CQ 呼叫。系統只會在識別到有效且完整的 CQ 後，嘗試讓遠方電臺回應。" },
          { title: "等待回話", body: "回話不會在每次 CQ 後必然出現。系統根據最終傳播等級決定回應機率；雜訊與 QSB 衰落只影響你聽到的清晰度。" },
          { title: "完成通聯", body: "依照目前目標繼續交換呼號與報告。成功後保存日誌、結算信用點，並返回臺站或開始下一次 QSO。" },
        ],
        tip: "背景雜訊不是故障：它是接收機已開啟、正在監聽頻率的聲音。",
      },
      {
        tab: "電鍵操作",
        code: "手鍵與自動鍵",
        title: "選擇適合你的發報方式",
        summary: "手鍵由你控制每次按下的長度；自動鍵生成標準短音和長音。兩者使用同一固定音調，但速度規則不同。",
        cards: [
          { title: "手鍵 · Space", body: "按住空白鍵開始發射，放開時結束目前脈衝。短按形成點，長按形成劃；系統會從你的實際操作自動偵測速度與節奏。" },
          { title: "自動鍵 · Z / X", body: "Z 發送短音，X 發送長音。持續按住任一鍵會按標準間隔連續發報，放開即停止。" },
          { title: "調整自動鍵 WPM", body: "在設定選單選擇自動鍵後，可用減號、加號或滑桿設定 5–40 WPM。這個數值會保存到目前存檔。" },
          { title: "提交與記錄", body: "自動鍵採用設定 WPM，手鍵速度由系統偵測。鍵入 CQ 或回覆後點擊發送按鈕，或按 F2 提交；QSO 成功後按 F3 寫入日誌，失敗時按 F3 重新開始。" },
        ],
        tip: "自動鍵：Z = ·，X = −。長按可以連續發送，不必反覆敲擊按鍵。",
      },
      {
        tab: "傳播與裝備",
        code: "地圖、天線、配件",
        title: "讓設備與電波共同決定結果",
        summary: "傳播地圖不是裝飾：地圖上的場強會實際參與訊號強度、雜訊、衰落和遠方電臺回應的計算。",
        cards: [
          { title: "切換地圖模式", body: "地圖下方的地球按鈕顯示普通世界地圖，熱力圖按鈕顯示傳播等級。點擊地圖可展開大圖，查看目前區域的傳播情況。" },
          { title: "裝備天線", body: "在倉庫的天線分類中選擇並裝備天線。未裝備天線時，室外天線位置會保持空置，RF 通聯功能會完全停用。" },
          { title: "使用配件", body: "倉庫設有一個目前可用的配件槽和三個預留槽。配件需要先在商店購買，再回到倉庫裝備。" },
          { title: "CW-500 濾波器", body: "CW-500 以 650 Hz 為中心提供 500 Hz 窄頻接收，降低 35% 接收雜訊。它能改善聽感，但不會直接改變傳播等級或提高回應機率。" },
        ],
        tip: "好天線改善臺站能力；好傳播決定路徑；濾波器只處理你最終聽到的接收雜訊。",
      },
    ],
  },
  ja: {
    title: "ステーションマニュアル",
    kicker: "CW オペレーター・クイックガイド",
    close: "ステーションマニュアルを閉じる",
    previous: "前の章",
    next: "次の章",
    chapter: "チャプター",
    noteLabel: "オペレーターノート",
    shortcut: "矢印キーで移動 · ESC で閉じる",
    chapters: [
      {
        tab: "運用開始",
        code: "入門とセーブ",
        title: "最初のステーションを作る",
        summary: "ニューゲームでは専用セーブを作成します。コールサイン、所在地、設備、クレジットはセーブごとに保存されます。",
        cards: [
          { title: "コールサイン設定", body: "コールサインは英字と数字だけで最大 7 文字です。小文字は自動的に大文字へ変換されます。ゲーム内の他局コールサインはすべて架空です。" },
          { title: "所在地を選ぶ", body: "中国、日本、米国、欧州の初期都市から選択します。所在地によってセーブカード、管理センターの窓景色、交信シーンが変わります。" },
          { title: "セーブを読み込む", body: "「運用を開始」を選ぶとセーブ選択画面へ進みます。カードでコールサイン、所在地、無線機、アンテナ、クレジットを確認して管理センターへ入ります。" },
          { title: "管理センター", body: "机上の無線機から交信卓、キャビネットから倉庫、ノート PC からショップへ移動します。ログと新聞の実績ページも操作できます。" },
        ],
        tip: "最初にコールサインと所在地を確認してください。セーブ作成後、それがあなたの局の身元になります。",
      },
      {
        tab: "受信と CQ",
        code: "ワッチと呼出し",
        title: "交信卓へ入ると周波数は開いている",
        summary: "交信画面へ入ると受信機はすぐにワッチを始めます。連続する背景ノイズは受信中のしるしで、「受信」ボタンを押す必要はありません。",
        cards: [
          { title: "まずワッチ", body: "周波数へ入った直後は背景ノイズだけの場合があります。伝搬状態を確認し、チャンネルを聞いてから呼出しを始めましょう。" },
          { title: "CQ を最後まで送る", body: "電鍵で CQ 呼出しを完了します。有効で完全な CQ が認識された後にだけ、システムは遠方局からの応答を試みます。" },
          { title: "応答を待つ", body: "CQ のたびに必ず返答があるとは限りません。応答確率は最終伝搬レベルで決まり、ノイズと QSB フェージングは聞き取りやすさだけに影響します。" },
          { title: "交信を完了する", body: "現在の目標に沿ってコールサインとレポートを交換します。成功後はログを保存し、クレジットを精算して次の QSO へ進めます。" },
        ],
        tip: "背景ノイズは故障ではありません。受信機が動作し、周波数をワッチしている音です。",
      },
      {
        tab: "電鍵操作",
        code: "縦振り電鍵とオートキー",
        title: "自分に合う送信方法を選ぶ",
        summary: "縦振り電鍵では押下時間を自分で作り、オートキーでは標準の短点と長点を生成します。音程は同じ固定値ですが、速度の扱いは異なります。",
        cards: [
          { title: "縦振り電鍵 · Space", body: "スペースを押している間送信し、放すとパルスが終わります。短く押せば短点、長く押せば長点となり、速度とリズムは実際の操作から自動検出されます。" },
          { title: "オートキー · Z / X", body: "Z は短点、X は長点を送ります。どちらかを押し続けると標準間隔で連続送信し、放すと停止します。" },
          { title: "オートキー WPM", body: "設定でオートキーを選ぶと、マイナス、プラス、スライダーで 5～40 WPM に設定できます。この値は現在のセーブに保存されます。" },
          { title: "送信と記録", body: "オートキーは設定 WPM、縦振り電鍵は自動検出速度を使います。CQ や返答を打ったら送信ボタンまたは F2 で確定し、QSO 成功後は F3 でログ保存、失敗時は F3 で再開します。" },
        ],
        tip: "オートキー：Z = ·、X = −。押し続ければ連続送信でき、連打する必要はありません。",
      },
      {
        tab: "伝搬と装備",
        code: "地図・アンテナ・アクセサリー",
        title: "装備と電波の両方が結果を決める",
        summary: "伝搬マップは飾りではありません。マップ上の電界強度は、信号強度、ノイズ、フェージング、遠方局の応答計算に実際に使われます。",
        cards: [
          { title: "地図モード", body: "地球アイコンは通常の世界地図、ヒートマップアイコンは伝搬レベルを表示します。地図をクリックすると拡大表示で現在の伝搬を確認できます。" },
          { title: "アンテナ装備", body: "倉庫のアンテナ分類で選択して装備します。未装備なら屋外のアンテナ位置は空になり、RF 交信機能は完全に停止します。" },
          { title: "アクセサリー", body: "倉庫には現在使用できるアクセサリースロットが 1 個、将来用の予約スロットが 3 個あります。ショップで購入してから倉庫で装備します。" },
          { title: "CW-500 フィルター", body: "CW-500 は 650 Hz を中心に 500 Hz の狭帯域受信を行い、受信ノイズを 35% 低減します。聞きやすさは改善しますが、伝搬レベルや応答確率は変えません。" },
        ],
        tip: "良いアンテナは局の能力を、良い伝搬は経路を改善します。フィルターが処理するのは最終的な受信ノイズだけです。",
      },
    ],
  },
  en: {
    title: "Station Manual",
    kicker: "CW Operator Quick Guide",
    close: "Close station manual",
    previous: "Previous chapter",
    next: "Next chapter",
    chapter: "Chapter",
    noteLabel: "Operator note",
    shortcut: "Arrow keys to turn pages · ESC to close",
    chapters: [
      {
        tab: "Start Watch",
        code: "Basics and saves",
        title: "Build your first station",
        summary: "A new game begins with a separate save. Your callsign, location, equipment, and credits remain attached to that station.",
        cards: [
          { title: "Choose a callsign", body: "A callsign can contain up to 7 English letters and digits. Lowercase input is converted to uppercase. Every other callsign in the game is fictional." },
          { title: "Choose a location", body: "Select a starting city in China, Japan, the United States, or Europe. It determines the save card, management-center window, and station scenery." },
          { title: "Load a save", body: "Begin Watch opens save selection first. Each card shows its callsign, location, current radio, antenna, and credits before you enter the management center." },
          { title: "Management center", body: "Use the radio on the desk for the station, the cabinet for the warehouse, and the laptop for the store. The log and newspaper achievement page are interactive too." },
        ],
        tip: "Confirm your callsign and location first. Once saved, they become the identity of this station.",
      },
      {
        tab: "Listen and CQ",
        code: "Receiving and calling",
        title: "The frequency is open when you arrive",
        summary: "The receiver starts monitoring as soon as the station screen opens. Continuous background noise means you are on watch; there is no separate Receive button.",
        cards: [
          { title: "Listen first", body: "You may hear only background noise when entering the frequency. Check propagation and listen to the channel before beginning your call." },
          { title: "Send a complete CQ", body: "Key the full CQ call. The system attempts a remote response only after it recognizes a valid, complete CQ from your station." },
          { title: "Wait for a reply", body: "A reply is not guaranteed after every CQ. Final propagation level determines response chance; noise and QSB fading affect only how clearly the reply arrives." },
          { title: "Complete the QSO", body: "Follow the current objective to exchange callsigns and reports. After success, save the log, settle credits, then return or start the next QSO." },
        ],
        tip: "Background noise is not a fault. It is the sound of an active receiver monitoring the frequency.",
      },
      {
        tab: "Key Controls",
        code: "Straight and automatic keys",
        title: "Choose how you want to key",
        summary: "A straight key lets you shape every press. The automatic keyer creates standard dots and dashes. Both use the same fixed tone, but their speed rules differ.",
        cards: [
          { title: "Straight key · Space", body: "Hold Space to transmit and release it to end the pulse. A short press makes a dot and a long press makes a dash; speed and rhythm are detected from your real timing." },
          { title: "Automatic key · Z / X", body: "Z sends dots and X sends dashes. Holding either key repeats that element at standard spacing until you release it." },
          { title: "Set automatic-key WPM", body: "Select the automatic key in Settings, then use minus, plus, or the slider to choose 5–40 WPM. The value is stored in the current save." },
          { title: "Submit and log", body: "The automatic key uses configured WPM and straight-key speed is detected. After keying CQ or a reply, click Send or press F2; after success press F3 to log the QSO, or press F3 to restart after failure." },
        ],
        tip: "Automatic key: Z = · and X = −. Hold a key for continuous elements instead of repeatedly tapping it.",
      },
      {
        tab: "Propagation",
        code: "Map, antennas, accessories",
        title: "Equipment and radio waves decide together",
        summary: "The propagation map is functional, not decorative. Its field strength feeds the calculations for signal level, noise, fading, and remote-station responses.",
        cards: [
          { title: "Switch map modes", body: "The globe icon shows the normal world map; the heat-map icon shows propagation levels. Click the map for a larger view of current conditions." },
          { title: "Equip an antenna", body: "Choose and equip antennas under the warehouse antenna category. With none equipped, the outdoor antenna position stays empty and RF contact is completely disabled." },
          { title: "Use accessories", body: "The warehouse currently has one active accessory slot plus three reserved slots. Buy an accessory in the store, then return to the warehouse to equip it." },
          { title: "CW-500 filter", body: "The CW-500 provides 500 Hz narrow-band reception centered at 650 Hz and reduces receiver noise by 35%. It improves listening, but does not change propagation or response chance." },
        ],
        tip: "A good antenna improves station capability; good propagation opens the path; the filter only processes the receiver noise you finally hear.",
      },
    ],
  },
  es: {
    title: "Manual de la estación", kicker: "Guía rápida del operador CW", close: "Cerrar manual de la estación", previous: "Capítulo anterior", next: "Capítulo siguiente", chapter: "Capítulo", noteLabel: "Nota del operador", shortcut: "Flechas para pasar página · ESC para cerrar",
    chapters: [
      {
        tab: "Iniciar guardia", code: "Conceptos básicos y partidas", title: "Construye tu primera estación", summary: "Una partida nueva comienza con un guardado independiente. Tu indicativo, ubicación, equipo y créditos permanecen vinculados a esa estación.",
        cards: [
          { title: "Elige un indicativo", body: "El indicativo puede contener hasta 7 letras inglesas y números. Las minúsculas se convierten en mayúsculas. Todos los demás indicativos del juego son ficticios." },
          { title: "Elige una ubicación", body: "Selecciona una ciudad inicial de China, Japón, Estados Unidos o Europa. Determina la tarjeta de guardado, la ventana del centro de gestión y el paisaje de la estación." },
          { title: "Carga una partida", body: "Iniciar guardia abre primero la selección de partidas. Cada tarjeta muestra indicativo, ubicación, radio, antena y créditos antes de entrar al centro de gestión." },
          { title: "Centro de gestión", body: "Usa la radio de la mesa para entrar en la estación, el armario para el almacén y el portátil para la tienda. El registro y la página de logros del periódico también son interactivos." },
        ],
        tip: "Confirma primero tu indicativo y ubicación. Al guardar, se convierten en la identidad de esta estación.",
      },
      {
        tab: "Escuchar y CQ", code: "Recepción y llamada", title: "La frecuencia está abierta al llegar", summary: "El receptor comienza a vigilar al abrir la estación. El ruido de fondo continuo indica que estás de guardia; no existe un botón de recepción independiente.",
        cards: [
          { title: "Escucha primero", body: "Al entrar en la frecuencia quizá solo oigas ruido de fondo. Comprueba la propagación y escucha el canal antes de llamar." },
          { title: "Envía un CQ completo", body: "Manipula la llamada CQ completa. El sistema solo intenta generar una respuesta remota después de reconocer un CQ válido y completo de tu estación." },
          { title: "Espera una respuesta", body: "No se garantiza una respuesta tras cada CQ. El nivel final de propagación determina la probabilidad; el ruido y el desvanecimiento QSB solo afectan a la claridad con que llega." },
          { title: "Completa el QSO", body: "Sigue el objetivo actual para intercambiar indicativos e informes. Tras el éxito, guarda el registro, liquida los créditos y vuelve o inicia el siguiente QSO." },
        ],
        tip: "El ruido de fondo no es una avería: es el sonido del receptor activo vigilando la frecuencia.",
      },
      {
        tab: "Control del manipulador", code: "Manipulador vertical y automático", title: "Elige cómo transmitir", summary: "El manipulador vertical permite dar forma a cada pulsación. El automático produce puntos y rayas estándar. Ambos usan el mismo tono fijo, pero aplican reglas de velocidad diferentes.",
        cards: [
          { title: "Vertical · Espacio", body: "Mantén Espacio para transmitir y suéltalo para terminar el pulso. Una pulsación corta crea un punto y una larga una raya; la velocidad y el ritmo se detectan a partir de tus tiempos reales." },
          { title: "Automático · Z / X", body: "Z envía puntos y X envía rayas. Mantener una tecla repite ese elemento con el espaciado estándar hasta soltarla." },
          { title: "Ajusta los WPM automáticos", body: "Selecciona el manipulador automático en Ajustes y usa menos, más o el deslizador para elegir 5–40 WPM. El valor se guarda en la partida actual." },
          { title: "Enviar y registrar", body: "El automático usa los WPM configurados y el vertical detecta la velocidad. Tras manipular CQ o una respuesta, pulsa Enviar o F2; tras el éxito, F3 registra el QSO, y tras un fallo F3 lo reinicia." },
        ],
        tip: "Manipulador automático: Z = · y X = −. Mantén la tecla para repetir elementos sin pulsarla continuamente.",
      },
      {
        tab: "Propagación", code: "Mapa, antenas y accesorios", title: "El equipo y las ondas deciden juntos", summary: "El mapa de propagación es funcional, no decorativo. Su intensidad de campo alimenta los cálculos de señal, ruido, desvanecimiento y respuestas remotas.",
        cards: [
          { title: "Cambia el modo del mapa", body: "El icono del globo muestra el mapa mundial normal y el icono térmico los niveles de propagación. Haz clic en el mapa para ampliar las condiciones actuales." },
          { title: "Equipa una antena", body: "Elige y equipa antenas en la categoría Antenas del almacén. Sin antena, el lugar exterior queda vacío y el contacto RF se desactiva por completo." },
          { title: "Usa accesorios", body: "El almacén dispone de una ranura activa de accesorio y tres reservadas. Compra un accesorio en la tienda y vuelve al almacén para equiparlo." },
          { title: "Filtro CW-500", body: "El CW-500 ofrece recepción estrecha de 500 Hz centrada en 650 Hz y reduce el ruido del receptor un 35 %. Mejora la escucha, pero no cambia la propagación ni la probabilidad de respuesta." },
        ],
        tip: "Una buena antena mejora la estación, una buena propagación abre el camino y el filtro solo procesa el ruido final del receptor.",
      },
    ],
  },
  de: {
    title: "Stationshandbuch", kicker: "CW-Kurzanleitung für Operatoren", close: "Stationshandbuch schließen", previous: "Vorheriges Kapitel", next: "Nächstes Kapitel", chapter: "Kapitel", noteLabel: "Operatorhinweis", shortcut: "Pfeiltasten blättern · ESC schließt",
    chapters: [
      {
        tab: "Wache beginnen", code: "Grundlagen und Spielstände", title: "Baue deine erste Station", summary: "Ein neues Spiel beginnt mit einem eigenen Spielstand. Rufzeichen, Standort, Ausrüstung und Kredite bleiben mit dieser Station verbunden.",
        cards: [
          { title: "Rufzeichen wählen", body: "Ein Rufzeichen darf bis zu 7 englische Buchstaben und Ziffern enthalten. Kleinbuchstaben werden großgeschrieben. Alle anderen Rufzeichen im Spiel sind fiktiv." },
          { title: "Standort wählen", body: "Wähle eine Startstadt in China, Japan, den Vereinigten Staaten oder Europa. Sie bestimmt Spielstandkarte, Fenster des Verwaltungszentrums und Stationslandschaft." },
          { title: "Spielstand laden", body: "Wache beginnen öffnet zuerst die Spielstandauswahl. Jede Karte zeigt Rufzeichen, Standort, Funkgerät, Antenne und Kredite, bevor du das Verwaltungszentrum betrittst." },
          { title: "Verwaltungszentrum", body: "Das Funkgerät auf dem Tisch führt zur Station, der Schrank zum Lager und der Laptop zum Laden. Logbuch und Erfolgsseite in der Zeitung sind ebenfalls interaktiv." },
        ],
        tip: "Bestätige zuerst Rufzeichen und Standort. Nach dem Speichern bilden sie die Identität dieser Station.",
      },
      {
        tab: "Hören und CQ", code: "Empfang und Anruf", title: "Die Frequenz ist beim Eintreffen offen", summary: "Der Empfänger überwacht sofort beim Öffnen der Station. Ständiges Hintergrundrauschen bedeutet, dass du auf Wache bist; es gibt keine separate Empfangstaste.",
        cards: [
          { title: "Zuerst hören", body: "Beim Betreten der Frequenz hörst du möglicherweise nur Hintergrundrauschen. Prüfe die Ausbreitung und höre den Kanal ab, bevor du rufst." },
          { title: "Vollständiges CQ senden", body: "Taste den vollständigen CQ-Ruf. Das System versucht erst dann eine Gegenstationsantwort, wenn es ein gültiges, vollständiges CQ deiner Station erkennt." },
          { title: "Auf Antwort warten", body: "Nicht auf jedes CQ folgt garantiert eine Antwort. Die endgültige Ausbreitungsstufe bestimmt die Chance; Rauschen und QSB beeinflussen nur, wie klar die Antwort ankommt." },
          { title: "QSO abschließen", body: "Folge dem aktuellen Ziel und tausche Rufzeichen und Rapporte aus. Speichere nach Erfolg das Log, rechne die Kredite ab und kehre zurück oder starte das nächste QSO." },
        ],
        tip: "Hintergrundrauschen ist kein Fehler. Es ist der Klang eines aktiven Empfängers, der die Frequenz überwacht.",
      },
      {
        tab: "Tastensteuerung", code: "Handtaste und automatische Taste", title: "Wähle deine Tastweise", summary: "Mit der Handtaste formst du jeden Druck selbst. Die automatische Taste erzeugt genormte Punkte und Striche. Beide nutzen denselben festen Ton, aber unterschiedliche Geschwindigkeitsregeln.",
        cards: [
          { title: "Handtaste · Leertaste", body: "Halte die Leertaste zum Senden und lasse sie los, um den Impuls zu beenden. Kurz ergibt einen Punkt, lang einen Strich; Geschwindigkeit und Rhythmus werden aus deinem echten Timing erkannt." },
          { title: "Automatisch · Z / X", body: "Z sendet Punkte, X sendet Striche. Beim Halten wiederholt sich das Element im Standardabstand bis zum Loslassen." },
          { title: "Automatik-WPM einstellen", body: "Wähle in den Einstellungen die automatische Taste und stelle mit Minus, Plus oder Schieberegler 5–40 WPM ein. Der Wert wird im aktuellen Spielstand gespeichert." },
          { title: "Senden und protokollieren", body: "Die automatische Taste nutzt die eingestellten WPM, bei der Handtaste wird die Geschwindigkeit erkannt. Sende CQ oder Antwort mit Senden bzw. F2; nach Erfolg protokolliert F3 das QSO, nach Fehlschlag startet F3 neu." },
        ],
        tip: "Automatische Taste: Z = · und X = −. Halte eine Taste für fortlaufende Elemente, statt wiederholt zu tippen.",
      },
      {
        tab: "Ausbreitung", code: "Karte, Antennen, Zubehör", title: "Ausrüstung und Funkwellen entscheiden gemeinsam", summary: "Die Ausbreitungskarte ist funktional, nicht dekorativ. Ihre Feldstärke fließt in Signalpegel, Rauschen, Fading und Antworten der Gegenstation ein.",
        cards: [
          { title: "Kartenmodus wechseln", body: "Das Globussymbol zeigt die normale Weltkarte, das Wärmekartensymbol die Ausbreitungsstufen. Ein Klick auf die Karte öffnet eine größere Ansicht der aktuellen Bedingungen." },
          { title: "Antenne ausrüsten", body: "Wähle Antennen in der Lagerkategorie Antenne und rüste sie aus. Ohne Antenne bleibt die Außenposition leer und Funkverbindungen sind vollständig deaktiviert." },
          { title: "Zubehör verwenden", body: "Das Lager besitzt derzeit einen aktiven Zubehörplatz und drei reservierte Plätze. Kaufe Zubehör im Laden und rüste es anschließend im Lager aus." },
          { title: "CW-500-Filter", body: "Der CW-500 bietet 500 Hz Schmalbandempfang um 650 Hz und senkt das Empfängerrauschen um 35 %. Er verbessert das Hören, ändert aber weder Ausbreitung noch Antwortchance." },
        ],
        tip: "Eine gute Antenne verbessert die Station, gute Ausbreitung öffnet den Weg, und der Filter verarbeitet nur das letztlich hörbare Empfängerrauschen.",
      },
    ],
  },
  ru: {
    title: "Руководство станции", kicker: "Краткое руководство оператора CW", close: "Закрыть руководство станции", previous: "Предыдущая глава", next: "Следующая глава", chapter: "Глава", noteLabel: "Заметка оператора", shortcut: "Стрелки листают страницы · ESC закрывает",
    chapters: [
      {
        tab: "Начать вахту", code: "Основы и сохранения", title: "Создайте свою первую станцию", summary: "Новая игра начинается с отдельного сохранения. Позывной, место, оборудование и кредиты остаются привязаны к этой станции.",
        cards: [
          { title: "Выберите позывной", body: "Позывной может содержать до 7 английских букв и цифр. Строчные буквы автоматически становятся прописными. Все прочие позывные в игре вымышлены." },
          { title: "Выберите место", body: "Выберите начальный город в Китае, Японии, США или Европе. От него зависят карточка сохранения, вид из окна Центра управления и пейзаж станции." },
          { title: "Загрузите сохранение", body: "Начать вахту сначала открывает выбор сохранения. До входа в Центр управления каждая карточка показывает позывной, место, радиостанцию, антенну и кредиты." },
          { title: "Центр управления", body: "Радиостанция на столе ведёт к рабочему месту, шкаф — на склад, ноутбук — в магазин. Журнал и страница достижений в газете тоже интерактивны." },
        ],
        tip: "Сначала проверьте позывной и место. После сохранения они станут идентичностью этой станции.",
      },
      {
        tab: "Слушать и CQ", code: "Приём и вызов", title: "Частота открыта сразу после входа", summary: "Приёмник начинает наблюдение при открытии экрана станции. Постоянный фоновый шум означает, что вы на вахте; отдельной кнопки Приём нет.",
        cards: [
          { title: "Сначала слушайте", body: "При входе на частоту вы можете услышать лишь фоновый шум. Проверьте прохождение и послушайте канал перед вызовом." },
          { title: "Передайте полный CQ", body: "Передайте полный вызов CQ. Система пытается вызвать ответ корреспондента только после распознавания правильного и завершённого CQ вашей станции." },
          { title: "Ждите ответа", body: "Ответ после каждого CQ не гарантирован. Итоговый уровень прохождения определяет вероятность; шум и замирания QSB влияют только на разборчивость ответа." },
          { title: "Завершите QSO", body: "Следуйте текущей задаче, чтобы обменяться позывными и рапортами. После успеха сохраните журнал, начислите кредиты, затем вернитесь или начните следующее QSO." },
        ],
        tip: "Фоновый шум — не неисправность. Это звук активного приёмника, наблюдающего частоту.",
      },
      {
        tab: "Управление ключом", code: "Ручной и автоматический ключи", title: "Выберите способ передачи", summary: "Ручной ключ позволяет формировать каждое нажатие. Автоматический создаёт стандартные точки и тире. Оба используют один фиксированный тон, но правила скорости различаются.",
        cards: [
          { title: "Ручной ключ · Пробел", body: "Удерживайте Пробел для передачи и отпустите, чтобы закончить импульс. Короткое нажатие даёт точку, долгое — тире; скорость и ритм определяются по вашему реальному времени." },
          { title: "Автоматический · Z / X", body: "Z передаёт точки, X — тире. Удержание клавиши повторяет элемент со стандартным интервалом до отпускания." },
          { title: "Настройте скорость автомата", body: "Выберите автоматический ключ в Настройках и задайте 5–40 WPM кнопками минус, плюс или ползунком. Значение сохраняется в текущем сохранении." },
          { title: "Отправка и журнал", body: "Автомат использует заданную скорость, а скорость ручного ключа определяется автоматически. После CQ или ответа нажмите Отправить либо F2; после успеха F3 записывает QSO, после неудачи F3 начинает его заново." },
        ],
        tip: "Автоматический ключ: Z = ·, X = −. Удерживайте клавишу для непрерывных элементов вместо частых нажатий.",
      },
      {
        tab: "Прохождение", code: "Карта, антенны, аксессуары", title: "Оборудование и радиоволны решают вместе", summary: "Карта прохождения функциональна, а не декоративна. Её напряжённость поля участвует в расчётах уровня сигнала, шума, замираний и ответов корреспондентов.",
        cards: [
          { title: "Переключайте режимы карты", body: "Значок глобуса показывает обычную карту мира, значок тепловой карты — уровни прохождения. Нажмите на карту, чтобы открыть крупный вид текущих условий." },
          { title: "Установите антенну", body: "Выберите и установите антенну в категории Антенны на складе. Без антенны внешнее место остаётся пустым, а радиосвязь полностью отключается." },
          { title: "Используйте аксессуары", body: "На складе есть одно активное место аксессуара и три зарезервированных. Купите аксессуар в магазине, затем вернитесь на склад и установите его." },
          { title: "Фильтр CW-500", body: "CW-500 обеспечивает узкополосный приём 500 Гц с центром 650 Гц и уменьшает шум приёмника на 35 %. Слушать легче, но прохождение и вероятность ответа не меняются." },
        ],
        tip: "Хорошая антенна улучшает станцию, хорошее прохождение открывает путь, а фильтр обрабатывает только итоговый шум приёмника.",
      },
    ],
  },
};

const CHAPTER_ICONS = [FloppyDisk, Broadcast, Keyboard, MapTrifold];

function clampPage(page, length) {
  return Math.max(0, Math.min(length - 1, page));
}

export function StationManualModal({ language, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const [page, setPage] = useState(0);
  const dialogRef = useRef(null);
  const chapter = t.chapters[page];
  const ChapterIcon = CHAPTER_ICONS[page];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPage((current) => clampPage(current - 1, t.chapters.length));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPage((current) => clampPage(current + 1, t.chapters.length));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, t.chapters.length]);

  return (
    <div
      className="modal-backdrop station-manual-backdrop"
      data-testid="station-manual-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="station-manual-modal"
        data-testid="station-manual-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-manual-title"
        data-manual-page={page}
        data-manual-page-number={page + 1}
        data-manual-page-total={t.chapters.length}
        tabIndex={-1}
      >
        <header className="station-manual-header">
          <div className="station-manual-title-mark" aria-hidden="true"><BookOpen size={38} weight="fill" /></div>
          <div>
            <span>{t.kicker}</span>
            <h2 id="station-manual-title">{t.title}</h2>
          </div>
          <button className="icon-button" data-action="close-station-manual" onClick={onClose} aria-label={t.close}>
            <X size={22} weight="bold" />
          </button>
        </header>

        <div className="station-manual-body">
          <nav className="station-manual-tabs" role="tablist" aria-label={t.chapter}>
            {t.chapters.map((item, index) => {
              const Icon = CHAPTER_ICONS[index];
              const selected = index === page;
              return (
                <button
                  key={item.code}
                  id={`station-manual-tab-${index}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`station-manual-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  className={selected ? "selected" : ""}
                  data-manual-chapter={index + 1}
                  onClick={() => setPage(index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={22} weight={selected ? "fill" : "duotone"} aria-hidden="true" />
                  <strong>{item.tab}</strong>
                  <small>{item.code}</small>
                </button>
              );
            })}
          </nav>

          <article
            id={`station-manual-panel-${page}`}
            className="station-manual-page"
            role="tabpanel"
            aria-labelledby={`station-manual-tab-${page}`}
          >
            <div className="station-manual-page-heading">
              <div aria-hidden="true"><ChapterIcon size={42} weight="duotone" /></div>
              <div>
                <span>{t.chapter} {String(page + 1).padStart(2, "0")} // {chapter.code}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.summary}</p>
              </div>
            </div>

            <div className="station-manual-card-grid">
              {chapter.cards.map((card, index) => (
                <section key={card.title} className="station-manual-card">
                  <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
                  <div><h4>{card.title}</h4><p>{card.body}</p></div>
                </section>
              ))}
            </div>

            <aside className="station-manual-tip">
              <span>{t.noteLabel}</span>
              <p>{chapter.tip}</p>
            </aside>
          </article>
        </div>

        <footer className="station-manual-footer">
          <button data-action="manual-prev" onClick={() => setPage((current) => clampPage(current - 1, t.chapters.length))} disabled={page === 0}>
            <ArrowLeft size={19} weight="bold" />{t.previous}
          </button>
          <div>
            <span>{t.shortcut}</span>
            <b>{String(page + 1).padStart(2, "0")} / {String(t.chapters.length).padStart(2, "0")}</b>
          </div>
          <button data-action="manual-next" onClick={() => setPage((current) => clampPage(current + 1, t.chapters.length))} disabled={page === t.chapters.length - 1}>
            {t.next}<ArrowRight size={19} weight="bold" />
          </button>
        </footer>
      </section>
    </div>
  );
}
