import type {
  Champion,
  CombatEvent,
  CombatFrame,
  CombatResult,
  UnitInstance,
} from "../types";
import { primaryElement } from "../data";
import type { CombatTraitLevels } from "./synergies";
import { clamp, mulberry32 } from "./random";

export interface CombatEntry {
  unit: UnitInstance;
  champion: Champion;
  x: number;
  y: number;
}

export interface CombatTeamInput {
  entries: CombatEntry[];
  traits: CombatTraitLevels;
  augments: string[];
  powerBonus?: number;
  lowHp?: boolean;
}

interface StatusEffect {
  kind: string;
  remaining: number;
  power: number;
  source?: number;
}

interface RuntimeUnit {
  id: number;
  side: "player" | "enemy";
  champion: Champion;
  sourceUid: string;
  star: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  mana: number;
  manaMax: number;
  attack: number;
  magic: number;
  armor: number;
  resist: number;
  range: number;
  speed: number;
  moveSpeed: number;
  critChance: number;
  critDamage: number;
  dodge: number;
  lifesteal: number;
  manaGain: number;
  damageAmp: number;
  skillAmp: number;
  healAmp: number;
  elementBonus: number;
  counterBonus: number;
  attackTimer: number;
  attackCount: number;
  statuses: StatusEffect[];
  dead: boolean;
  reviveUsed: boolean;
  items: string[];
  castingUntil: number;
  deathsPrevented: number;
  powerBonus: number;
  roleTrait: number;
  executioner: boolean;
  lastStand: boolean;
}

function levelValue(values: number[], level: number): number {
  if (level <= 0) return 0;
  return values[Math.min(values.length, level) - 1] ?? 0;
}

function isPhysical(champion: Champion): boolean {
  return champion.attackType === 1 || champion.classType === 1;
}

function distance(a: RuntimeUnit, b: RuntimeUnit): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function elementMultiplier(attacker: number, defender: number, bonus: number): number {
  if (attacker === defender || attacker === 1 || defender === 1 || attacker === 64 || defender === 64) return 1;
  const strong =
    (attacker === 2 && defender === 8) ||
    (attacker === 8 && defender === 4) ||
    (attacker === 4 && defender === 2) ||
    ((attacker === 16 || attacker === 32) && (defender === 16 || defender === 32) && attacker !== defender);
  if (strong) return 1 + 0.12 + bonus;
  const weak =
    (defender === 2 && attacker === 8) ||
    (defender === 8 && attacker === 4) ||
    (defender === 4 && attacker === 2);
  return weak ? 0.94 : 1;
}

