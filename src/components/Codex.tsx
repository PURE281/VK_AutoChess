import { useMemo, useState } from "react";
import type { Champion } from "../types";
import type { DataStore } from "../data";
import { assetUrl, className, elementNames, raceColor, raceName, roleColor, roleName } from "../data";
import { costumeOptions, getSkin, setSkin } from "../skins";
import { sound } from "../sound";

function clean(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]+>/g, "").split("\\n").join("\n").trim();
}

function statPct(value: number, max: number): number {
  return Math.max(5, Math.min(100, (value / Math.max(1, max)) * 100));
}

interface CodexProps {
  store: DataStore;
  onBack: () => void;
}

export default function Codex({ store, onBack }: CodexProps) {
  const [query, setQuery] = useState("");
  const [race, setRace] = useState("all");
  const [role, setRole] = useState("all");
  const [cost, setCost] = useState("all");
  const [element, setElement] = useState("all");
  const [selectedId, setSelectedId] = useState(store.dataset.characters[0]?.id ?? 0);
  const [, setSkinTick] = useState(0);

  const races = Object.entries(store.dataset.constants.races).filter(([id]) => store.dataset.characters.some((c) => String(c.race) === id));
  const roles = Object.entries(store.dataset.constants.roles).filter(([id]) => store.dataset.characters.some((c) => c.role === id));
  const elements = Object.entries(store.dataset.constants.elements).filter(([bit]) => store.dataset.characters.some((c) => (c.elementMask & Number(bit)) !== 0));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.dataset.characters.filter((champion) => {
      const haystack = [champion.name, champion.skill.name, clean(champion.skill.description)].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (race !== "all" && String(champion.race) !== race) return false;
      if (role !== "all" && champion.role !== role) return false;
      if (cost !== "all" && String(champion.cost) !== cost) return false;
      if (element !== "all" && (champion.elementMask & Number(element)) === 0) return false;
      return true;
    }).sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "zh-CN"));
  }, [store, query, race, role, cost, element]);

  const selected = store.champions.get(selectedId) ?? filtered[0] ?? store.dataset.characters[0];
  const maxStats = useMemo(() => ({
    hp: Math.max(...store.dataset.characters.map((c) => c.stats.hp)),
    atk: Math.max(...store.dataset.characters.map((c) => Math.max(c.stats.patk, c.stats.matk))),
    def: Math.max(...store.dataset.characters.map((c) => Math.max(c.stats.pdef, c.stats.mdef))),
    agi: Math.max(...store.dataset.characters.map((c) => c.stats.agility)),
  }), [store]);

  const choose = (champion: Champion) => {
    sound.click();
    setSelectedId(champion.id);
  };

  return (
    <div className="codex-screen">
      <header className="codex-header">
        <button className="ghost-button" onClick={() => { sound.click(); onBack(); }}>← 返回大厅</button>
        <div>
          <span className="lobby-kicker">FULL CHARACTER ARCHIVE</span>
          <h1>角色图鉴</h1>
        </div>
        <div className="codex-count"><strong>{filtered.length}</strong><span>/ {store.dataset.characters.length} 名角色</span></div>
      </header>

      <div className="codex-filters">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索角色名、技能或关键词…" />
        <select value={race} onChange={(e) => setRace(e.target.value)}><option value="all">全部种族</option>{races.map(([id, def]) => <option key={id} value={id}>{def.name}</option>)}</select>
        <select value={role} onChange={(e) => setRole(e.target.value)}><option value="all">全部职业</option>{roles.map(([id, def]) => <option key={id} value={id}>{def.name}</option>)}</select>
        <select value={element} onChange={(e) => setElement(e.target.value)}><option value="all">全部元素</option>{elements.map(([id, def]) => <option key={id} value={id}>{def.name}</option>)}</select>
        <select value={cost} onChange={(e) => setCost(e.target.value)}><option value="all">全部费用</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 费</option>)}</select>
        <button className="ghost-button compact" onClick={() => { setQuery(""); setRace("all"); setRole("all"); setCost("all"); setElement("all"); }}>重置</button>
      </div>

      <main className="codex-layout">
        <section className="codex-grid-wrap">
          {filtered.length === 0 && <div className="codex-empty">没有符合条件的角色。</div>}
          <div className="codex-grid">
            {filtered.map((champion) => (
              <button key={champion.id} className={`codex-card cost-${champion.cost} ${selected?.id === champion.id ? "selected" : ""}`} onClick={() => choose(champion)}>
                <img src={assetUrl(champion.assets.icon)} alt={champion.name} draggable={false} loading="lazy" decoding="async" />
                <span className="codex-cost">{champion.cost}</span>
                <strong>{champion.name}</strong>
                <div className="codex-tags">
                  <span style={{ color: raceColor(store, champion.race) }}>{raceName(store, champion.race)}</span>
                  <span style={{ color: roleColor(store, champion.role) }}>{roleName(store, champion.role)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <aside className="codex-detail">
            <div className="codex-portrait-frame">
              <img src={assetUrl((store.champions.get(getSkin(store.costumes, selected.id)) ?? selected).assets.standing || selected.assets.icon)} alt={selected.name} draggable={false} decoding="async" />
              <div className="portrait-shade" />
              <div className="codex-title-block">
                <span>{selected.cost} 费 · {className(store, selected.classType)} · 射程 {selected.range}</span>
                <h2>{selected.name}</h2>
                <p>{selected.skill.cv ? `CV：${selected.skill.cv.replace(/^\[CV:\s*|\]$/g, "")}` : "赛季一英灵"}</p>
              </div>
            </div>
            <div className="codex-identity">
              <span style={{ borderColor: raceColor(store, selected.race), color: raceColor(store, selected.race) }}>{raceName(store, selected.race)}</span>
              <span style={{ borderColor: roleColor(store, selected.role), color: roleColor(store, selected.role) }}>{roleName(store, selected.role)}</span>
              {elementNames(store, selected.elementMask).map((name) => <span key={name}>{name}</span>)}
            </div>
            {(() => {
              const options = costumeOptions(store.costumes, selected.id);
              if (options.length < 2) return null;
              const active = getSkin(store.costumes, selected.id);
              return (
                <section className="codex-section skin-picker-section">
                  <div className="section-title"><span>外观</span><em>纯皮肤 · 不影响数值</em></div>
                  <div className="skin-options">
                    {options.map((cid) => {
                      const skinChampion = store.champions.get(cid);
                      if (!skinChampion) return null;
                      return (
                        <button
                          key={cid}
                          className={`skin-option${cid === active ? " active" : ""}`}
                          title={skinChampion.name}
                          onClick={() => {
                            setSkin(store.costumes, selected.id, cid);
                            setSkinTick((v) => v + 1);
                          }}
                        >
                          <img src={assetUrl(skinChampion.assets.icon)} alt={skinChampion.name} draggable={false} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
            <section className="codex-section skill-section">
              <div className="section-title"><span>技能</span><strong>{selected.skill.name}</strong></div>
              <p>{clean(selected.skill.description) || clean(selected.skill.characterDetail) || "暂无技能描述。"}</p>
              <div className="skill-metrics">
                <span>伤害 {selected.skill.damage}</span><span>治疗 {selected.skill.heal}</span><span>增益 {selected.skill.buff}</span><span>减益 {selected.skill.debuff}</span><span>段数 {selected.skill.hits}</span>
              </div>
            </section>
            <section className="codex-section">
              <div className="section-title"><span>基础属性</span></div>
              {([
                ["生命", selected.stats.hp, maxStats.hp],
                ["攻击", Math.max(selected.stats.patk, selected.stats.matk), maxStats.atk],
                ["防御", Math.max(selected.stats.pdef, selected.stats.mdef), maxStats.def],
                ["敏捷", selected.stats.agility, maxStats.agi],
              ] as Array<[string, number, number]>).map(([label, value, max]) => (
                <div className="stat-row" key={label}>
                  <span>{label}</span><div><i style={{ width: `${statPct(value, max)}%` }} /></div><strong>{Math.round(value)}</strong>
                </div>
              ))}
              <div className="substats">
                <span>命中 {selected.stats.hit}</span><span>闪避 {selected.stats.dodge}</span><span>暴击 {selected.stats.critical}</span><span>重击 {selected.stats.heavy}</span>
              </div>
            </section>
            {(clean(selected.skill.characterDetail) || clean(selected.skill.story)) && (
              <section className="codex-section lore-section">
                <div className="section-title"><span>角色资料</span></div>
                <p>{clean(selected.skill.characterDetail) || clean(selected.skill.story)}</p>
              </section>
            )}
          </aside>
        )}
      </main>
    </div>
  );
}
