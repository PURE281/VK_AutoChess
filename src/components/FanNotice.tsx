const SECTIONS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "⚠",
    title: "同人学习作品",
    body: "本项目是《神域召唤 / Valkyrie Connect》的粉丝自制同人游戏，仅供学习与技术交流参考使用，与官方 Ateam Inc. 没有任何关联，亦未获得官方授权。",
  },
  {
    icon: "©",
    title: "素材版权归属",
    body: "游戏内角色形象、立绘、模型、音频等素材的著作权均归原权利方（Ateam Inc. 及相关版权方）所有。本项目仅作非商业演示，素材不得另作他用。",
  },
  {
    icon: "¤",
    title: "完全非商业",
    body: "本项目永久免费，不以任何形式盈利，不含广告、内购或付费内容，不接受捐赠。任何人不得将本项目或其素材用于商业用途。",
  },
  {
    icon: "♟",
    title: "玩法为二次创作",
    body: "自走棋玩法、数值、羁绊与平衡设计均为同人原创二次创作，与原作游戏内容无关，不代表原作品质。",
  },
  {
    icon: "✉",
    title: "侵权联系删除",
    body: "若本项目内容侵犯了您的合法权益，请联系我们，核实后将在第一时间删除相关内容。",
  },
];

export default function FanNotice({ onAgree }: { onAgree: () => void }) {
  return (
    <div className="fan-notice-overlay">
      <div className="fan-notice-card" role="dialog" aria-modal="true" aria-label="玩前须知">
        <div className="fan-notice-rune">ᛟ</div>
        <div className="fan-notice-kicker">FAN-MADE PROJECT</div>
        <h1>玩前须知</h1>
        <div className="fan-notice-body">
          {SECTIONS.map((section) => (
            <div className="fan-notice-section" key={section.title}>
              <span className="fan-notice-icon">{section.icon}</span>
              <div>
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="fan-notice-agree" type="button" onClick={onAgree}>
          我已阅读并同意
        </button>
        <div className="fan-notice-foot">点击同意即表示你理解并遵守以上条款</div>
      </div>
    </div>
  );
}