function makeRuntimeUnits(
  side: "player" | "enemy",
  input: CombatTeamInput,
  idStart: number,
): { units: RuntimeUnit[]; nextId: number } {
  let id = idStart;
  const units = input.entries.map(({ unit, champion, x, y }) => {
    const starMult = [1, 1.72, 2.85][unit.star - 1] ?? 1;
    const costScale = 0.88 + champion.cost * 0.12;
    const shape = champion.statShape;
    const role = champion.role;
    const raceTrait = input.traits.races[champion.race] ?? 0;
    const roleTrait = input.traits.roles[role] ?? 0;
    const ownElement = primaryElement(champion.elementMask);
    const elementTrait = input.traits.elements?.[ownElement] ?? 0;
    const powerBonus = input.powerBonus ?? 1;

    let hp = (620 + champion.cost * 145) * starMult * shape.hp;
    let attack = (44 + champion.cost * 11.5) * starMult * shape.physical_attack;
    let magic = (44 + champion.cost * 11.5) * starMult * shape.magic_attack;
    let armor = (24 + champion.cost * 5.2) * Math.pow(starMult, 0.55) * shape.physical_defense;
    let resist = (24 + champion.cost * 5.2) * Math.pow(starMult, 0.55) * shape.magic_defense;
    let speed = 0.68 + shape.agility * 0.25;
    let range = champion.range;
    let crit = 0.07 + (shape.critical - 0.78) * 0.18;
    let critDamage = 1.55;
    let dodge = 0.035 + (shape.dodge - 0.78) * 0.12;
    let lifesteal = 0;
    let manaGain = 1;
    let damageAmp = 1;
    let skillAmp = 1;
    let healAmp = 1;
    let mana = role === "priest" || role === "warlock" ? 18 : 8;
    let shield = 0;

    // Race traits.
    manaGain *= 1 + levelValue([0.15, 0.3, 0.5], champion.race === 1 ? raceTrait : 0);
    healAmp *= 1 + levelValue([0.1, 0.2, 0.35], champion.race === 1 ? raceTrait : 0);
    damageAmp *= 1 + levelValue([0.08, 0.15, 0.25], champion.race === 2 ? raceTrait : 0);
    dodge += levelValue([0.08, 0.15, 0.25], champion.race === 3 ? raceTrait : 0);
    speed *= 1 + levelValue([0.08, 0.15, 0.25], champion.race === 3 ? raceTrait : 0);
    armor *= 1 + levelValue([0.2, 0.4], champion.race === 4 ? raceTrait : 0);
    resist *= 1 + levelValue([0.2, 0.4], champion.race === 4 ? raceTrait : 0);
    hp *= 1 + levelValue([0.08, 0.16], champion.race === 4 ? raceTrait : 0);
    speed *= 1 + levelValue([0.1, 0.22, 0.4], champion.race === 5 ? raceTrait : 0);
    lifesteal += levelValue([0.06, 0.12, 0.2], champion.race === 5 ? raceTrait : 0);
    hp *= 1 + levelValue([0.15, 0.3], champion.race === 6 ? raceTrait : 0);
    skillAmp *= 1 + levelValue([0.1, 0.22], champion.race === 7 ? raceTrait : 0);
    mana += levelValue([15, 35], champion.race === 8 ? raceTrait : 0);
    skillAmp *= 1 + levelValue([0.08, 0.18], champion.race === 8 ? raceTrait : 0);

    // Element traits.
    if (ownElement === 2) damageAmp *= 1 + levelValue([0.08, 0.16, 0.28], elementTrait);
    if (ownElement === 4) {
      manaGain *= 1 + levelValue([0.12, 0.24, 0.4], elementTrait);
      healAmp *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
    }
    if (ownElement === 8) {
      hp *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
      resist *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
    }
    if (ownElement === 16) {
      shield += hp * levelValue([0.1, 0.2], elementTrait);
      healAmp *= 1 + levelValue([0.1, 0.2], elementTrait);
    }
    if (ownElement === 32) {
      crit += levelValue([0.1, 0.2], elementTrait);
      lifesteal += levelValue([0.08, 0.15], elementTrait);
    }

    // Role traits.
    if (role === "berserker") damageAmp *= 1 + levelValue([0.15, 0.3], roleTrait);
    if (role === "assassin") crit += levelValue([0.18, 0.38], roleTrait);
    if (role === "ranger") {
      speed *= 1 + levelValue([0.18, 0.38], roleTrait);
      range += levelValue([0.35, 0.75], roleTrait);
    }
    if (role === "arcanist") damageAmp *= 1 + levelValue([0.15, 0.32], roleTrait);
    if (role === "warlock") skillAmp *= 1 + levelValue([0.12, 0.28], roleTrait);
    if (role === "priest") healAmp *= 1 + levelValue([0.22, 0.45], roleTrait);
    if (role === "warden") {
      armor *= 1 + levelValue([0.2, 0.42], roleTrait);
      resist *= 1 + levelValue([0.2, 0.42], roleTrait);
    }
    if (role === "templar") shield += hp * levelValue([0.12, 0.25], roleTrait);

    // Item passives.
    for (const item of unit.items) {
      if (item === "godslayer_blade") attack *= 1.18;
      if (item === "sage_staff") {
        magic *= 1.18;
        healAmp *= 1.18;
      }
      if (item === "giant_belt") hp *= 1.18;
      if (item === "mithril_plate") {
        armor *= 1.18;
        resist *= 1.18;
      }
      if (item === "gale_boots") speed *= 1.15;
      if (item === "crit_claw") {
        crit += 0.15;
        critDamage += 0.2;
      }
      if (item === "holy_charm") healAmp *= 1.25;
      if (item === "mana_core") mana += 30;
      if (item === "vampire_fang") lifesteal += 0.15;
    }

    // Augments.
    if (input.augments.includes("healthy_body")) hp *= 1.08;
    if (input.augments.includes("swift_tactics")) speed *= 1.08;
    if (input.augments.includes("critical_lesson")) crit += 0.1;
    if (input.augments.includes("holy_word")) healAmp *= 1.2;
    if (input.augments.includes("crafted_barrier")) shield += hp * 0.12;
    if (input.augments.includes("mana_spring")) mana += 20;

    hp *= costScale * powerBonus;
    attack *= costScale * powerBonus;
    magic *= costScale * powerBonus;

    const runtime: RuntimeUnit = {
      id: id++,
      side,
      champion,
      sourceUid: unit.uid,
      star: unit.star,
      x,
      y,
      hp,
      maxHp: hp,
      shield,
      mana: Math.min(mana, 100),
      manaMax: role === "priest" || role === "arcanist" ? 88 : role === "warlock" ? 96 : 104,
      attack,
      magic,
      armor,
      resist,
      range,
      speed,
      moveSpeed: 1.15 + shape.agility * 0.32,
      critChance: clamp(crit, 0.02, 0.86),
      critDamage,
      dodge: clamp(dodge, 0.01, 0.68),
      lifesteal,
      manaGain,
      damageAmp,
      skillAmp,
      healAmp,
      elementBonus: 0,
      counterBonus: input.augments.includes("elemental_attune") ? 0.1 : 0,
      attackTimer: 0.2 + Math.random() * 0.3,
      attackCount: 0,
      statuses: [],
      dead: false,
      reviveUsed: false,
      items: unit.items.slice(),
      castingUntil: 0,
      deathsPrevented: 0,
      powerBonus,
      roleTrait,
      executioner: input.augments.includes("executioner"),
      lastStand: input.augments.includes("last_stand") && Boolean(input.lowHp),
    };
    return runtime;
  });
  return { units, nextId: id };
}

