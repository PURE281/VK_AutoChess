import type { AugmentDef, ItemDef } from "../types";

export const BOARD_COLS = 8;
export const BOARD_ROWS = 4;
export const BENCH_SIZE = 9;
export const MAX_STAR = 3;
export const MAX_ITEMS_PER_UNIT = 2;
export const PLAYER_COUNT = 8;

export const XP_TO_NEXT: Record<number, number> = {
  1: 2,
  2: 6,
  3: 18,
  4: 30,
  5: 46,
  6: 66,
  7: 90,
  8: 120,
  9: 999,
};

export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [90, 10, 0, 0, 0],
  3: [75, 22, 3, 0, 0],
  4: [60, 30, 9, 1, 0],
  5: [45, 33, 18, 4, 0],
  6: [35, 35, 22, 8, 0],
  7: [25, 32, 27, 13, 3],
  8: [20, 28, 30, 17, 5],
  9: [15, 25, 30, 20, 10],
};

export const POOL_COPIES: Record<number, number> = {
  1: 29,
  2: 22,
  3: 18,
  4: 12,
  5: 9,
};

export const AUGMENTS: AugmentDef[] = [
  { id: "gold_flow", name: "财富涌泉", tier: 1, description: "利息上限 +2，每回合额外 +1 金币。", tags: ["econ"] },
  { id: "war_treasury", name: "战争财政", tier: 1, description: "PVP 胜利后额外获得 2 金币。", tags: ["econ", "combat"] },
  { id: "studious", name: "经验研习", tier: 1, description: "购买经验时额外获得 2 点经验。", tags: ["econ"] },
  { id: "cheap_refresh", name: "商人交情", tier: 1, description: "刷新商店只消耗 1 金币。", tags: ["econ"] },
  { id: "oracle_refresh", name: "神谕刷新", tier: 2, description: "每回合第一次刷新免费。", tags: ["econ"] },
  { id: "golden_injection", name: "黄金注入", tier: 1, description: "立即获得 12 金币。", tags: ["econ"] },
  { id: "fast_training", name: "进阶训练", tier: 1, description: "立即获得 8 点经验。", tags: ["econ"] },
  { id: "extra_deploy", name: "征召扩展", tier: 2, description: "可上阵人数 +1。", tags: ["combat"] },
  { id: "duplicator", name: "英雄复制器", tier: 2, description: "获得消耗品「英雄复制器」，可任选一名已拥有棋子进行复制。", tags: ["econ"] },
  { id: "healthy_body", name: "强健体魄", tier: 1, description: "全体友军最大生命 +8%。", tags: ["combat"] },
  { id: "swift_tactics", name: "迅捷战术", tier: 1, description: "全体友军攻击速度 +8%。", tags: ["combat"] },
  { id: "critical_lesson", name: "暴击训练", tier: 1, description: "全体友军暴击率 +10%。", tags: ["combat"] },
  { id: "holy_word", name: "治愈圣言", tier: 2, description: "治疗与护盾效果 +20%。", tags: ["combat"] },
  { id: "crafted_barrier", name: "精工护盾", tier: 2, description: "战斗开始时，全体友军获得相当于最大生命 12% 的护盾。", tags: ["combat"] },
  { id: "elemental_attune", name: "元素协调", tier: 2, description: "属性克制伤害加成提高 10%。", tags: ["combat"] },
  { id: "mana_spring", name: "魔力源泉", tier: 2, description: "友军战斗开始时获得 20 点法力。", tags: ["combat"] },
  { id: "executioner", name: "处决者", tier: 3, description: "友军对生命低于 30% 的敌人造成 15% 额外伤害。", tags: ["combat"] },
  { id: "last_stand", name: "背水一战", tier: 3, description: "你的生命值低于 35 时，全体友军伤害 +12%。", tags: ["combat"] },
];

