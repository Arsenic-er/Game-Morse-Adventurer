import { useEffect, useState } from "react";
import {
  ArrowLeft, Broadcast, Check, Coins, Flask, GearSix, Lightning, LockKey, Radio, TreeStructure, Wrench, X,
} from "@phosphor-icons/react";
import { ACCESSORIES, accessoryName } from "../game/accessoryCatalog.js";
import { ANTENNAS, antennaName } from "../game/antennaCatalog.js";
import { TRANSMITTERS, equipmentName } from "../game/equipmentCatalog.js";
import {
  RESEARCH_PROJECTS, researchProjectName, researchProjectProgress,
} from "../game/researchProjects.js";
import {
  ROOT_TECHNOLOGY_ID, TECHNOLOGIES, TECHNOLOGY_BRANCHES, TECHNOLOGY_RESULT,
  isTechnologyUnlocked, technologyName,
} from "../game/technologyTree.js";

const TEXT = {
  "zh-CN": {
    title: "台站技术树", kicker: "研究与设备解锁", points: "技术点", projects: "研究项目", projectHint: "完成逐步变难的通联项目获得技术点。",
    radio: "电台工程", antenna: "天线工程", signal: "信号处理", power: "供电工程", automation: "台站自动化", unlock: "研究", unlocked: "已掌握", future: "后续开放", prerequisite: "需要前置技术",
    insufficient: "技术点不足", success: "技术研究完成，相关设备现可在商店购买。", unlocks: "解锁购买", progress: "进度", completed: "完成", back: "返回设备仓库", close: "关闭技术树",
  },
  "zh-TW": {
    title: "臺站技術樹", kicker: "研究與設備解鎖", points: "技術點", projects: "研究計畫", projectHint: "完成逐步變難的通聯計畫以獲得技術點。",
    radio: "電臺工程", antenna: "天線工程", signal: "訊號處理", power: "供電工程", automation: "臺站自動化", unlock: "研究", unlocked: "已掌握", future: "後續開放", prerequisite: "需要前置技術",
    insufficient: "技術點不足", success: "技術研究完成，相關設備現可在商店購買。", unlocks: "解鎖購買", progress: "進度", completed: "完成", back: "返回設備倉庫", close: "關閉技術樹",
  },
  ja: {
    title: "ステーション技術ツリー", kicker: "研究と装備アンロック", points: "技術ポイント", projects: "研究プロジェクト", projectHint: "段階的に難しくなる交信課題で技術ポイントを獲得します。",
    radio: "無線機工学", antenna: "アンテナ工学", signal: "信号処理", power: "電源工学", automation: "局自動化", unlock: "研究", unlocked: "習得済み", future: "今後開放", prerequisite: "前提技術が必要",
    insufficient: "技術ポイント不足", success: "研究完了。対応装備をショップで購入できます。", unlocks: "購入を解禁", progress: "進捗", completed: "完了", back: "装備倉庫へ戻る", close: "技術ツリーを閉じる",
  },
  en: {
    title: "Station Technology Tree", kicker: "Research & Equipment Unlocks", points: "Technology Points", projects: "Research Projects", projectHint: "Complete progressively harder operating projects to earn technology points.",
    radio: "Radio Engineering", antenna: "Antenna Engineering", signal: "Signal Processing", power: "Power Engineering", automation: "Station Automation", unlock: "Research", unlocked: "Mastered", future: "Future Research", prerequisite: "Prerequisite Required",
    insufficient: "Not enough technology points", success: "Research complete — related equipment can now be purchased in the store.", unlocks: "Unlocks Purchase", progress: "Progress", completed: "Complete", back: "Back to Equipment Warehouse", close: "Close Technology Tree",
  },
  es: {
    title: "Árbol tecnológico", kicker: "Investigación y desbloqueo", points: "Puntos tecnológicos", projects: "Proyectos de investigación", projectHint: "Completa proyectos cada vez más difíciles para obtener puntos tecnológicos.",
    radio: "Ingeniería de radio", antenna: "Ingeniería de antenas", signal: "Procesamiento de señal", power: "Ingeniería de energía", automation: "Automatización de estación", unlock: "Investigar", unlocked: "Dominado", future: "Investigación futura", prerequisite: "Requiere tecnología previa",
    insufficient: "Puntos tecnológicos insuficientes", success: "Investigación completada; el equipo ya puede comprarse en la tienda.", unlocks: "Desbloquea compra", progress: "Progreso", completed: "Completado", back: "Volver al almacén", close: "Cerrar árbol tecnológico",
  },
  de: {
    title: "Technologiebaum", kicker: "Forschung & Gerätefreigabe", points: "Technologiepunkte", projects: "Forschungsprojekte", projectHint: "Schließe zunehmend schwierigere Funkprojekte ab, um Technologiepunkte zu erhalten.",
    radio: "Funktechnik", antenna: "Antennentechnik", signal: "Signalverarbeitung", power: "Energietechnik", automation: "Stationsautomatisierung", unlock: "Erforschen", unlocked: "Erforscht", future: "Spätere Forschung", prerequisite: "Voraussetzung fehlt",
    insufficient: "Nicht genügend Technologiepunkte", success: "Forschung abgeschlossen; passende Geräte sind jetzt im Laden verfügbar.", unlocks: "Schaltet Kauf frei", progress: "Fortschritt", completed: "Abgeschlossen", back: "Zurück zum Lager", close: "Technologiebaum schließen",
  },
  ru: {
    title: "Дерево технологий", kicker: "Исследования и оборудование", points: "Очки технологий", projects: "Исследовательские проекты", projectHint: "Выполняйте всё более сложные проекты связи и получайте очки технологий.",
    radio: "Радиотехника", antenna: "Антенная техника", signal: "Обработка сигнала", power: "Энергосистемы", automation: "Автоматизация станции", unlock: "Исследовать", unlocked: "Освоено", future: "Будущая разработка", prerequisite: "Нужна предыдущая технология",
    insufficient: "Недостаточно очков технологий", success: "Исследование завершено; оборудование доступно для покупки в магазине.", unlocks: "Открывает покупку", progress: "Прогресс", completed: "Завершено", back: "Назад на склад", close: "Закрыть дерево технологий",
  },
};

