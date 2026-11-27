import type { Champion, RosterDataset } from "../types";

export type PoolGroupId =
  | "season1"
  | "original_classic"
  | "series_heretic"
  | "series_rebel"
  | "series_observer"
  | "series_creation"
  | "series_blessed"
  | "collab_fate"
  | "collab_aot"
  | "collab_eva"
  | "collab_vocaloid"
  | "collab_kof"
  | "collab_streetfighter"
  | "collab_madoka"
  | "collab_seven_sins"
  | "collab_fairy_tail"
  | "collab_onepunch"
  | "collab_black_clover"
  | "collab_danmachi"
  | "collab_tensura"
  | "collab_rezero"
  | "collab_overlord"
  | "collab_bleach"
  | "collab_shadow"
  | "collab_mushoku"
  | "collab_konosuba"
  | "collab_hololive"
  | "collab_other";

export interface PoolGroupDef {
  id: PoolGroupId;
  name: string;
  kind: "preset" | "original" | "collab";
}

export const POOL_GROUPS: PoolGroupDef[] = [
  { id: "season1", name: "第一赛季", kind: "preset" },
  { id: "original_classic", name: "本家经典", kind: "original" },
  { id: "series_heretic", name: "异端者系列", kind: "original" },
  { id: "series_rebel", name: "反叛者系列", kind: "original" },
  { id: "series_observer", name: "观测者系列", kind: "original" },
  { id: "series_creation", name: "创命/星咏/天醒", kind: "original" },
  { id: "series_blessed", name: "祝福/盟将系列", kind: "original" },
  { id: "collab_fate", name: "Fate 联动", kind: "collab" },
  { id: "collab_aot", name: "进击的巨人", kind: "collab" },
  { id: "collab_eva", name: "EVA 联动", kind: "collab" },
  { id: "collab_vocaloid", name: "初音/Vocaloid", kind: "collab" },
  { id: "collab_kof", name: "拳皇联动", kind: "collab" },
  { id: "collab_streetfighter", name: "街霸联动", kind: "collab" },
  { id: "collab_madoka", name: "魔法少女小圆", kind: "collab" },
  { id: "collab_seven_sins", name: "七大罪联动", kind: "collab" },
  { id: "collab_fairy_tail", name: "妖精的尾巴", kind: "collab" },
  { id: "collab_onepunch", name: "一拳超人", kind: "collab" },
  { id: "collab_black_clover", name: "黑色五叶草", kind: "collab" },
  { id: "collab_danmachi", name: "地下城邂逅", kind: "collab" },
  { id: "collab_tensura", name: "史莱姆联动", kind: "collab" },
  { id: "collab_rezero", name: "Re:0 联动", kind: "collab" },
  { id: "collab_overlord", name: "Overlord", kind: "collab" },
  { id: "collab_bleach", name: "死神 Bleach", kind: "collab" },
  { id: "collab_shadow", name: "影之实力者", kind: "collab" },
  { id: "collab_mushoku", name: "无职转生", kind: "collab" },
  { id: "collab_konosuba", name: "美好世界", kind: "collab" },
  { id: "collab_hololive", name: "Hololive", kind: "collab" },
  { id: "collab_other", name: "其他联动", kind: "collab" },
];

const ORIGINAL_THEME = /异端|反叛|观测者|创命主|星咏神|天醒|盟将|祝福|梦幻召唤/;

function has(name: string, words: string[]): boolean {
  return words.some((word) => name.includes(word));
}