function snapshot(units: RuntimeUnit[], t: number): CombatFrame {
  return {
    t,
    units: units.map((u) => ({
      id: u.id,
      x: Number(u.x.toFixed(3)),
      y: Number(u.y.toFixed(3)),
      hp: Math.max(0, Math.round(u.hp)),
      maxHp: Math.round(u.maxHp),
      mana: Math.round(u.mana),
      shield: Math.round(u.shield),
      alive: !u.dead,
      casting: u.castingUntil > t,
    })),
  };
}

function hasStatus(unit: RuntimeUnit, kinds: string[]): boolean {
  return unit.statuses.some((s) => kinds.includes(s.kind) && s.remaining > 0);
}

function addStatus(unit: RuntimeUnit, kind: string, duration: number, power: number, source: number | undefined, events: CombatEvent[], t: number): void {
  const existing = unit.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, duration);
    existing.power = Math.max(existing.power, power);
  } else {
    unit.statuses.push({ kind, remaining: duration, power, source });
  }
  events.push({ t, type: "status", source, target: unit.id, text: kind, x: unit.x, y: unit.y });
}

function statusSpeedMultiplier(unit: RuntimeUnit): number {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "slow") mult *= Math.max(0.35, 1 - status.power);
    if (status.kind === "speedUp") mult *= 1 + status.power;
  }
  return mult;
}

function statusDamageMultiplier(unit: RuntimeUnit): number {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "attackUp") mult *= 1 + status.power;
    if (status.kind === "attackDown") mult *= Math.max(0.4, 1 - status.power);
  }
  return mult;
}

function statusDefenseMultiplier(unit: RuntimeUnit): number {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "defenseUp") mult *= 1 + status.power;
    if (status.kind === "resistDown") mult *= Math.max(0.45, 1 - status.power);
  }
  return mult;
}

function killOrRevive(unit: RuntimeUnit, events: CombatEvent[], t: number): void {
  if (!unit.dead && unit.items.includes("rebirth_feather") && !unit.reviveUsed) {
    unit.reviveUsed = true;
    unit.deathsPrevented += 1;
    unit.hp = unit.maxHp * 0.3;
    unit.shield = unit.maxHp * 0.12;
    events.push({ t, type: "heal", target: unit.id, amount: Math.round(unit.hp), text: "复活", x: unit.x, y: unit.y });
    return;
  }
  if (!unit.dead) {
    unit.dead = true;
    unit.hp = 0;
    events.push({ t, type: "death", target: unit.id, x: unit.x, y: unit.y });
  }
}

