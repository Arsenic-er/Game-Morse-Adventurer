import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Broadcast, Check, Coins, Package, Radio, ShoppingCart, Storefront, Wrench, X,
} from "@phosphor-icons/react";
import { ANTENNAS, antennaName } from "../game/antennaCatalog.js";
import { ECONOMY_RESULT, STORE_CATEGORIES, ownsItem } from "../game/economy.js";
import { TRANSMITTERS, equipmentName } from "../game/equipmentCatalog.js";

const TEXT = {
  "zh-CN": {
    title: "台站商店", kicker: "设备采购终端", radio: "电台", antenna: "天线", accessories: "配件",
    balance: "信用点余额", price: "价格", buy: "购买", owned: "已拥有", equipped: "已装备",
    insufficient: "信用点不足", success: "购买完成，设备已送入仓库", unavailable: "暂未上架",
    starter: "初始设备", propagation: "传播修正", qsb: "衰落深度", close: "关闭商店",
    back: "返回管理中心", select: "选择一件商品查看详情", empty: "该分类的新设备正在准备中。",
    fixedKit: "简洁可靠的固定单频 CW 套件。", dipole: "均衡的初始天线，不额外修正传播。",
    vertical: "降低 15% 的 QSB 衰落深度，使接收电平更稳定。", yagi: "提供 +1 传播等级，适合远距离定向通联。",
  },
  "zh-TW": {
    title: "臺站商店", kicker: "設備採購終端", radio: "電臺", antenna: "天線", accessories: "配件",
    balance: "信用點餘額", price: "價格", buy: "購買", owned: "已擁有", equipped: "已裝備",
    insufficient: "信用點不足", success: "購買完成，設備已送入倉庫", unavailable: "暫未上架",
    starter: "初始設備", propagation: "傳播修正", qsb: "衰落深度", close: "關閉商店",
    back: "返回管理中心", select: "選擇一件商品查看詳情", empty: "此分類的新設備正在準備中。",
    fixedKit: "簡潔可靠的固定單頻 CW 套件。", dipole: "均衡的初始天線，不額外修正傳播。",
    vertical: "降低 15% 的 QSB 衰落深度，使接收電平更穩定。", yagi: "提供 +1 傳播等級，適合遠距離定向通聯。",
  },
  ja: {
    title: "ステーションショップ", kicker: "装備調達端末", radio: "無線機", antenna: "アンテナ", accessories: "アクセサリー",
    balance: "クレジット残高", price: "価格", buy: "購入", owned: "所有済み", equipped: "装備中",
    insufficient: "クレジット不足", success: "購入完了。倉庫に搬入しました", unavailable: "入荷準備中",
    starter: "初期装備", propagation: "伝搬補正", qsb: "フェージング深度", close: "ショップを閉じる",
    back: "管理センターへ戻る", select: "商品を選択して詳細を確認", empty: "この分類の新装備は準備中です。",
    fixedKit: "シンプルで信頼性の高い固定単周波 CW キット。", dipole: "バランスの取れた初期アンテナ。伝搬補正なし。",
    vertical: "QSB の深さを 15% 軽減し、受信レベルを安定させます。", yagi: "伝搬レベルを +1。長距離の指向性通信向け。",
  },
  en: {
    title: "Station Store", kicker: "Equipment Procurement Terminal", radio: "Radios", antenna: "Antennas", accessories: "Accessories",
    balance: "Credit Balance", price: "Price", buy: "Purchase", owned: "Owned", equipped: "Equipped",
    insufficient: "Insufficient Credits", success: "Purchase complete — delivered to the warehouse", unavailable: "Coming Soon",
    starter: "Starter Equipment", propagation: "Propagation Modifier", qsb: "QSB Depth", close: "Close Store",
    back: "Back to Management Center", select: "Select an item to inspect it", empty: "New equipment for this category is being prepared.",
    fixedKit: "A simple, reliable fixed-frequency CW transceiver kit.", dipole: "A balanced starter antenna with no propagation modifier.",
    vertical: "Reduces QSB depth by 15% for a steadier received signal.", yagi: "Adds +1 propagation level for directional long-distance contacts.",
  },
};

const CATEGORY_ICONS = { radio: Radio, antenna: Broadcast, accessories: Wrench };

function itemsForCategory(category) {
  if (category === "radio") return TRANSMITTERS;
  if (category === "antenna") return ANTENNAS.filter((item) => item.id !== "none");
  return [];
}

function itemName(item, category, language) {
  return category === "radio" ? equipmentName(item, language) : antennaName(item, language);
}

function itemDescription(item, t) {
  if (item.id === "squid-01") return t.fixedKit;
  if (item.id === "dipole") return t.dipole;
  if (item.id === "vertical") return t.vertical;
  if (item.id === "yagi-3el") return t.yagi;
  return t.select;
}

function itemState(save, category, item) {
  const equipped = category === "radio"
    ? save.equipmentId === item.id
    : category === "antenna" && save.antennaId === item.id;
  if (equipped) return "equipped";
  if (ownsItem(save, { category, itemId: item.id })) return "owned";
  if (!item.purchasable) return "unavailable";
  if (save.credits < item.price) return "insufficient";
  return "available";
}

