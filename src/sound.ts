type SoundKey =
  | "bgm_home"
  | "bgm_map"
  | "bgm_battle"
  | "bgm_battle_pvp"
  | "battle_start"
  | "attack"
  | "damage"
  | "critical"
  | "heal"
  | "death"
  | "skill"
  | "burst"
  | "win"
  | "lose"
  | "buy"
  | "item"
  | "reward"
  | "levelup"
  | "combine"
  | "click"
  | "error"
  | "quest_clear"
  | "treasure";

const VOLUMES: Partial<Record<SoundKey, number>> = {
  attack: 0.16,
  damage: 0.13,
  critical: 0.2,
  heal: 0.2,
  death: 0.26,
  skill: 0.28,
  burst: 0.3,
  click: 0.34,
  buy: 0.24,
  combine: 0.32,
  win: 0.38,
  lose: 0.34,
  item: 0.24,
  reward: 0.3,
  levelup: 0.3,
  error: 0.25,
  treasure: 0.3,
};

class SoundManager {
  enabled: boolean;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmKey: SoundKey | null = null;
  private pendingBgm: SoundKey | null = null;
  private unlocked = false;
  private recent = new Map<SoundKey, number>();
  private skillAudio = new Set<number>();
  private recentSkill = new Map<number, number>();
  private voices = new Map<number, Record<string, string>>();
  private recentVoice = new Map<string, number>();
  private combatAudio = new Set<HTMLAudioElement>();
  private preloaded = new Map<string, HTMLAudioElement>();

  constructor() {
    this.enabled = window.localStorage.getItem("valkyrie-sound") !== "off";
    const unlock = () => {
      this.unlocked = true;
      if (!this.pendingBgm || !this.enabled) return;
      if (this.bgmAudio) {
        void this.bgmAudio.play().catch(() => undefined);
      } else {
        this.bgm(this.pendingBgm);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.setTimeout(() => {
      for (const key of ["battle_start", "attack", "damage", "critical", "heal", "death", "skill", "burst", "win", "lose", "click", "buy", "item", "reward", "levelup", "combine", "error"] as SoundKey[]) {
        this.preload(this.url(key));
      }
      void fetch(`${import.meta.env.BASE_URL}data/skill-audio.json`)
        .then((res) => res.ok ? res.json() : { sounds: {} })
        .then((manifest) => {
          for (const id of Object.keys(manifest.sounds ?? {})) this.skillAudio.add(Number(id));
        })
        .catch(() => undefined);
      void fetch(`${import.meta.env.BASE_URL}data/voices.json`)
        .then((res) => res.ok ? res.json() : { voices: {} })
        .then((manifest) => {
          for (const [id, clips] of Object.entries(manifest.voices ?? {})) this.voices.set(Number(id), clips as Record<string, string>);
        })
        .catch(() => undefined);
    }, 700);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    window.localStorage.setItem("valkyrie-sound", this.enabled ? "on" : "off");
    if (!this.enabled) this.stopBgm();
    else if (this.bgmKey) this.bgm(this.bgmKey);
    return this.enabled;
  }

  private url(key: SoundKey): string {
    return `${import.meta.env.BASE_URL}assets/audio/${key}.mp3`;
  }

  private preload(url: string): void {
    if (this.preloaded.has(url)) return;
    const audio = new Audio(url);
    audio.preload = "auto";
    this.preloaded.set(url, audio);
    audio.load();
  }

  private createAudio(url: string, volume: number): HTMLAudioElement {
    this.preload(url);
    const audio = new Audio(url);
    audio.volume = Math.min(1, volume);
    return audio;
  }

  private play(key: SoundKey, volume = VOLUMES[key] ?? 0.28, throttleMs = 55): HTMLAudioElement | null {
    if (!this.enabled || !this.unlocked) return null;
    const now = performance.now();
    if (now - (this.recent.get(key) ?? -9999) < throttleMs) return null;
    this.recent.set(key, now);
    const audio = this.createAudio(this.url(key), volume);
    void audio.play().catch(() => undefined);
    return audio;
  }

  private trackCombatAudio(audio: HTMLAudioElement | null, maxMs = 3600): void {
    if (!audio) return;
    this.combatAudio.add(audio);
    const release = () => this.combatAudio.delete(audio);
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("pause", release, { once: true });
    window.setTimeout(() => {
      if (!audio.paused) audio.pause();
      release();
    }, maxMs);
  }

  beginCombat(): void {
    this.endCombat();
  }

  endCombat(): void {
    for (const audio of Array.from(this.combatAudio)) {
      audio.pause();
      audio.src = "";
      this.combatAudio.delete(audio);
    }
  }

  private combatPlay(key: SoundKey, volume = VOLUMES[key] ?? 0.28, throttleMs = 55, maxMs = 2600): void {
    this.trackCombatAudio(this.play(key, volume, throttleMs), maxMs);
  }

  bgm(key: SoundKey): void {
    this.pendingBgm = key;
    if (!this.enabled || !this.unlocked) return;
    if (this.bgmKey === key && this.bgmAudio) {
      if (this.bgmAudio.paused) void this.bgmAudio.play().catch(() => undefined);
      return;
    }
    this.stopBgm();
    this.bgmKey = key;
    const audio = new Audio(this.url(key));
    audio.loop = true;
    audio.volume = key === "bgm_home" ? 0.24 : 0.2;
    this.bgmAudio = audio;
    void audio.play().catch(() => undefined);
  }

  stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = "";
      this.bgmAudio = null;
    }
  }