function dealDamage(
  source: RuntimeUnit | null,
  target: RuntimeUnit,
  rawAmount: number,
  damageType: "physical" | "magic" | "true",
  events: CombatEvent[],
  t: number,
  damageDealt: Record<number, number>,
  healingDone: Record<number, number>,
  elementBit = 0,
): number {
  if (target.dead || rawAmount <= 0) return 0;
  let amount = rawAmount;
  if (source) {
    amount *= source.damageAmp * statusDamageMultiplier(source);
    if (source.executioner && target.hp / target.maxHp < 0.3) amount *= 1.15;
    if (source.lastStand) amount *= 1.12;
  }
  if (damageType !== "true") {
    const defense = damageType === "physical" ? target.armor : target.resist;
    amount *= 100 / (100 + Math.max(0, defense * statusDefenseMultiplier(target)));
  }
  if (source && elementBit) {
    amount *= elementMultiplier(elementBit, primaryElement(target.champion.elementMask), source.counterBonus);
  }
  amount = Math.max(1, amount);
  let remaining = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;
  const total = amount;
  if (source) {
    damageDealt[source.id] = (damageDealt[source.id] ?? 0) + total;
    source.mana = Math.min(source.manaMax, source.mana + 4 * source.manaGain);
    if (source.lifesteal > 0 && !source.dead) {
      const healed = Math.min(source.maxHp - source.hp, total * source.lifesteal);
      if (healed > 1) {
        source.hp += healed;
        healingDone[source.id] = (healingDone[source.id] ?? 0) + healed;
      }
    }
  }
  target.mana = Math.min(target.manaMax, target.mana + Math.min(18, (total / target.maxHp) * 48) * target.manaGain);
  events.push({
    t,
    type: "damage",
    source: source?.id,
    target: target.id,
    amount: Math.round(total),
    x: target.x,
    y: target.y,
  });
  if (target.hp <= 0) {
    killOrRevive(target, events, t);
    if (target.dead && source && !source.dead && source.champion.role === "berserker" && source.roleTrait > 0) {
      const recovered = Math.min(source.maxHp - source.hp, source.maxHp * levelValue([0.12, 0.25], source.roleTrait));
      if (recovered > 1) {
        source.hp += recovered;
        healingDone[source.id] = (healingDone[source.id] ?? 0) + recovered;
        events.push({ t, type: "heal", source: source.id, target: source.id, amount: Math.round(recovered), text: "斩杀回复", x: source.x, y: source.y });
      }
    }
  }
  return total;
}

function healUnit(
  source: RuntimeUnit,
  target: RuntimeUnit,
  amount: number,
  events: CombatEvent[],
  t: number,
  healingDone: Record<number, number>,
): void {
  if (target.dead || amount <= 0) return;
  const final = amount * source.healAmp;
  const healed = Math.min(target.maxHp - target.hp, final);
  if (healed <= 1) return;
  target.hp += healed;
  healingDone[source.id] = (healingDone[source.id] ?? 0) + healed;
  events.push({ t, type: "heal", source: source.id, target: target.id, amount: Math.round(healed), x: target.x, y: target.y });
}

function shieldUnit(source: RuntimeUnit, target: RuntimeUnit, amount: number, events: CombatEvent[], t: number): void {
  if (target.dead || amount <= 0) return;
  const final = amount * source.healAmp;
  target.shield = Math.min(target.maxHp * 0.75, target.shield + final);
  events.push({ t, type: "shield", source: source.id, target: target.id, amount: Math.round(final), x: target.x, y: target.y });
}

