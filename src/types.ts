export interface ConstantDef {
  name: string;
  color: string;
}

export interface SkillData {
  id: number;
  iconId: number;
  name: string;
  description: string;
  characterDetail: string;
  story: string;
  cv: string;
  kind: string;
  target: string;
  damage: number;
  heal: number;
  buff: number;
  debuff: number;
  ailment: number;
  ailmentCount: number;
  charge: number;
  hits: number;
  hasOverview: boolean;
}

export interface ChampionStats {
  hp: number;
  physical_attack: number;
  magic_attack: number;
  physical_defense: number;
  magic_defense: number;
  agility: number;
  hit: number;
  dodge: number;
  critical: number;
  heavy: number;
}

export interface ChampionRawStats {
  hp: number;
  patk: number;
  matk: number;
  pdef: number;
  mdef: number;
  agility: number;
  hit: number;
  dodge: number;
  critical: number;
  heavy: number;
}

export interface Champion {
  id: number;
  name: string;
  race: number;
  classType: number;
  attackType: number;
  elementMask: number;
  releaseAt: string;
  gender: number;
  initStar: number;
  sort: number;
  cost: number;
  costScore: number;
  costRank: number;
  stats: ChampionRawStats;
  statShape: ChampionStats & Record<string, number>;
  skill: SkillData;
  role: string;
  range: number;
  ultimateId: number;
  isCollabo: boolean;
  season1: boolean;
  assets: {
    variant: number;
    icon: string;
    standing: string;
    hasIcon: boolean;
    hasStanding: boolean;
    prefabBundle: string | null;
    prefabVariant: number | null;
  };
}

export interface RosterDataset {
  version: number;
  generatedAt: string;
  constants: {
    races: Record<string, ConstantDef>;
    classes: Record<string, ConstantDef>;
    roles: Record<string, ConstantDef>;
    elements: Record<string, ConstantDef>;
  };
  seasons: {
    season1: number[];
  };
  characters: Champion[];
}

export type LocationRef =
  | { type: "board"; x: number; y: number }
  | { type: "bench"; index: number };

export interface UnitInstance {
  uid: string;
  championId: number;
  star: number;
  items: string[];
}

export interface ShopSlot {
  championId: number | null;
  sold?: boolean;
}

export type BotPersonality = "econ" | "aggressive" | "vertical" | "balanced";

export interface PlayerState {
  id: number;
  name: string;
  isHuman: boolean;
  alive: boolean;
  hp: number;
  gold: number;
  xp: number;
  level: number;
  board: Record<string, UnitInstance>;
  bench: Array<UnitInstance | null>;
  shop: ShopSlot[];
  shopLocked: boolean;
  winStreak: number;
  lossStreak: number;
  augments: string[];
  itemInventory: string[];
  personality?: BotPersonality;
  traitPreference?: number;
  eliminatedRound?: number;
  lastOpponentId?: number;
  freeRerolls: number;
  botPowerBonus: number;
}

export type RoundType = "pve" | "pvp";
export type GameMode = "trial" | "pve" | "pvp" | "chaos";
export type GamePhase = "menu" | "planning" | "combat" | "augment" | "item" | "gameover";

export interface CombatUnitSnapshot {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
  shield: number;
  alive: boolean;
  casting?: boolean;
}

export interface CombatFrame {
  t: number;
  units: CombatUnitSnapshot[];
}

export interface CombatEvent {
  t: number;
  type: "attack" | "skill" | "damage" | "heal" | "shield" | "death" | "status" | "move" | "result";
  source?: number;
  target?: number;
  amount?: number;
  text?: string;
  element?: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
}

export interface CombatResult {
  winner: "player" | "enemy" | "draw";
  duration: number;
  survivingPlayer: number;
  survivingEnemy: number;
  playerUnitsLeft: number;
  enemyUnitsLeft: number;
  frames: CombatFrame[];
  events: CombatEvent[];
  unitLabels: Record<number, {
    championId: number;
    side: "player" | "enemy";
    star: number;
    name: string;
  }>;
  damageDealt: Record<number, number>;
  healingDone: Record<number, number>;
}

export interface ActiveCombat {
  round: number;
  roundType: RoundType;
  opponentId: number;
  opponentName: string;
  result: CombatResult;
  startedAt: number;
}

export interface PendingItemChoice {
  choices: string[];
  round: number;
}

export interface PendingAugmentChoice {
  choices: string[];
  round: number;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  seed: number;
  round: number;
  players: PlayerState[];
  pool: Record<number, number>;
  activeRoster: number[];
  combat: ActiveCombat | null;
  pendingAugment: PendingAugmentChoice | null;
  pendingItem: PendingItemChoice | null;
  log: string[];
  gameResult?: "victory" | "defeat";
  combatSpeed: number;
  roundType: RoundType;
  rngCursor: number;
}

export interface AugmentDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  description: string;
  tags: string[];
}

export interface ItemDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  icon: string;
  description: string;
  tags: string[];
}

export interface TraitState {
  key: string;
  name: string;
  color: string;
  count: number;
  activeLevel: number;
  breakpoints: number[];
  description: string;
}