function collabKey(champion: Champion): PoolGroupId | null {
  if (!champion.isCollabo) return null;
  const n = champion.name;
  if (has(n, ["卫宫", "Saber", "Archer", "Lancer", "远坂凛", "伊莉雅", "吉尔伽美什", "美游", "克洛伊", "间桐樱", "Berserker", "梦幻召唤"])) return "collab_fate";
  if (has(n, ["艾伦", "三笠", "利威尔", "韩吉", "克里斯塔", "莱纳", "爱尔敏", "进击", "铠之巨人", "迪耶菈"])) return "collab_aot";
  if (has(n, ["明日香", "绫波丽", "碇真嗣", "真嗣", "渚薰", "玛丽", "美里", "使徒", "初号机", "2号机", "8号机", "Mark.", "Wunder", "EVA", "变革者", "救济者", "默示者", "熏", "丽＆", "尤弥尔", "海德伦", "斯雷普尼尔", "法芙尼尔", "维德佛尔尼尔", "芬里尔"])) return "collab_eva";
  if (has(n, ["初音未来", "镜音", "巡音", "女武神未来", "小初音"])) return "collab_vocaloid";
  if (has(n, ["草薙京", "八神庵", "不知火舞", "麻宫雅典娜", "库拉", "欧米茄"])) return "collab_kof";
  if (has(n, ["杀意隆", "卡琳", "嘉米", "豪鬼", "春丽", "肯", "隆"])) return "collab_streetfighter";
  if (has(n, ["鹿目圆", "晓美焰", "美树沙耶香", "佐仓杏子", "巴麻美", "沃普尔吉斯", "萝萝", "娜娜"])) return "collab_madoka";
  if (has(n, ["梅利奥达斯", "伊丽莎白", "黛安", "班", "高瑟", "玛琳", "艾斯卡诺", "杰鲁德利斯", "艾斯塔罗萨", "吉尔桑达", "亨德里克森", "六雪尼", "金"])) return "collab_seven_sins";
  if (has(n, ["纳兹", "露西", "艾露莎", "格雷", "温蒂", "托卡", "瑟雷夫", "梅比斯", "朱毕安", "哈特菲利亚", "多拉格尼尔", "佛尔帕斯塔", "舒卡勒托", "玛贝尔"])) return "collab_fairy_tail";
  if (has(n, ["埼玉", "杰诺斯", "饿狼", "索尼克", "龙卷", "吹雪"])) return "collab_onepunch";
  if (has(n, ["阿斯塔", "由诺", "诺艾尔", "塞科蕾", "夏洛特", "夜见", "法格莱恩", "诺赛尔"])) return "collab_black_clover";
  if (has(n, ["贝尔·克朗尼", "艾丝·华伦斯坦", "赫斯缇雅", "琉·璃昂", "三条野", "春姬"])) return "collab_danmachi";
  if (has(n, ["利姆鲁", "朱菜", "米莉姆", "红丸", "岚牙"])) return "collab_tensura";
  if (has(n, ["爱蜜莉雅", "雷姆", "拉姆", "库珥修", "菲鲁特", "艾姬多娜"])) return "collab_rezero";
  if (has(n, ["安兹", "雅儿贝德", "夏提雅", "娜贝拉尔", "依比鲁艾", "迪米乌哥斯"])) return "collab_overlord";
  if (has(n, ["黑崎一护", "朽木", "更木剑八", "日番谷", "四枫院", "蓝染", "阿散井"])) return "collab_bleach";
  if (has(n, ["希德·卡盖诺", "暗影", "阿尔法", "贝塔", "德尔塔", "伊普西龙", "亚罗拉"])) return "collab_shadow";
  if (has(n, ["鲁迪乌斯", "洛琪希", "希露菲叶特", "艾莉丝"])) return "collab_mushoku";
  if (has(n, ["阿克娅", "达克妮斯", "惠惠", "爱丽丝"])) return "collab_konosuba";
  if (has(n, ["Pekora", "Ina", "Kronii", "Mio", "Marine", "Chloe", "Mumei", "Miko", "Lamy", "Koyori", "Kiara", "兔田佩克拉", "一伊那尔栖", "小鸟游琪亚拉"])) return "collab_hololive";
  return "collab_other";
}

function matchesOriginalSeries(champion: Champion, id: PoolGroupId): boolean {
  const name = champion.name;
  if (id === "series_heretic") return name.includes("异端");
  if (id === "series_rebel") return name.includes("反叛");
  if (id === "series_observer") return name.includes("观测者");
  if (id === "series_creation") return /创命主|星咏神|天醒/.test(name);
  if (id === "series_blessed") return /祝福|盟将/.test(name);
  if (id === "original_classic") return !champion.isCollabo && !ORIGINAL_THEME.test(name);
  return false;
}

export function normalizePoolGroups(input: unknown): PoolGroupId[] {
  const valid = new Set<PoolGroupId>(POOL_GROUPS.map((group) => group.id));
  const values = Array.isArray(input) ? input.filter((id): id is PoolGroupId => typeof id === "string" && valid.has(id as PoolGroupId)) : [];
  return values.length ? Array.from(new Set(values)) : ["season1"];
}

export function poolGroupName(id: PoolGroupId): string {
  return POOL_GROUPS.find((group) => group.id === id)?.name ?? id;
}

function matchesGroup(champion: Champion, group: PoolGroupDef, season1: Set<number>): boolean {
  if (group.id === "season1") return season1.has(champion.id);
  if (group.kind === "original") return matchesOriginalSeries(champion, group.id);
  return collabKey(champion) === group.id;
}

/** Union semantics: selected franchise/title-series categories compose one themed shop pool. */
export function championsForPoolGroups(dataset: RosterDataset, selectedInput: unknown): Champion[] {
  const selected = normalizePoolGroups(selectedInput);
  const season1 = new Set(dataset.seasons.season1);
  const groups = POOL_GROUPS.filter((group) => selected.includes(group.id));
  const byId = new Map<number, Champion>();
  for (const champion of dataset.characters) {
    if (!champion.assets.hasIcon) continue;
    if (groups.some((group) => matchesGroup(champion, group, season1))) byId.set(champion.id, champion);
  }
  return Array.from(byId.values()).sort((a, b) => a.cost - b.cost || a.id - b.id);
}