function nearestEnemy(unit: RuntimeUnit, enemies: RuntimeUnit[]): RuntimeUnit | null {
  let best: RuntimeUnit | null = null;
  let bestScore = Infinity;
  const taunters = enemies.filter((e) => !e.dead && (e.champion.role === "warden" || e.champion.role === "templar") && distance(unit, e) < 2.4);
  const candidates = taunters.length && unit.champion.role !== "assassin" ? taunters : enemies.filter((e) => !e.dead);
  for (const enemy of candidates) {
    let score = distance(unit, enemy);
    if (unit.champion.role === "assassin") {
      // Assassins prefer fragile backliners rather than whoever happens to be closest.
      const backlineBias = unit.side === "player" ? -enemy.y * 0.08 : enemy.y * 0.08;
      score += backlineBias + (enemy.hp / enemy.maxHp) * 0.25;
    }
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

function enemiesInRadius(center: RuntimeUnit, enemies: RuntimeUnit[], radius: number): RuntimeUnit[] {
  return enemies.filter((e) => !e.dead && Math.hypot(e.x - center.x, e.y - center.y) <= radius);
}

function applyElementalAilment(source: RuntimeUnit, target: RuntimeUnit, events: CombatEvent[], t: number, strong: boolean): void {
  const element = primaryElement(source.champion.elementMask);
  const duration = strong ? 3.2 : 1.8;
  if (element === 2) addStatus(target, "burn", duration, 0.018 * target.maxHp, source.id, events, t);
  else if (element === 4) addStatus(target, "slow", duration, strong ? 0.34 : 0.2, source.id, events, t);
  else if (element === 8) addStatus(target, "poison", duration + 1, 0.014 * target.maxHp, source.id, events, t);
  else if (element === 16) addStatus(target, "silence", strong ? 2.2 : 1.25, 1, source.id, events, t);
  else if (element === 32) addStatus(target, "stun", strong ? 1.25 : 0.7, 1, source.id, events, t);
  else addStatus(target, "resistDown", duration, strong ? 0.22 : 0.12, source.id, events, t);
}

function skillText(champion: Champion): string {
  return `${champion.skill.description ?? ""}
${champion.skill.characterDetail ?? ""}`.replace(/<[^>]+>/g, "");
}

function hitsAllEnemies(champion: Champion): boolean {
  const text = skillText(champion);
  return champion.skill.target === "allEnemies" || /攻击全体敌人|给予敌方全体|付与敌方全体|对敌方全体造成伤害|敌方全体威力/.test(text);
}

function healsAllAllies(champion: Champion): boolean {
  const text = skillText(champion);
  return /恢复己方全体|回复己方全体|为己方全体.*恢复|恢复最大HP/.test(text) || (champion.skill.kind === "heal" && champion.skill.target === "allAllies");
}

function healsSelfOnly(champion: Champion): boolean {
  return /恢复自身最大HP/.test(skillText(champion));
}

function normalizeSkillText(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248));
}

function parsedEnemyCount(text: string, fallback: number): number {
  const normalized = normalizeSkillText(text);
  const patterns = [
    /(?:敌方|敌人)(?:各)?(\d+)[名位]/,
    /(\d+)[名位](?:敌人|敌方)/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return clamp(Number(match[1]) || fallback, 1, 6);
  }
  return fallback;
}

function uniqueUnits(units: RuntimeUnit[]): RuntimeUnit[] {
  return Array.from(new Map(units.map((unit) => [unit.id, unit])).values());
}

function selectSkillTargets(
  caster: RuntimeUnit,
  target: RuntimeUnit | null,
  liveEnemies: RuntimeUnit[],
  allEnemyStrike: boolean,
  t: number,
): RuntimeUnit[] {
  const skill = caster.champion.skill;
  const text = normalizeSkillText(skillText(caster.champion));
  if (allEnemyStrike) return liveEnemies;
  if (!liveEnemies.length) return [];
  const byDistance = liveEnemies.slice().sort((a, b) => distance(caster, a) - distance(caster, b));
  const farthest = liveEnemies.slice().sort((a, b) => distance(caster, b) - distance(caster, a));
  const lowestHp = liveEnemies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const highestHp = liveEnemies.slice().sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp);
  const highestOffense = liveEnemies.slice().sort((a, b) => Math.max(b.attack, b.magic) - Math.max(a.attack, a.magic));
  const requested = parsedEnemyCount(text, skill.target === "single" ? 1 : skill.damage > 190 ? 2 : 1);

  if (/最近与最远|最近.*最远/.test(text)) {
    return uniqueUnits(byDistance.slice(0, requested).concat(farthest.slice(0, requested))).slice(0, requested * 2);
  }
  if (/HP低|低HP/.test(text)) return lowestHp.slice(0, requested);
  if (/HP高/.test(text)) return highestHp.slice(0, requested);
  if (/物理攻击|魔法攻击|攻击最高/.test(text)) return highestOffense.slice(0, requested);
  if (/最远|远方|远处/.test(text)) return farthest.slice(0, Math.max(2, requested));
  if (/随机/.test(text)) {
    return liveEnemies
      .slice()
      .sort((a, b) => ((a.id * 31 + Math.floor(t * 10)) % 17) - ((b.id * 31 + Math.floor(t * 10)) % 17))
      .slice(0, requested);
  }
  if (skill.target === "splash" && target) {
    return enemiesInRadius(target, liveEnemies, 1.65).slice(0, Math.max(3, requested));
  }
  if (skill.target === "single") return target ? [target] : [];
  if (skill.target === "nearest" && target) return byDistance.slice(0, requested);
  return target ? [target] : [];
}