const BRANCH_ICONS = { radio: Radio, antenna: Broadcast, signal: Wrench, power: Lightning, automation: GearSix };

function unlockedItemName(unlock, language) {
  if (unlock.category === "radio") return equipmentName(TRANSMITTERS.find(({ id }) => id === unlock.itemId), language);
  if (unlock.category === "antenna") return antennaName(ANTENNAS.find(({ id }) => id === unlock.itemId), language);
  return accessoryName(ACCESSORIES.find(({ id }) => id === unlock.itemId), language);
}

export function TechnologyTreeModal({ language, save, onUnlock, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const [notice, setNotice] = useState("");
  const root = TECHNOLOGIES.find(({ id }) => id === ROOT_TECHNOLOGY_ID);
  const completedProjects = new Set(save.completedResearchProjects ?? []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function unlock(technology) {
    const result = onUnlock(technology.id);
    if (result?.reason === TECHNOLOGY_RESULT.UNLOCKED) setNotice(t.success);
    else if (result?.reason === TECHNOLOGY_RESULT.INSUFFICIENT_POINTS) setNotice(t.insufficient);
    else if (result?.reason === TECHNOLOGY_RESULT.MISSING_PREREQUISITE) setNotice(t.prerequisite);
  }

  function nodeState(technology) {
    if (isTechnologyUnlocked(save, technology.id)) return "unlocked";
    if (!technology.available) return "future";
    if (technology.prerequisites.some((id) => !isTechnologyUnlocked(save, id))) return "prerequisite";
    if (save.technologyPoints < technology.cost) return "insufficient";
    return "available";
  }

  return (
    <section className="technology-tree-screen" data-testid="technology-tree" role="dialog" aria-modal="true" aria-labelledby="technology-tree-title">
      <header className="technology-tree-header">
        <div><small>{t.kicker}</small><h2 id="technology-tree-title"><TreeStructure size={25} weight="fill" />{t.title}</h2></div>
        <div className="technology-point-balance"><Flask size={24} weight="fill" /><span>{t.points}</span><strong>{save.technologyPoints}</strong></div>
        <button className="icon-button" onClick={onClose} aria-label={t.close}><X size={22} /></button>
      </header>

      <div className="technology-tree-layout">
        <aside className="research-project-list">
          <h3><Coins size={19} weight="fill" />{t.projects}</h3>
          <p>{t.projectHint}</p>
          <ol>
            {RESEARCH_PROJECTS.map((project) => {
              const progress = researchProjectProgress(save, project);
              const completed = completedProjects.has(project.id);
              const blocked = project.prerequisite && !completedProjects.has(project.prerequisite);
              return <li key={project.id} className={completed ? "completed" : blocked ? "blocked" : "active"}>
                <span>{completed ? <Check size={17} weight="bold" /> : blocked ? <LockKey size={17} /> : <Flask size={17} />}</span>
                <div><strong>{researchProjectName(project, language)}</strong><small>{t.progress} {Math.min(progress, project.target)}/{project.target}</small></div>
                <b>+{project.reward}</b>
              </li>;
            })}
          </ol>
        </aside>

        <main className="technology-canvas">
          <div className="technology-root-node"><Check size={20} weight="bold" /><strong>{technologyName(root, language)}</strong></div>
          {TECHNOLOGY_BRANCHES.map((branch) => {
            const BranchIcon = BRANCH_ICONS[branch.id];
            const nodes = TECHNOLOGIES.filter((technology) => technology.branch === branch.id);
            return <section className={`technology-branch branch-${branch.id}`} key={branch.id}>
              <h3><BranchIcon size={21} weight="fill" />{t[branch.id]}</h3>
              <div className="technology-node-chain" style={{ "--technology-node-count": nodes.length }}>
                {nodes.map((technology) => {
                  const state = nodeState(technology);
                  const label = state === "unlocked" ? t.unlocked : state === "future" ? t.future
                    : state === "prerequisite" ? t.prerequisite : state === "insufficient" ? t.insufficient : t.unlock;
                  return <article className={`technology-node state-${state}`} key={technology.id} data-technology-id={technology.id}>
                    <span className="technology-node-icon">{state === "unlocked" ? <Check size={20} weight="bold" /> : <LockKey size={20} />}</span>
                    <strong>{technologyName(technology, language)}</strong>
                    {(technology.unlocks ?? []).map((item) => <small key={item.itemId}>{t.unlocks}: {unlockedItemName(item, language)}</small>)}
                    <button disabled={state !== "available"} onClick={() => unlock(technology)}>
                      {label}{!["unlocked", "future"].includes(state) && <b>{technology.cost} <Flask size={13} weight="fill" /></b>}
                    </button>
                  </article>;
                })}
              </div>
            </section>;
          })}
        </main>
      </div>

      <footer className="technology-tree-footer">
        <output>{notice}</output>
        <button onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.back}</button>
      </footer>
    </section>
  );
}