export function StoreModal({ language, save, onPurchase, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const [category, setCategory] = useState("antenna");
  const [selectedId, setSelectedId] = useState("vertical");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const items = useMemo(() => itemsForCategory(category), [category]);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function chooseCategory(nextCategory) {
    const nextItems = itemsForCategory(nextCategory);
    setCategory(nextCategory);
    setSelectedId(nextItems.find((item) => item.purchasable)?.id ?? nextItems[0]?.id ?? "");
    setNotice("");
  }

  function purchaseSelected() {
    if (!selected || pending) return;
    setPending(true);
    const result = onPurchase({ category, itemId: selected.id });
    setPending(false);
    if (result?.reason === ECONOMY_RESULT.PURCHASED) setNotice(t.success);
    else if (result?.reason === ECONOMY_RESULT.INSUFFICIENT_CREDITS) setNotice(t.insufficient);
    else if (result?.reason === ECONOMY_RESULT.ALREADY_OWNED) setNotice(t.owned);
  }

  const selectedState = selected ? itemState(save, category, selected) : "unavailable";
  const purchaseLabel = selectedState === "equipped" ? t.equipped
    : selectedState === "owned" ? t.owned
      : selectedState === "insufficient" ? t.insufficient
        : selectedState === "unavailable" ? (selected?.starter ? t.starter : t.unavailable)
          : t.buy;

  return (
    <div className="modal-backdrop store-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="store-modal" data-testid="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-title">
        <header className="store-header">
          <div><span>{t.kicker}</span><h2 id="store-title"><Storefront size={25} weight="fill" />{t.title}</h2></div>
          <div className="store-balance" data-store-balance><Coins size={24} weight="fill" /><span>{t.balance}</span><strong>{save.credits.toLocaleString()}</strong></div>
          <button className="icon-button" data-action="close-store" onClick={onClose} aria-label={t.close}><X size={22} /></button>
        </header>

        <div className="store-layout">
          <nav className="store-category-rail" aria-label={t.title}>
            {STORE_CATEGORIES.map((categoryId) => {
              const Icon = CATEGORY_ICONS[categoryId];
              return <button key={categoryId} data-store-category={categoryId} className={category === categoryId ? "selected" : ""} onClick={() => chooseCategory(categoryId)}><Icon size={29} weight="duotone" /><span>{t[categoryId]}</span></button>;
            })}
          </nav>

          <section className="store-catalog">
            <div className="store-shelf-label"><span />{t[category]}<span /></div>
            {items.length ? <div className="store-item-grid">
              {items.map((item) => {
                const state = itemState(save, category, item);
                return (
                  <button key={item.id} data-store-item-id={item.id} data-store-item-state={state} className={selected?.id === item.id ? "selected" : ""} onClick={() => { setSelectedId(item.id); setNotice(""); }}>
                    <span className="store-item-image">{item.image ? <img src={item.image} alt="" /> : <Package size={54} />}</span>
                    <strong>{itemName(item, category, language)}</strong>
                    <small>{item.purchasable ? <><Coins size={14} weight="fill" />{item.price.toLocaleString()}</> : item.starter ? t.starter : t.unavailable}</small>
                    {["owned", "equipped"].includes(state) && <i><Check size={13} weight="bold" />{state === "equipped" ? t.equipped : t.owned}</i>}
                  </button>
                );
              })}
            </div> : <div className="store-empty-category"><Package size={78} weight="duotone" /><p>{t.empty}</p><code>CATALOG // PENDING</code></div>}
          </section>

          <aside className="store-detail">
            {selected ? <>
              <span className="store-detail-image">{selected.image ? <img src={selected.image} alt="" /> : <Package size={86} />}</span>
              <small>{t[category]}</small>
              <h3>{itemName(selected, category, language)}</h3>
              <p>{itemDescription(selected, t)}</p>
              {category === "antenna" && <dl>
                <div><dt>{t.propagation}</dt><dd>{selected.propagationBonus > 0 ? `+${selected.propagationBonus}` : selected.propagationBonus}</dd></div>
                <div><dt>{t.qsb}</dt><dd>{selected.qsbDepthMultiplier < 1 ? `-${Math.round((1 - selected.qsbDepthMultiplier) * 100)}%` : "—"}</dd></div>
              </dl>}
              <div className="store-price"><span>{t.price}</span><strong>{selected.purchasable ? selected.price.toLocaleString() : "—"}</strong><Coins size={20} weight="fill" /></div>
              <button
                className="store-purchase-button"
                data-action="purchase"
                data-purchase-item-id={selected.id}
                disabled={pending || selectedState !== "available"}
                onClick={purchaseSelected}
              ><ShoppingCart size={20} weight="fill" />{purchaseLabel}</button>
              {notice && <output className="store-notice">{notice}</output>}
            </> : <><Package size={92} weight="duotone" /><p>{t.select}</p></>}
          </aside>
        </div>

        <footer className="store-footer"><span>{save.callsign} // CREDIT {String(save.credits).padStart(6, "0")}</span><button onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.back}</button></footer>
      </section>
    </div>
  );
}