function castSkill(
  caster: RuntimeUnit,
  target: RuntimeUnit | null,
  allies: RuntimeUnit[],
  enemies: RuntimeUnit[],
  events: CombatEvent[],
  t: number,
  damageDealt: Record<number, number>,
  healingDone: Record<number, number>,
): void {
  const skill = caster.champion.skill;
  caster.mana = 0;
  caster.castingUntil = t + 0.55;
  events.push({
    t,
    type: "skill",
    source: caster.id,
    target: target?.id,
    text: skill.name,
    x: caster.x,
    y: caster.y,
    x2: target?.x,
    y2: target?.y,
  });

  const physical = isPhysical(caster.champion);
  const baseOffense = physical ? caster.attack : caster.magic;
  const skillPower = Math.max(35, skill.damage);
  const damageRatio = (0.62 + skillPower / 145) * caster.skillAmp;
  const healRatio = (0.8 + Math.max(20, skill.heal) / 95) * caster.skillAmp;
  const hits = clamp(skill.hits || 1, 1, 6);
  const element = primaryElement(caster.champion.elementMask);
  const type = physical ? "physical" : "magic";

  const liveEnemies = enemies.filter((e) => !e.dead);
  const liveAllies = allies.filter((a) => !a.dead);
  const allEnemyStrike = hitsAllEnemies(caster.champion);
  const targets = selectSkillTargets(caster, target, liveEnemies, allEnemyStrike, t);

  const doesDamage = ["damage", "burst", "burstControl", "hybrid"].includes(skill.kind) || skill.damage >= 60;
  const doesHeal = ["heal", "hybrid"].includes(skill.kind) || skill.heal >= 35;
  const doesShield = skill.kind === "shield" || skillText(caster.champion).includes("护盾");
  const doesBuff = skill.kind === "buff" || skill.buff >= 25;
  const doesControl = skill.kind === "control" || skill.kind === "burstControl" || skill.ailmentCount >= 4;

  if (doesDamage && targets.length) {
    const targetPenalty = targets.length > 1 ? 0.76 : 1;
    for (const victim of targets) {
      let total = 0;
      for (let hit = 0; hit < hits; hit++) {
        total += baseOffense * damageRatio * targetPenalty / hits;
      }
      dealDamage(caster, victim, total, type, events, t, damageDealt, healingDone, element);
      if (doesControl && !victim.dead) applyElementalAilment(caster, victim, events, t, skill.ailmentCount >= 5 || skill.debuff > 25);
    }
  }

  const explicitAllAllyHeal = healsAllAllies(caster.champion);
  const explicitSelfHeal = healsSelfOnly(caster.champion);
  const detailText = skillText(caster.champion).trim();
  const vagueHybridHeal = skill.kind === "hybrid" && skill.heal >= 45 && (!detailText || /恢复|回复|HP/i.test(detailText));
  const directHeal = explicitAllAllyHeal || explicitSelfHeal || skill.kind === "heal" || vagueHybridHeal;
  if (directHeal) {
    const usesMaxHpPercent = explicitAllAllyHeal || explicitSelfHeal;
    const directRatio = healRatio;
    const healTargets = explicitSelfHeal
      ? [caster]
      : explicitAllAllyHeal || skill.target === "allAllies"
        ? liveAllies
        : liveAllies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, skill.kind === "heal" ? 3 : 2);
    for (const ally of healTargets) {
      const amount = usesMaxHpPercent
        ? ally.maxHp * clamp(skill.heal, 5, 35) / 100
        : caster.magic * directRatio;
      healUnit(caster, ally, amount, events, t, healingDone);
    }
  }
  if (doesShield) {
    const shieldTargets = skill.target === "self" ? [caster] : liveAllies;
    for (const ally of shieldTargets) shieldUnit(caster, ally, caster.maxHp * (0.1 + skill.buff / 300) + caster.magic * 0.35, events, t);
  }
  if (doesBuff) {
    for (const ally of liveAllies) {
      const kind = physical ? "attackUp" : "speedUp";
      addStatus(ally, kind, 5.5, 0.1 + Math.min(0.28, skill.buff / 220), caster.id, events, t);
      if (skill.buff > 45) addStatus(ally, "defenseUp", 5.5, 0.12, caster.id, events, t);
    }
  }
  if (doesControl && !doesDamage && target) {
    const controlTargets = hitsAllEnemies(caster.champion) ? liveEnemies.slice(0, 4) : [target];
    for (const victim of controlTargets) {
      dealDamage(caster, victim, baseOffense * 0.7 * caster.skillAmp, type, events, t, damageDealt, healingDone, element);
      if (!victim.dead) applyElementalAilment(caster, victim, events, t, true);
    }
  }
}

