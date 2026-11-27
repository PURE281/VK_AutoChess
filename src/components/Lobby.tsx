import type { DataStore } from "../data";
import { assetUrl } from "../data";
import type { GameMode } from "../types";
import { sound } from "../sound";

interface LobbyProps {
  store: DataStore;
  onStart: (mode: GameMode) => void;
  onCodex: () => void;
  onOnline: () => void;
}

export default function Lobby({ store, onStart, onCodex, onOnline }: LobbyProps) {
  const showcaseIds = [101001, 102001, 201001, 207003];
  const showcase = showcaseIds.map((id) => store.champions.get(id)).filter(Boolean);
  const start = (mode: GameMode) => {
    sound.click();
    sound.bgm(mode === "pvp" ? "bgm_battle_pvp" : "bgm_map");
    onStart(mode);
  };
  return (
    <div className="lobby-screen">
      <div className="lobby-bg-runes"><span>ᚠ</span><span>ᚱ</span><span>ᚨ</span><span>ᛟ</span><span>ᛉ</span></div>
      <header className="lobby-header">
        <div className="lobby-logo-rune">ᛉ</div>
        <div>
          <div className="lobby-kicker">VALKYRIE TACTICS · FAN MADE</div>
          <h1>女武神棋境</h1>
          <p>基于 Valkyrie Connect 角色档案、原版模型动作与音效打造的非官方同人自走棋</p>
        </div>
      </header>

      <div className="lobby-content">
        <section className="lobby-hero-panel">
          <div className="hero-copy">
            <span className="season-chip">FULL ARCHIVE · 985 CHARACTERS</span>
            <h2>召集英灵，布置棋阵，在自动战斗中活到最后。</h2>
            <p>三合一升星、经济利息、连胜连败、装备神器、强化符文、种族/职业/元素羁绊均已实装。所有战斗单位使用原版 GLB 模型与动作。</p>
            <div className="mode-grid">
              <button className="mode-card pve" onClick={() => start("pve")}>
                <span className="mode-icon">ᛉ</span>
                <strong>单机棋境</strong>
                <em>PVE 自走棋模式</em>
                <p>与 7 名 AI 指挥官进行完整自走棋对局。经营经济、抢夺卡池、混合试炼/玩家回合，淘汰全部对手夺冠。</p>
                <b>开始 PVE →</b>
              </button>
              <button className="mode-card pvp" onClick={() => { sound.click(); onOnline(); }}>
                <span className="mode-icon">ᚨ</span>
                <strong>真人对决</strong>
                <em>联机 PVP 模式</em>
                <p>创建或加入局域网双人房间。双方独立运营完整自走棋阵容，同时准备后进行真实玩家棋盘对战。</p>
                <b>联机对战 →</b>
              </button>
              <button className="mode-card trial" onClick={() => start("trial")}>
                <span className="mode-icon">ᛏ</span>
                <strong>世界树试炼</strong>
                <em>单人挑战模式</em>
                <p>连续挑战 20 轮逐层增强的试炼军团。每轮胜利选择神器，在固定节点获得符文，考验长线构筑。</p>
                <b>进入试炼 →</b>
              </button>
              <button className="mode-card chaos" onClick={() => start("chaos")}>
                <span className="mode-icon">ᚱ</span>
                <strong>全英灵混战</strong>
                <em>985 角色混沌模式</em>
                <p>全部角色进入卡池的实验性混战。非赛季角色暂无 GLB 时使用原版立绘兜底，适合体验完整角色档案。</p>
                <b>混沌开局 →</b>
              </button>
            </div>
            <button className="codex-entry" onClick={() => { sound.click(); onCodex(); }}>
              <span>ᚨ</span>
              <div><strong>角色图鉴</strong><small>查看全部 985 名角色的技能、属性、种族职业与背景</small></div>
              <b>打开 →</b>
            </button>
          </div>
          <div className="hero-showcase" aria-hidden="true">
            {showcase.map((champion, index) => champion && (
              <div key={champion.id} className={`showcase-card card-${index}`}>
                <img src={assetUrl(champion.assets.standing || champion.assets.icon)} alt="" draggable={false} />
                <span>{champion.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lobby-feature-strip">
          <div><strong>985</strong><span>角色档案</span></div>
          <div><strong>13–16</strong><span>每角色动作</span></div>
          <div><strong>23</strong><span>原版音效/BGM</span></div>
          <div><strong>20轮</strong><span>PVE 长线试炼</span></div>
        </section>
      </div>
    </div>
  );
}