export const ITEMS: ItemDef[] = [
  { id: "godslayer_blade", name: "神斩剑", tier: 1, icon: "⚔", description: "物理伤害 +18%。", tags: ["offense"] },
  { id: "sage_staff", name: "贤者之杖", tier: 1, icon: "✦", description: "魔法伤害与治疗效果 +18%。", tags: ["offense"] },
  { id: "giant_belt", name: "巨人腰带", tier: 1, icon: "◆", description: "最大生命 +18%。", tags: ["defense"] },
  { id: "mithril_plate", name: "秘银铠甲", tier: 1, icon: "▣", description: "物理与魔法防御 +18%。", tags: ["defense"] },
  { id: "gale_boots", name: "疾风靴", tier: 1, icon: "≫", description: "攻击速度 +15%。", tags: ["offense"] },
  { id: "crit_claw", name: "暴击爪", tier: 1, icon: "✧", description: "暴击率 +15%，暴击伤害 +20%。", tags: ["offense"] },
  { id: "holy_charm", name: "圣光护符", tier: 1, icon: "✚", description: "治疗与护盾效果 +25%。", tags: ["support"] },
  { id: "mana_core", name: "魔力核心", tier: 2, icon: "◉", description: "战斗开始时获得 30 点法力。", tags: ["support"] },
  { id: "vampire_fang", name: "吸血牙", tier: 2, icon: "♦", description: "造成伤害的 15% 转化为生命。", tags: ["offense"] },
  { id: "frost_sigil", name: "冰霜印记", tier: 2, icon: "❄", description: "普攻使命中的敌人攻速降低 12%，持续 2 秒。", tags: ["control"] },
  { id: "thunder_hammer", name: "雷神锤", tier: 2, icon: "⚡", description: "每第三次普攻溅射 35% 伤害。", tags: ["offense"] },
  { id: "rebirth_feather", name: "复活羽", tier: 3, icon: "♱", description: "每场战斗一次，阵亡后以 30% 生命复活。", tags: ["defense"] },
  { id: "hero_duplicator", name: "英雄复制器", tier: 3, icon: "⧉", description: "消耗品：对任意已拥有棋子使用，在备战席生成一个同星级复制体；不继承神器。", tags: ["econ", "consumable"] },
];

export interface RaceTraitDef {
  race: number;
  breakpoints: number[];
  description: string;
}

export const RACE_TRAITS: RaceTraitDef[] = [
  { race: 1, breakpoints: [2, 4, 6], description: "神族：法力获取 +15/30/50%，治疗护盾 +10/20/35%。" },
  { race: 2, breakpoints: [2, 4, 6], description: "人类：攻击与魔法强度 +8/15/25%，PVP 胜利额外金币。" },
  { race: 3, breakpoints: [2, 4, 6], description: "精灵：闪避 +8/15/25%，攻速 +8/15/25%。" },
  { race: 4, breakpoints: [2, 4], description: "矮人：双防 +20/40%，最大生命 +8/16%。" },
  { race: 5, breakpoints: [2, 4, 6], description: "亚人：攻速 +10/22/40%，生命偷取 +6/12/20%。" },
  { race: 6, breakpoints: [2, 4], description: "巨人：最大生命 +15/30%，受控时间缩短。" },
  { race: 7, breakpoints: [2, 4], description: "神兽：技能附加灼烧/真伤，元素伤害提高。" },
  { race: 8, breakpoints: [2, 4], description: "幻灵：初始法力 +15/35，技能效果增强。" },
];

export interface ElementTraitDef {
  element: number;
  breakpoints: number[];
  description: string;
}

export const ELEMENT_TRAITS: ElementTraitDef[] = [
  { element: 2, breakpoints: [2, 4, 6], description: "火：火属性英灵伤害 +8/16/28%，技能灼烧增强。" },
  { element: 4, breakpoints: [2, 4, 6], description: "水：水属性英灵法力获取 +12/24/40%，治疗增强。" },
  { element: 8, breakpoints: [2, 4, 6], description: "木：木属性英灵最大生命 +8/16/26%，抗性增强。" },
  { element: 16, breakpoints: [2, 4], description: "光：光属性英灵开场护盾 +10/20% 生命，治疗增强。" },
  { element: 32, breakpoints: [2, 4], description: "暗：暗属性英灵暴击 +10/20%，生命偷取 +8/15%。" },
];

export interface RoleTraitDef {
  role: string;
  breakpoints: number[];
  description: string;
}

export const ROLE_TRAITS: RoleTraitDef[] = [
  { role: "berserker", breakpoints: [2, 4], description: "狂战：物理伤害 +15/30%，击杀后恢复生命。" },
  { role: "assassin", breakpoints: [2, 4], description: "刺客：暴击率 +18/38%，战斗开始跃入后排。" },
  { role: "ranger", breakpoints: [2, 4], description: "游侠：攻速 +18/38%，射程增加。" },
  { role: "arcanist", breakpoints: [2, 4], description: "魔导：魔法伤害 +15/32%，技能溅射。" },
  { role: "warlock", breakpoints: [2, 4], description: "咒术：减益与异常效果增强，敌方抗性下降。" },
  { role: "priest", breakpoints: [2, 4], description: "祭司：治疗与护盾 +22/45%，低生命友军获得庇护。" },
  { role: "warden", breakpoints: [2, 4], description: "铁卫：双防 +20/42%，开场嘲讽邻近敌人。" },
  { role: "templar", breakpoints: [2, 4], description: "圣盾：开场护盾与持续减伤。" },
];

export function itemById(id: string): ItemDef {
  return ITEMS.find((item) => item.id === id) ?? ITEMS[0];
}

export function augmentById(id: string): AugmentDef {
  return AUGMENTS.find((augment) => augment.id === id) ?? AUGMENTS[0];
}