function moveToward(unit: RuntimeUnit, target: RuntimeUnit, dt: number, units: RuntimeUnit[]): void {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const step = Math.min(dist - unit.range * 0.82, unit.moveSpeed * statusSpeedMultiplier(unit) * dt);
  if (step <= 0) return;
  unit.x += (dx / dist) * step;
  unit.y += (dy / dist) * step;
  unit.x = clamp(unit.x, 0.15, 7.65);
  unit.y = clamp(unit.y, 0.15, 7.65);

  // Gentle separation prevents portrait stacking without turning movement into a physics engine.
  for (const other of units) {
    if (other === unit || other.dead) continue;
    const ox = unit.x - other.x;
    const oy = unit.y - other.y;
    const d = Math.hypot(ox, oy);
    if (d > 0.001 && d < 0.56) {
      unit.x += (ox / d) * (0.56 - d) * 0.35;
      unit.y += (oy / d) * (0.56 - d) * 0.35;
    }
  }
}

function applyOpeningAssassinMoves(playerUnits: RuntimeUnit[], enemyUnits: RuntimeUnit[]): void {
  for (const assassin of playerUnits.concat(enemyUnits)) {
    if (assassin.champion.role !== "assassin" || assassin.roleTrait <= 0) continue;
    const foes = assassin.side === "player" ? enemyUnits : playerUnits;
    const candidates = foes.filter((u) => ["arcanist", "warlock", "priest", "ranger"].includes(u.champion.role) && !u.dead);
    const target = (candidates.length ? candidates : foes).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!target) continue;
    assassin.x = clamp(target.x + (assassin.side === "player" ? -0.25 : 0.25), 0.3, 7.5);
    assassin.y = clamp(target.y + (assassin.side === "player" ? -0.65 : 0.65), 0.3, 7.5);
  }
}

function applyOpeningAuras(playerUnits: RuntimeUnit[], enemyUnits: RuntimeUnit[], playerInput: CombatTeamInput, enemyInput: CombatTeamInput): void {
  const pairs: Array<[RuntimeUnit[], RuntimeUnit[], CombatTeamInput]> = [
    [playerUnits, enemyUnits, playerInput],
    [enemyUnits, playerUnits, enemyInput],
  ];
  for (const [allies, foes, input] of pairs) {
    const warlockLevel = input.traits.roles.warlock ?? 0;
    const resistCut = levelValue([0.08, 0.16], warlockLevel);
    if (resistCut > 0 && allies.some((u) => u.champion.role === "warlock")) {
      for (const foe of foes) foe.resist *= Math.max(0.55, 1 - resistCut);
    }
  }
}

