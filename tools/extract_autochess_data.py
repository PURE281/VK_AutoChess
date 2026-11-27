#!/usr/bin/env python3
"""Build the local fan-game dataset and image assets from the offline Valkyrie resource cache.

Personal/offline use only. The generated files intentionally stay inside this workspace and are
not meant to be redistributed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import warnings
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import UnityPy
from PIL import Image, ImageOps

UnityPy.config.FALLBACK_UNITY_VERSION = "6000.0.68f1"
warnings.filterwarnings("ignore")

RACES = {
    1: ("神族", "#f6d365"),
    2: ("人类", "#8ec5fc"),
    3: ("精灵", "#8fd984"),
    4: ("矮人", "#d6a05f"),
    5: ("亚人", "#f28bb7"),
    6: ("巨人", "#c28cf2"),
    7: ("神兽", "#63d7d2"),
    8: ("幻灵", "#b7a7ff"),
}
CLASSES = {
    1: ("物理", "#ff7666"),
    2: ("魔法", "#74a9ff"),
    3: ("防御", "#e3c66f"),
}
ELEMENTS = {
    1: ("无", "#8896ab"),
    2: ("火", "#ff5c5c"),
    4: ("水", "#4fa8ff"),
    8: ("木", "#3ecf7a"),
    16: ("光", "#e8c15a"),
    32: ("暗", "#a97bff"),
    64: ("无", "#8896ab"),
}
ROLE_INFO = {
    "berserker": ("狂战", "#ff7666"),
    "assassin": ("刺客", "#e86df2"),
    "ranger": ("游侠", "#72d99a"),
    "arcanist": ("魔导", "#74a9ff"),
    "warlock": ("咒术", "#a97bff"),
    "priest": ("祭司", "#f2df8a"),
    "warden": ("铁卫", "#d4b36a"),
    "templar": ("圣盾", "#ffe08a"),
}

ICON_RE = re.compile(r"^additional_characters_icon_iconcharacter_icon_character_(\d+)_(\d+)\.unity3d$")
STAND_BASE_RE = re.compile(r"^additional_characters_standing_img_character_(\d+)_(\d+)_base\.unity3d$")
STAND_MASK_RE = re.compile(r"^additional_characters_standing_img_character_(\d+)_(\d+)_mask\.unity3d$")
PREFAB_RE = re.compile(r"^additional_characters_prefab_chr(\d+)_(\d+)(?:_\d+)?\.unity3d$")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def stable01(text: str) -> float:
    digest = hashlib.md5(text.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) / float(0xFFFFFFFFFFFF)


def load_text_bundle(bundle_path: Path) -> dict[str, str]:
    env = UnityPy.load(str(bundle_path))
    for obj in env.objects:
        if obj.type.name == "TextAsset":
            text = obj.read().m_Script
            result: dict[str, str] = {}
            for line in text.splitlines():
                if "\t" in line:
                    key, value = line.split("\t", 1)
                    result[key] = value
            return result
    return {}


def scan_resources(res_root: Path) -> dict[str, dict[int, dict[int, str]]]:
    maps: dict[str, dict[int, dict[int, str]]] = {
        "icon": defaultdict(dict),
        "standing_base": defaultdict(dict),
        "standing_mask": defaultdict(dict),
        "prefab": defaultdict(dict),
    }
    regexes = (
        ("icon", ICON_RE),
        ("standing_base", STAND_BASE_RE),
        ("standing_mask", STAND_MASK_RE),
        ("prefab", PREFAB_RE),
    )
    for dirpath, _, filenames in os.walk(res_root):
        for filename in filenames:
            if not filename.endswith(".unity3d"):
                continue
            for kind, regex in regexes:
                match = regex.match(filename)
                if match:
                    cid = int(match.group(1))
                    variant = int(match.group(2))
                    maps[kind][cid][variant] = str(Path(dirpath) / filename)
                    break
    return maps


def choose_variant(available: dict[int, str]) -> tuple[int | None, str | None]:
    if not available:
        return None, None
    for variant in (1, 101, 2, 3, 4, 5):
        if variant in available:
            return variant, available[variant]
    variant = sorted(available)[0]
    return variant, available[variant]


def first_texture(bundle_path: str) -> Image.Image | None:
    try:
        env = UnityPy.load(bundle_path)
        for obj in env.objects:
            if obj.type.name == "Texture2D":
                return obj.read().image.convert("RGBA")
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] texture load failed: {bundle_path}: {type(exc).__name__}: {exc}", file=sys.stderr)
    return None


def save_webp(image: Image.Image, output: Path, quality: int = 84) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", quality=quality, method=5)


def extract_icon(bundle_path: str, output: Path) -> bool:
    image = first_texture(bundle_path)
    if image is None:
        return False
    if image.size != (140, 140):
        image = ImageOps.fit(image, (140, 140), Image.Resampling.LANCZOS)
    save_webp(image, output, quality=86)
    return True


def extract_standing(base_path: str, mask_path: str | None, output: Path, max_height: int = 720) -> bool:
    base = first_texture(base_path)
    if base is None:
        return False
    if mask_path:
        mask = first_texture(mask_path)
        if mask is not None and mask.size == base.size:
            gray = ImageOps.grayscale(mask)
            base = base.copy()
            base.putalpha(gray)
    # Trim the transparent/white canvas so the character reads large in UI cards.
    alpha = base.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        margin = 10
        left = max(0, bbox[0] - margin)
        top = max(0, bbox[1] - margin)
        right = min(base.width, bbox[2] + margin)
        bottom = min(base.height, bbox[3] + margin)
        base = base.crop((left, top, right, bottom))
    if base.height > max_height:
        width = max(1, round(base.width * max_height / base.height))
        base = base.resize((width, max_height), Image.Resampling.LANCZOS)
    save_webp(base, output, quality=82)
    return True


def parse_skill_text(char_text: dict[str, str], skill_text: dict[str, str], cid: int, sid: int) -> dict[str, str]:
    return {
        "name": skill_text.get(f"skill_name_{sid}", f"秘技·{sid}"),
        "description": skill_text.get(f"skill_detail_{sid}", ""),
        "characterDetail": char_text.get(f"detail_{cid}", ""),
        "story": char_text.get(f"story_{cid}", ""),
        "cv": char_text.get(f"cv_{cid}", ""),
    }


def metric(entries: list[dict[str, Any]] | None) -> float:
    if not entries:
        return 0.0
    powers: list[float] = []
    for entry in entries:
        power_list = entry.get("powerList") or []
        if power_list:
            powers.append(float(max(power_list)))
    if not powers:
        return 0.0
    powers.sort(reverse=True)
    return powers[0] + sum(powers[1:]) * 0.35


def infer_skill_profile(skill_id: int, description: str, overview: dict[int, dict[str, Any]]) -> dict[str, Any]:
    data = overview.get(skill_id) or {}
    damage = metric(data.get("damageInfos"))
    heal = metric(data.get("recoveryInfos"))
    buff = metric(data.get("buffInfos"))
    debuff = metric(data.get("debuffInfos"))
    ailment = metric(data.get("ailmentInfos"))
    charge = metric(data.get("skillChargeInfos"))
    ailment_count = len(data.get("ailmentInfos") or [])

    text = description or ""
    if re.search(r"(敌人|敌方|对手).{0,4}全体|全体.{0,3}(敌人|敌方)", text):
        target = "allEnemies"
    elif re.search(r"(己方|友方|同伴).{0,4}全体|全体.{0,3}(己方|友方)", text):
        target = "allAllies"
    elif "附近" in text or "范围" in text or "周围" in text:
        target = "splash"
    elif "自身" in text and not damage:
        target = "self"
    elif "1名" in text or "一名" in text or "单体" in text:
        target = "single"
    elif heal and not damage:
        target = "allAllies" if "全体" in text else "ally"
    else:
        target = "nearest"

    if heal >= 35 or re.search(r"复活|恢复|回复|治疗", text):
        kind = "heal" if damage < 80 else "hybrid"
    elif re.search(r"护盾|屏障|护罩", text):
        kind = "shield" if damage < 80 else "hybrid"
    elif damage >= 90 and (debuff or ailment_count >= 3):
        kind = "burstControl"
    elif damage >= 90:
        kind = "burst"
    elif buff >= 25 and damage < 50:
        kind = "buff"
    elif debuff >= 20 or ailment_count >= 3:
        kind = "control"
    elif damage > 0:
        kind = "damage"
    else:
        kind = "buff" if buff else "damage"

    hits = 1
    hit_match = re.search(r"×\s*(\d+)\s*次", text)
    if hit_match:
        hits = max(1, min(8, int(hit_match.group(1))))
    elif target == "allEnemies":
        hits = 1

    return {
        "kind": kind,
        "target": target,
        "damage": round(damage, 2),
        "heal": round(heal, 2),
        "buff": round(buff, 2),
        "debuff": round(debuff, 2),
        "ailment": round(ailment, 2),
        "ailmentCount": ailment_count,
        "charge": round(charge, 2),
        "hits": hits,
        "hasOverview": bool(data),
    }


def percentile_map(values: dict[int, float]) -> dict[int, float]:
    ordered = sorted(values.items(), key=lambda item: (item[1], item[0]))
    count = len(ordered)
    result: dict[int, float] = {}
    for index, (key, _) in enumerate(ordered):
        result[key] = index / max(1, count - 1)
    return result


def progression_scale(entry: dict[str, Any]) -> float:
    level_factor = 1.0 + max(0, int(entry.get("level") or 1) - 1) * 0.065
    star_delta = max(0, int(entry.get("star") or 1) - int(entry.get("init_star") or 1))
    grade = max(1, int(entry.get("grade") or 1))
    star_factor = 1.52 ** star_delta
    grade_factor = 1.095 ** (grade - 1)
    return level_factor * star_factor * grade_factor


def infer_role(entry: dict[str, Any], stat_pct: dict[str, float], skill: dict[str, Any]) -> str:
    class_type = int(entry.get("type") or 1)
    description = (skill.get("description") or "") + (skill.get("characterDetail") or "")
    healish = skill.get("heal", 0) >= 20 or re.search(r"恢复|回复|治疗|复活", description)
    shieldish = bool(re.search(r"护盾|屏障|护罩", description))
    controlish = skill.get("ailmentCount", 0) >= 3 or skill.get("debuff", 0) >= 25

    if class_type == 2:
        if healish:
            return "priest"
        if controlish:
            return "warlock"
        return "arcanist"
    if class_type == 3:
        return "templar" if shieldish or healish else "warden"
    # Physical attackers: high agility/dodge units become assassins; high hit/agility with elf/beastfolk flavor becomes ranger.
    agility = stat_pct.get("agility", 0.5)
    dodge = stat_pct.get("dodge", 0.5)
    hit = stat_pct.get("hit", 0.5)
    race = int(entry.get("race") or 0)
    if agility > 0.67 and dodge > 0.48:
        return "assassin"
    if hit > 0.61 and (race in (3, 5) or agility > 0.54):
        return "ranger"
    return "berserker"


def combat_range(class_type: int) -> float:
    # Valkyrie Connect character type is a distance type rather than a defensive
    # class: 1=近距離 (melee), 2=中距離 (mid-range), 3=遠距離 (long-range).
    # Autochess roles are orthogonal combat identities and must not overwrite it.
    return {1: 1.35, 2: 2.65, 3: 4.0}.get(class_type, 1.35)


def shape_pct(character: dict[str, Any], field: str) -> float:
    # statShape is serialized as 0.78 + percentile * 0.44; recover the percentile for role decisions.
    return max(0.0, min(1.0, (float(character.get("statShape", {}).get(field) or 1.0) - 0.78) / 0.44))


def allocate_role_by_cost(
    pool: list[dict[str, Any]],
    allocations: list[tuple[str, dict[int, int], Any]],
    assign: Any,
) -> None:
    """Allocate cost-aware role quotas from a same-class pool.

    allocations are applied in order inside each cost tier. The quotas intentionally sum to the
    season's class/cost distribution, so every role has both early-game access pieces and late-game
    premium pieces instead of being trapped at one end of the shop table.
    """
    local_assigned: set[int] = set()
    for cost in range(1, 6):
        cost_pool = [c for c in pool if c["cost"] == cost]
        cursor = 0
        for role, targets, score_fn in allocations:
            need = targets.get(cost, 0)
            if need <= 0:
                continue
            chosen = sorted(cost_pool, key=lambda c: (score_fn(c), -c["id"]), reverse=True)[cursor:cursor + need]
            # Because each role consumes a slice in sequence, recompute against remaining units rather
            # than assuming cursor ordering across different score functions.
            remaining = [c for c in cost_pool if c["id"] not in local_assigned]
            chosen = sorted(remaining, key=lambda c: (score_fn(c), -c["id"]), reverse=True)[:need]
            if chosen:
                assign(chosen, role)
                for c in chosen:
                    local_assigned.add(c["id"])
    leftovers = [c for c in pool if c["id"] not in local_assigned]
    if leftovers:
        fallback_role = allocations[0][0]
        assign(leftovers, fallback_role)


def rebalance_season_roles(characters: list[dict[str, Any]], season1: list[int]) -> None:
    """Shape the first-season role distribution into playable synergy archetypes.

    The source game only has three broad combat classes. A direct semantic mapping leaves several
    auto-chess classes with one to three pieces, making their breakpoints unreachable in normal games.
    We keep the mapping stat/text driven, but deliberately allocate each broad class into a complete
    role ecosystem. This is a fan-game design layer rather than a claim about the original game.
    """
    by_id = {c["id"]: c for c in characters}
    season_chars = [by_id[cid] for cid in season1 if cid in by_id]
    assigned: set[int] = set()

    def assign(group: list[dict[str, Any]], role: str) -> None:
        for c in group:
            c["role"] = role
            assigned.add(c["id"])

    # Physical attackers: mobile/high-dodge pieces become assassins, accurate/light pieces become
    # rangers, and the remaining heavy/core fighters are berserkers. Quotas are cost-aware so every
    # archetype can be opened early and capped with premium units late.
    physical = [c for c in season_chars if c["classType"] == 1]
    def physical_assign(group: list[dict[str, Any]], role: str) -> None:
        assign(group, role)
    allocate_role_by_cost(
        physical,
        [
            ("berserker", {1: 3, 2: 3, 3: 2, 4: 3, 5: 2}, lambda c: shape_pct(c, "physical_attack") + shape_pct(c, "hp") * 0.35),
            ("assassin", {1: 3, 2: 2, 3: 2, 4: 1, 5: 1}, lambda c: shape_pct(c, "agility") + shape_pct(c, "dodge") * 0.75 + shape_pct(c, "critical") * 0.35 + (0.16 if c["race"] in (3, 5, 8) else 0.0)),
            ("ranger", {1: 3, 2: 2, 3: 2, 4: 2, 5: 1}, lambda c: shape_pct(c, "hit") + shape_pct(c, "agility") * 0.48 + (0.22 if c["race"] in (3, 5) else 0.0) + shape_pct(c, "critical") * 0.12),
        ],
        physical_assign,
    )

    # Magic users: direct healers/support pieces are priests; control-heavy magic becomes warlock;
    # the rest is classic arcanist artillery. Cost quotas keep all three magic lines playable.
    magic = [c for c in season_chars if c["classType"] == 2]
    assigned.clear()
    def skill_text(c: dict[str, Any]) -> str:
        return (c["skill"].get("description") or "") + (c["skill"].get("characterDetail") or "")
    def support_score(c: dict[str, Any]) -> float:
        text = skill_text(c)
        return (
            float(c["skill"].get("heal") or 0) * 3.0
            + float(c["skill"].get("buff") or 0) * 1.2
            + float(c["skill"].get("charge") or 0) * 1.5
            + (45.0 if re.search(r"恢复|回复|治疗|复活", text) else 0.0)
            + (25.0 if re.search(r"护盾|屏障|护罩|增益", text) else 0.0)
        )
    def control_score(c: dict[str, Any]) -> float:
        text = skill_text(c)
        return (
            float(c["skill"].get("ailmentCount") or 0) * 24.0
            + float(c["skill"].get("debuff") or 0) * 2.2
            + float(c["skill"].get("ailment") or 0) * 0.35
            + (35.0 if re.search(r"沉默|眩晕|冰冻|束缚|诅咒|弱化|减益|异常", text) else 0.0)
        )
    allocate_role_by_cost(
        magic,
        [
            ("arcanist", {1: 3, 2: 4, 3: 2, 4: 2, 5: 1}, lambda c: float(c["skill"].get("damage") or 0) / 100.0 + shape_pct(c, "magic_attack")),
            ("priest", {1: 2, 2: 1, 3: 2, 4: 2, 5: 1}, support_score),
            ("warlock", {1: 2, 2: 2, 3: 2, 4: 2, 5: 2}, control_score),
        ],
        assign,
    )

    # Defenders: support/shield-oriented tanks become templars; straightforward damage sponges remain wardens.
    defense = [c for c in season_chars if c["classType"] == 3]
    assigned.clear()
    def templar_score(c: dict[str, Any]) -> float:
        text = skill_text(c)
        return (
            (80.0 if re.search(r"护盾|屏障|护罩|圣|守护|庇护", text) else 0.0)
            + float(c["skill"].get("heal") or 0) * 1.8
            + float(c["skill"].get("buff") or 0) * 0.8
            + shape_pct(c, "hp") * 18.0
            + (shape_pct(c, "physical_defense") + shape_pct(c, "magic_defense")) * 8.0
        )
    allocate_role_by_cost(
        defense,
        [
            ("warden", {1: 4, 2: 4, 3: 3, 4: 3, 5: 2}, lambda c: shape_pct(c, "hp") + shape_pct(c, "physical_defense") + shape_pct(c, "magic_defense")),
            ("templar", {1: 3, 2: 3, 3: 3, 4: 3, 5: 2}, templar_score),
        ],
        assign,
    )



def build_dataset(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.project_root)
    res_root = Path(args.res_root)
    offline_data = Path(args.offline_data)

    raw_response = read_json(root / "vc_bot" / "resp301_full.json")
    entries_by_uid = json.loads(raw_response["characters"])
    entries = list(entries_by_uid.values())

    char_text = load_text_bundle(res_root / "localized_zh_cn_text_characters.unity3d")
    skill_text = load_text_bundle(res_root / "localized_zh_cn_text_skills.unity3d")
    action_overview = read_json(offline_data / "masterdata_json" / "CharacterActionSkillOverviews.json")["skillOverviews"]
    overview_by_id = {int(row["skillId"]): row for row in action_overview}

    print("[scan] indexing character resource bundles...")
    resource_maps = scan_resources(res_root)

    # Release ordering is a stable power-creep hint. Account progression is intentionally not trusted:
    # high-level/starred favorites should not automatically become high-cost units.
    def release_key(entry: dict[str, Any]) -> tuple[str, int, int]:
        return (str(entry.get("release_at") or ""), int(entry.get("sort") or 0), int(entry.get("character_id") or 0))

    release_sorted = sorted(entries, key=release_key)
    release_rank = {id(entry): index / max(1, len(release_sorted) - 1) for index, entry in enumerate(release_sorted)}

    scale_by_cid: dict[int, float] = {}
    for entry in entries:
        cid = int(entry["character_id"])
        scale_by_cid[cid] = progression_scale(entry)

    stat_fields = ("hp", "physical_attack", "magic_attack", "physical_defense", "magic_defense", "agility", "hit", "dodge", "critical", "heavy")
    adjusted_stat_values: dict[str, dict[int, float]] = {field: {} for field in stat_fields}
    for entry in entries:
        cid = int(entry["character_id"])
        scale = max(0.1, scale_by_cid[cid])
        params = entry.get("base_parameters") or {}
        for field in stat_fields:
            adjusted_stat_values[field][cid] = float(params.get(field) or 0) / scale
    stat_pct_by_field = {field: percentile_map(values) for field, values in adjusted_stat_values.items()}

    characters: list[dict[str, Any]] = []
    for entry in entries:
        cid = int(entry["character_id"])
        stat_pct = {field: stat_pct_by_field[field].get(cid, 0.5) for field in stat_fields}
        skill_id = int(entry.get("action_skill_id") or entry.get("action_skill_text_id") or 0)
        localized = parse_skill_text(char_text, skill_text, cid, skill_id)
        profile = infer_skill_profile(skill_id, localized["description"], overview_by_id)
        role = infer_role(entry, stat_pct, {**profile, **localized})

        total = float(entry.get("total_parameter") or 0)
        scale = max(0.1, scale_by_cid[cid])
        canonical = total / scale
        stat_hint = max(0.0, min(1.0, (canonical - 920.0) / 1400.0))
        rr = release_rank[id(entry)]
        special = 0.16 if int(entry.get("init_star") or 0) >= 6 else 0.0
        jitter = (stable01(f"cost:{cid}") - 0.5) * 0.09
        cost_score = max(0.0, min(1.0, rr * 0.72 + stat_hint * 0.16 + special + 0.06 + jitter))
        # Per-class rank prevents one combat type from monopolizing a cost tier.
        characters.append({
            "id": cid,
            "name": char_text.get(f"name_{cid}", f"无名英雄 {cid}"),
            "race": int(entry.get("race") or 0),
            "classType": int(entry.get("type") or 1),
            "attackType": int(entry.get("attack_type") or 1),
            "elementMask": int(entry.get("action_skill_element") or 0),
            "releaseAt": str(entry.get("release_at") or ""),
            "gender": int(entry.get("gender") or 0),
            "initStar": int(entry.get("init_star") or 3),
            "sort": int(entry.get("sort") or 0),
            "costScore": round(cost_score, 5),
            "stats": {
                "hp": float((entry.get("base_parameters") or {}).get("hp") or 0),
                "patk": float((entry.get("base_parameters") or {}).get("physical_attack") or 0),
                "matk": float((entry.get("base_parameters") or {}).get("magic_attack") or 0),
                "pdef": float((entry.get("base_parameters") or {}).get("physical_defense") or 0),
                "mdef": float((entry.get("base_parameters") or {}).get("magic_defense") or 0),
                "agility": float((entry.get("base_parameters") or {}).get("agility") or 0),
                "hit": float((entry.get("base_parameters") or {}).get("hit") or 0),
                "dodge": float((entry.get("base_parameters") or {}).get("dodge") or 0),
                "critical": float((entry.get("base_parameters") or {}).get("critical") or 0),
                "heavy": float((entry.get("base_parameters") or {}).get("heavy") or 0),
            },
            "statShape": {field: round(0.78 + stat_pct[field] * 0.44, 4) for field in stat_fields},
            "skill": {
                "id": skill_id,
                "iconId": int(entry.get("action_skill_icon_id") or 0),
                **localized,
                **profile,
            },
            "role": role,
            "range": combat_range(int(entry.get("type") or 1)),
            "ultimateId": int(entry.get("ultimate_id") or 0),
            "isCollabo": bool(entry.get("is_collabo")),
            "_entry": entry,
        })

    # Assign costs independently inside each original combat class, with slightly fewer 5-costs.
    bands = (0.22, 0.46, 0.68, 0.86)
    for class_type in (1, 2, 3):
        group = sorted((c for c in characters if c["classType"] == class_type), key=lambda c: (c["costScore"], c["id"]))
        for index, character in enumerate(group):
            rank = index / max(1, len(group) - 1)
            cost = 1 + sum(rank >= threshold for threshold in bands)
            character["cost"] = cost
            character["costRank"] = round(rank, 5)

    # Resource bundle lookup metadata.
    for character in characters:
        cid = character["id"]
        icon_variant, icon_bundle = choose_variant(resource_maps["icon"].get(cid, {}))
        stand_variant, stand_base = choose_variant(resource_maps["standing_base"].get(cid, {}))
        _, stand_mask = choose_variant(resource_maps["standing_mask"].get(cid, {}))
        prefab_variant, prefab_bundle = choose_variant(resource_maps["prefab"].get(cid, {}))
        character["assets"] = {
            "variant": icon_variant or stand_variant or 1,
            "icon": f"assets/icons/{cid}.webp",
            "standing": f"assets/standings/{cid}.webp",
            "hasIcon": bool(icon_bundle),
            "hasStanding": bool(stand_base),
            "prefabBundle": Path(prefab_bundle).name if prefab_bundle else None,
            "prefabVariant": prefab_variant,
        }
        character["_asset_paths"] = {
            "icon": icon_bundle,
            "standingBase": stand_base,
            "standingMask": stand_mask if stand_mask and stand_variant else None,
        }

    # Build a compact, diverse first-season roster. The full 985-character database remains available.
    featured = [
        101001, 101002, 101003, 101004, 101005, 101006,
        102001, 102002, 102003, 201001, 301001,
    ]
    by_id = {c["id"]: c for c in characters}
    selected: dict[int, dict[str, Any]] = {}
    targets = {1: [7, 7, 6, 6, 4], 2: [7, 7, 6, 6, 4], 3: [7, 7, 6, 6, 4]}

    def quality(c: dict[str, Any]) -> float:
        return (
            (1.0 if c["assets"]["hasStanding"] else 0.0)
            + (0.7 if c["skill"]["description"] else 0.0)
            + (0.35 if c["skill"]["hasOverview"] else 0.0)
            + stable01(f"quality:{c['id']}") * 0.2
        )

    # Force a few iconic launch characters first, then fill exact class/cost slots.
    for cid in featured:
        c = by_id.get(cid)
        if c:
            selected[cid] = c

    for class_type in (1, 2, 3):
        race_counts: Counter[int] = Counter(c["race"] for c in selected.values() if c["classType"] == class_type)
        element_counts: Counter[int] = Counter(c["elementMask"] for c in selected.values() if c["classType"] == class_type)
        for cost, target in enumerate(targets[class_type], start=1):
            while sum(1 for c in selected.values() if c["classType"] == class_type and c["cost"] == cost) < target:
                candidates = [
                    c for c in characters
                    if c["classType"] == class_type and c["cost"] == cost and c["id"] not in selected
                ]
                if not candidates:
                    # nearest-cost fallback inside the same class
                    candidates = [
                        c for c in characters
                        if c["classType"] == class_type and c["id"] not in selected
                    ]
                if not candidates:
                    break

                def score(c: dict[str, Any], cost=cost) -> float:
                    race_bonus = 0.55 if race_counts[c["race"]] < 2 else (0.18 if race_counts[c["race"]] < 4 else 0.0)
                    element_bonus = 0.25 if element_counts[c["elementMask"]] < 2 else 0.0
                    cost_penalty = abs(c["cost"] - cost) * 0.7
                    return quality(c) + race_bonus + element_bonus - cost_penalty

                chosen = max(candidates, key=score)
                selected[chosen["id"]] = chosen
                race_counts[chosen["race"]] += 1
                element_counts[chosen["elementMask"]] += 1

    season1 = sorted(selected, key=lambda cid: (by_id[cid]["cost"], by_id[cid]["classType"], by_id[cid]["race"], cid))
    rebalance_season_roles(characters, season1)
    for c in characters:
        c["season1"] = c["id"] in season1

    # Strip internal objects before serialization.
    for c in characters:
        c.pop("_entry", None)

    dataset = {
        "version": 1,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": {
            "characters": 985,
            "note": "Offline fan-game data generated from local resource cache; do not redistribute.",
        },
        "constants": {
            "races": {str(k): {"name": v[0], "color": v[1]} for k, v in RACES.items()},
            "classes": {str(k): {"name": v[0], "color": v[1]} for k, v in CLASSES.items()},
            "roles": {k: {"name": v[0], "color": v[1]} for k, v in ROLE_INFO.items()},
            "elements": {str(k): {"name": v[0], "color": v[1]} for k, v in ELEMENTS.items()},
        },
        "seasons": {
            "season1": season1,
        },
        "characters": characters,
    }

    # Validation summary for tuning.
    print("[data] characters", len(characters), "season1", len(season1))
    print("[data] season cost", Counter(c["cost"] for c in characters if c["season1"]))
    print("[data] season class", Counter(c["classType"] for c in characters if c["season1"]))
    print("[data] season race", Counter(c["race"] for c in characters if c["season1"]))
    print("[data] season role", Counter(c["role"] for c in characters if c["season1"]))
    for role in sorted({c["role"] for c in characters if c["season1"]}):
        print("[data] role cost", role, Counter(c["cost"] for c in characters if c["season1"] and c["role"] == role))
    missing_names = sum(1 for c in characters if c["name"].startswith("无名英雄"))
    missing_skill_text = sum(1 for c in characters if not c["skill"]["description"])
    print("[data] missing names", missing_names, "missing skill text", missing_skill_text)
    return dataset


def extract_assets(dataset: dict[str, Any], output_public: Path, limit: int | None = None, season_only: bool = False) -> None:
    characters = dataset["characters"]
    if season_only:
        characters = [c for c in characters if c.get("season1")]
    if limit:
        characters = characters[:limit]
    total = len(characters)
    icon_ok = standing_ok = 0
    for index, character in enumerate(characters, start=1):
        cid = character["id"]
        paths = character.pop("_asset_paths", {})
        icon_out = output_public / "assets" / "icons" / f"{cid}.webp"
        standing_out = output_public / "assets" / "standings" / f"{cid}.webp"
        if paths.get("icon") and (not icon_out.exists() or args_force()):
            if extract_icon(paths["icon"], icon_out):
                icon_ok += 1
        elif icon_out.exists():
            icon_ok += 1
        if paths.get("standingBase") and (not standing_out.exists() or args_force()):
            if extract_standing(paths["standingBase"], paths.get("standingMask"), standing_out):
                standing_ok += 1
        elif standing_out.exists():
            standing_ok += 1
        if index % 50 == 0 or index == total:
            print(f"[assets] {index}/{total} icons={icon_ok} standings={standing_ok}")
    # Never serialize local absolute paths.
    for character in dataset["characters"]:
        character.pop("_asset_paths", None)


def args_force() -> bool:
    return "--force" in sys.argv


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--res-root", default=r"C:\Users\pure81\AppData\LocalLow\Ateam\Valkyrie Connect WW\res")
    parser.add_argument("--offline-data", default=r"C:\Projects\Valkyrie\offline_data")
    parser.add_argument("--output", default=None)
    parser.add_argument("--assets", action="store_true")
    parser.add_argument("--season-only", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    project_root = Path(args.project_root)
    output = Path(args.output) if args.output else project_root / "autochess_web" / "public" / "data" / "roster.json"
    output.parent.mkdir(parents=True, exist_ok=True)

    dataset = build_dataset(args)
    if args.assets:
        extract_assets(dataset, project_root / "autochess_web" / "public", args.limit, args.season_only)
    else:
        for character in dataset["characters"]:
            character.pop("_asset_paths", None)

    output.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[done] wrote {output} ({output.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