  attack(): void { this.play(Math.random() < 0.28 ? "damage" : "attack", undefined, 90); }
  critical(): void { this.play("critical"); }
  heal(): void { this.play("heal", undefined, 240); }
  skill(): void { this.play(Math.random() < 0.25 ? "burst" : "skill", undefined, 130); }
  private voiceAudio(championId: number | undefined, kind: "join" | "hit" | "skill" | "win", volume = 0.42, throttleMs = 180, maxMs = 0): HTMLAudioElement | null {
    if (!this.enabled || !this.unlocked || championId == null) return null;
    const clips = this.voices.get(championId);
    if (!clips) return null;
    const candidates = kind === "hit" ? ["hit_1", "hit_2"] : kind === "skill" ? ["skill_1", "skill_2"] : [kind];
    const available = candidates.map((clip) => clips[clip]).filter(Boolean);
    if (!available.length) return null;
    const key = `${championId}:${kind}`;
    const now = performance.now();
    if (now - (this.recentVoice.get(key) ?? -9999) < throttleMs) return null;
    this.recentVoice.set(key, now);
    const file = available[Math.floor(Math.random() * available.length)];
    const audio = this.createAudio(`${import.meta.env.BASE_URL}${file}`, volume);
    if (maxMs > 0) window.setTimeout(() => audio.pause(), maxMs);
    void audio.play().catch(() => undefined);
    return audio;
  }

  voiceFor(championId: number | undefined, kind: "join" | "hit" | "skill" | "win", volume = 0.42, throttleMs = 180): boolean {
    return Boolean(this.voiceAudio(championId, kind, volume, throttleMs));
  }

  private combatVoice(championId: number | undefined, kind: "hit" | "skill", volume: number, throttleMs: number): void {
    this.trackCombatAudio(this.voiceAudio(championId, kind, volume, throttleMs), 2800);
  }


  preloadCombat(unitLabels: Record<number, { championId: number }>): void {
    for (const key of ["attack", "damage", "death", "skill", "burst"] as SoundKey[]) this.preload(this.url(key));
    for (const label of Object.values(unitLabels)) {
      const clips = this.voices.get(label.championId);
      if (clips) {
        for (const clip of ["hit_1", "hit_2", "skill_1", "skill_2"]) {
          if (clips[clip]) this.preload(`${import.meta.env.BASE_URL}${clips[clip]}`);
        }
      }
      if (this.skillAudio.has(label.championId)) this.preload(`${import.meta.env.BASE_URL}assets/audio/skills/${label.championId}.mp3`);
    }
  }

  deployVoice(championId?: number): void { this.voiceFor(championId, "join", 0.44, 120); }
  retreatVoice(championId?: number): void { this.voiceFor(championId, "hit", 0.4, 160); }
  deathVoice(championId?: number): void { this.voiceFor(championId, "hit", 0.38, 220); }
  skillVoice(championId?: number): boolean { return this.voiceFor(championId, "skill", 0.44, 260); }
  winVoice(championId?: number): void { void this.voiceAudio(championId, "win", 0.46, 900, 3600); }
  combatAttack(): void { this.combatPlay(Math.random() < 0.28 ? "damage" : "attack", undefined, 90, 1400); }
  combatDeath(): void { this.combatPlay("death", undefined, 180, 1800); }
  combatDeathVoice(championId?: number): void { this.combatVoice(championId, "hit", 0.38, 220); }
  combatSkillVoice(championId?: number): void { this.combatVoice(championId, "skill", 0.44, 260); }

  skillFor(championId?: number, combat = false): void {
    if (championId != null) {
      if (combat) this.combatSkillVoice(championId);
      else this.skillVoice(championId);
    }
    if (!this.enabled || !this.unlocked || championId == null || !this.skillAudio.has(championId)) {
      if (combat) this.combatPlay(Math.random() < 0.25 ? "burst" : "skill", undefined, 130, 1800);
      else this.skill();
      return;
    }
    const now = performance.now();
    if (now - (this.recentSkill.get(championId) ?? -9999) < 420) return;
    this.recentSkill.set(championId, now);
    const audio = this.createAudio(`${import.meta.env.BASE_URL}assets/audio/skills/${championId}.mp3`, 0.2);
    if (combat) this.trackCombatAudio(audio, 2400);
    void audio.play().catch(() => undefined);
  }
  death(): void { this.play("death", undefined, 180); }
  buy(): void { this.play("buy"); }
  combine(): void { this.play("combine"); }
  item(): void { this.play("item"); }
  reward(): void { this.play("reward"); }
  levelup(): void { this.play("levelup"); }
  victory(): void { this.play("win", undefined, 1000); }
  defeat(): void { this.play("lose", undefined, 1000); }
  click(): void { this.play("click", undefined, 70); }
  error(): void { this.play("error"); }
  battleStart(): void { this.play("battle_start", undefined, 700); }
  questClear(): void { this.play("quest_clear", undefined, 1000); }
  treasure(): void { this.play("treasure"); }
}

export const sound = new SoundManager();