export function simulateCombat(playerInput: CombatTeamInput, enemyInput: CombatTeamInput, seed: number): CombatResult {
  const rng = mulberry32(seed);
  const playerMade = makeRuntimeUnits("player", playerInput, 1);
  const enemyMade = makeRuntimeUnits("enemy", enemyInput, playerMade.nextId);
  const playerUnits = playerMade.units;
  const enemyUnits = enemyMade.units;
  const units = playerUnits.concat(enemyUnits);
  const labels: CombatResult["unitLabels"] = {};
  for (const unit of units) {
    labels[unit.id] = {
      championId: unit.champion.id,
      side: unit.side,
      star: unit.star,
      name: unit.champion.name,
    };
  }

  applyOpeningAuras(playerUnits, enemyUnits, playerInput, enemyInput);
  applyOpeningAssassinMoves(playerUnits, enemyUnits);
  const events: CombatEvent[] = [];
  const frames: CombatFrame[] = [];
  const damageDealt: Record<number, number> = {};
  const healingDone: Record<number, number> = {};
  const dt = 0.2;
  const maxDuration = 46;
  let winner: CombatResult["winner"] = "draw";
  let t = 0;

  frames.push(snapshot(units, 0));
  for (t = dt; t <= maxDuration; t += dt) {
    const fatigue = t > 32 ? 1 + (t - 32) * 0.045 : 1;
    for (const unit of units) {
      if (unit.dead) continue;
      // Damage-over-time and duration processing.
      for (const status of unit.statuses) {
        if (status.remaining <= 0) continue;
        status.remaining -= dt;
        if ((status.kind === "burn" || status.kind === "poison") && status.power > 0) {
          const owner = units.find((u) => u.id === status.source) ?? null;
          dealDamage(owner, unit, status.power * dt * fatigue, "true", events, t, damageDealt, healingDone);
        }
      }
      unit.statuses = unit.statuses.filter((s) => s.remaining > -0.2);
      if (unit.dead) continue;

      const allies = unit.side === "player" ? playerUnits : enemyUnits;
      const enemies = unit.side === "player" ? enemyUnits : playerUnits;
      const target = nearestEnemy(unit, enemies);
      if (!target) continue;

      const disabled = hasStatus(unit, ["stun", "freeze"]);
      const silenced = hasStatus(unit, ["silence"]);
      if (!disabled && unit.mana >= unit.manaMax && !silenced) {
        castSkill(unit, target, allies, enemies, events, t, damageDealt, healingDone);
        continue;
      }

      const dist = distance(unit, target);
      if (dist > unit.range) {
        if (!disabled) moveToward(unit, target, dt, units);
      } else if (!disabled) {
        unit.attackTimer -= dt * statusSpeedMultiplier(unit) * unit.speed;
        if (unit.attackTimer <= 0) {
          unit.attackTimer = 1;
          unit.attackCount += 1;
          const physical = isPhysical(unit.champion);
          const attackValue = physical ? unit.attack : unit.magic;
          const hitRoll = rng();
          const dodged = hitRoll < target.dodge * (unit.champion.role === "ranger" ? 0.75 : 1);
          events.push({ t, type: "attack", source: unit.id, target: target.id, x: unit.x, y: unit.y, x2: target.x, y2: target.y });
          if (!dodged) {
            const crit = rng() < unit.critChance;
            const raw = attackValue * (crit ? unit.critDamage : 1) * fatigue;
            const dealt = dealDamage(unit, target, raw, physical ? "physical" : "magic", events, t, damageDealt, healingDone, primaryElement(unit.champion.elementMask));
            unit.mana = Math.min(unit.manaMax, unit.mana + 12 * unit.manaGain);
            if (unit.items.includes("frost_sigil")) addStatus(target, "slow", 2, 0.12, unit.id, events, t);
            if (unit.items.includes("thunder_hammer") && unit.attackCount % 3 === 0) {
              const splashTargets = enemiesInRadius(target, enemies, 1.25).filter((e) => e.id !== target.id).slice(0, 2);
              for (const splash of splashTargets) dealDamage(unit, splash, dealt * 0.35, physical ? "physical" : "magic", events, t, damageDealt, healingDone, primaryElement(unit.champion.elementMask));
            }
            if (crit) events.push({ t, type: "damage", source: unit.id, target: target.id, text: "暴击", x: target.x, y: target.y });
          } else {
            events.push({ t, type: "damage", source: unit.id, target: target.id, text: "闪避", x: target.x, y: target.y });
          }
        }
      }
    }

    frames.push(snapshot(units, t));
    const playerAlive = playerUnits.some((u) => !u.dead);
    const enemyAlive = enemyUnits.some((u) => !u.dead);
    if (!playerAlive || !enemyAlive) {
      if (playerAlive && !enemyAlive) winner = "player";
      else if (!playerAlive && enemyAlive) winner = "enemy";
      else winner = "draw";
      break;
    }
  }

  if (!playerUnits.some((u) => !u.dead) && enemyUnits.some((u) => !u.dead)) winner = "enemy";
  else if (playerUnits.some((u) => !u.dead) && !enemyUnits.some((u) => !u.dead)) winner = "player";
  else if (winner === "draw") {
    const playerHpPct = playerUnits.reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
    const enemyHpPct = enemyUnits.reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
    if (Math.abs(playerHpPct - enemyHpPct) > 0.12) winner = playerHpPct > enemyHpPct ? "player" : "enemy";
  }

  const duration = Math.min(t, maxDuration);
  events.push({ t: duration, type: "result", text: winner });
  return {
    winner,
    duration,
    survivingPlayer: playerUnits.filter((u) => !u.dead).reduce((sum, u) => sum + u.hp / u.maxHp, 0),
    survivingEnemy: enemyUnits.filter((u) => !u.dead).reduce((sum, u) => sum + u.hp / u.maxHp, 0),
    playerUnitsLeft: playerUnits.filter((u) => !u.dead).length,
    enemyUnitsLeft: enemyUnits.filter((u) => !u.dead).length,
    frames,
    events,
    unitLabels: labels,
    damageDealt,
    healingDone,
  };
}
