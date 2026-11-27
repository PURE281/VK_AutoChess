"""Batch-export Valkyrie Connect character prefabs to web-ready GLB files.

Pipeline per character:
  Unity .unity3d prefab + animation group -> AssetStudioModCLI FBX -> FBX2glTF GLB

The generated files are fan-work conversion artifacts for local use only.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RES = r"C:\Users\pure81\AppData\LocalLow\Ateam\Valkyrie Connect WW\res"
AS_CLI = ROOT / ".tools" / "assetstudio" / "cli" / "AssetStudioModCLI.exe"
FBX2GLTF = ROOT / ".tools" / "fbx2gltf" / "FBX2glTF.exe"
COMMON_ANIMATORS = [
    "additional_characters_animator__original.unity3d",
    "additional_characters_animator__original_burst.unity3d",
    "additional_characters_animator__original_charge.unity3d",
    "additional_characters_animator__original_raid.unity3d",
]
FALLBACK_ANIMATION = "additional_characters_animations_201038_group.unity3d"
LEGACY_FALLBACK_ANIMATION = FALLBACK_ANIMATION
# Launch-era heroes predate numeric animation bundles; their original clips live in
# codename bundles. These ids were mapped using the official character archive/wiki.
SPECIAL_ANIMATIONS = {
    101001: "additional_characters_animations_mo_sculd_group.unity3d",
    101002: "additional_characters_animations_thor_group.unity3d",
    101003: "additional_characters_animations_mo_loki_group.unity3d",
    101004: "additional_characters_animations_mo_tyr_group.unity3d",
    101005: "additional_characters_animations_mo_heimdall_group.unity3d",
    101006: "additional_characters_animations_mo_thrud_group.unity3d",
    102001: "additional_characters_animations_mo_sigurd_group.unity3d",
    102003: "additional_characters_animations_mo_feirang_group.unity3d",
    201001: "additional_characters_animations_mo_odin_group.unity3d",
    205001: "additional_characters_animations_mo_vellfire_group.unity3d",
    206002: "additional_characters_animations_mo_thiazi_group.unity3d",
    207003: "additional_characters_animations_nidhoggr_group.unity3d",
    207004: "additional_characters_animations_mo_nicotv_group.unity3d",
    301001: "additional_characters_animations_mo_hodr_group.unity3d",
    305002: "additional_characters_animations_mo_mele_group.unity3d",
    106015: "additional_characters_animations_original_group.unity3d",
    # Fate/stay night [UBW] collaboration units. Their skeletons contain
    # collaboration-specific weapon/accessory bones and must not use the
    # generic humanoid fallback clips.
    102009: "additional_characters_animations_mo_fateubw_shirou_group.unity3d",
    102010: "additional_characters_animations_mo_fateubw_saber_group.unity3d",
    102011: "additional_characters_animations_mo_fateubw_dress_saber_group.unity3d",
    102012: "additional_characters_animations_mo_fateubw_archer_group.unity3d",
    102013: "additional_characters_animations_mo_fateubw_lancer_group.unity3d",
    202002: "additional_characters_animations_mo_fateubw_rin_group.unity3d",
    205002: "additional_characters_animations_mo_fateubw_illya_group.unity3d",
    301005: "additional_characters_animations_mo_fateubw_gil_group.unity3d",
    # Yuno's base numeric bundle only contains skillA; the full BC21
    # battle set is stored in the awakening animation archive.
    202041: "additional_characters_animations_202041101_group.unity3d",
    # Launch-era and early costume characters use codename animation archives
    # rather than numeric archives. These mappings are needed because the
    # generic MO_Funa fallback only binds a subset of many skeletons and can
    # leave the upper body in T-pose.
    101007: "additional_characters_animations_mo_sculd_16sum_group.unity3d",
    101008: "additional_characters_animations_mo_molly_group.unity3d",
    101009: "additional_characters_animations_mo_loki_16halloween_group.unity3d",
    101010: "additional_characters_animations_mo_thor_17newyear_group.unity3d",
    101011: "additional_characters_animations_mo_vidar_group.unity3d",
    102004: "additional_characters_animations_mo_nagato_group.unity3d",
    102005: "additional_characters_animations_mo_helgi_group.unity3d",
    102006: "additional_characters_animations_mo_shield_woman_group.unity3d",
    102007: "additional_characters_animations_mo_zwart_group.unity3d",
    102008: "additional_characters_animations_mo_sasha_group.unity3d",
    102014: "additional_characters_animations_mo_mia_group.unity3d",
    103001: "additional_characters_animations_mo_vellfire_group.unity3d",
    104001: "additional_characters_animations_mo_niji_group.unity3d",
    105001: "additional_characters_animations_mo_klozak_group.unity3d",
    105002: "additional_characters_animations_mo_sonja_group.unity3d",
    105003: "additional_characters_animations_mo_sif_group.unity3d",
    105004: "additional_characters_animations_mo_michelle_group.unity3d",
    106001: "additional_characters_animations_mo_surtr_group.unity3d",
    106002: "additional_characters_animations_mo_hrungnir_group.unity3d",
    106003: "additional_characters_animations_mo_skadi_group.unity3d",
    106004: "additional_characters_animations_mo_aegir_group.unity3d",
    106005: "additional_characters_animations_mo_bolthor_group.unity3d",
    107001: "additional_characters_animations_mo_fenrir_group.unity3d",
    107002: "additional_characters_animations_mo_garm_group.unity3d",
    107003: "additional_characters_animations_mo_fafnir_group.unity3d",
    107004: "additional_characters_animations_mo_garm_16halloween_group.unity3d",
    201002: "additional_characters_animations_mo_freja_group.unity3d",
    201003: "additional_characters_animations_mo_gullveig_lv3_group.unity3d",
    201004: "additional_characters_animations_mo_hel_group.unity3d",
    201005: "additional_characters_animations_mo_baldr_group.unity3d",
    201006: "additional_characters_animations_mo_idun_group.unity3d",
    201007: "additional_characters_animations_mo_mani_group.unity3d",
    201008: "additional_characters_animations_mo_hel_16sum_group.unity3d",
    201009: "additional_characters_animations_mo_freja_16sum_group.unity3d",
    201010: "additional_characters_animations_mo_gullveig_16sum_group.unity3d",
    201011: "additional_characters_animations_mo_idun_16halloween_group.unity3d",
    201012: "additional_characters_animations_mo_urd_group.unity3d",
    201013: "additional_characters_animations_mo_mani_16xmas_group.unity3d",
    201014: "additional_characters_animations_mo_amaterasu_group.unity3d",
    202001: "additional_characters_animations_mo_sakura_group.unity3d",
    203001: "additional_characters_animations_mo_nadia_group.unity3d",
    204001: "additional_characters_animations_alvis_group.unity3d",
    204002: "additional_characters_animations_mo_kili_group.unity3d",
    205003: "additional_characters_animations_mo_milka_group.unity3d",
    206001: "additional_characters_animations_mo_ymir_group.unity3d",
    206003: "additional_characters_animations_mo_angrboda_group.unity3d",
    206004: "additional_characters_animations_mo_ymir_boy_group.unity3d",
    206005: "additional_characters_animations_mo_thiazi_16xmas_group.unity3d",
    207001: "additional_characters_animations_mo_jormungand_group.unity3d",
    301002: "additional_characters_animations_vali_group.unity3d",
    301003: "additional_characters_animations_mo_verdandi_group.unity3d",
    301004: "additional_characters_animations_mo_vali_17newyear_group.unity3d",
    302001: "additional_characters_animations_mo_canon_group.unity3d",
    302002: "additional_characters_animations_mo_momiji_group.unity3d",
    302003: "additional_characters_animations_mo_ranco_group.unity3d",
    302004: "additional_characters_animations_mo_matisse_group.unity3d",
    302005: "additional_characters_animations_mo_alner_group.unity3d",
    302006: "additional_characters_animations_mo_nosea_group.unity3d",
    302007: "additional_characters_animations_mo_lisa_group.unity3d",
    303001: "additional_characters_animations_mo_lsior_group.unity3d",
    103002: "additional_characters_animations_soarer_group.unity3d",
    303002: "additional_characters_animations_belta_group.unity3d",
    303003: "additional_characters_animations_mo_darkthief_group.unity3d",
    304001: "additional_characters_animations_mo_corona_group.unity3d",
    305001: "additional_characters_animations_mo_wolfgang_group.unity3d",
    305003: "additional_characters_animations_mo_liciela_group.unity3d",
    306001: "additional_characters_animations_mo_mermare_group.unity3d",
    307001: "additional_characters_animations_mo_vidofnir_lv3_group.unity3d",
}
UNITY_VERSION = "6000.0.68f1"


def parse_glb_header(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20:
        return {}
    magic, _version, _length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        return {}
    chunk_len, _chunk_type = struct.unpack("<II", data[12:20])
    return json.loads(data[20:20 + chunk_len])


def glb_stats(path: Path) -> dict:
    doc = parse_glb_header(path)
    return {
        "animations": [a.get("name", "") for a in doc.get("animations", [])],
        "animationCount": len(doc.get("animations", [])),
        "nodes": len(doc.get("nodes", [])),
        "skins": len(doc.get("skins", [])),
        "meshes": len(doc.get("meshes", [])),
        "materials": len(doc.get("materials", [])),
        "size": path.stat().st_size,
    }


def link_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def choose_animation(cid: int, animation_files: list[str]) -> tuple[str | None, bool]:
    special = SPECIAL_ANIMATIONS.get(cid)
    if special and special in animation_files:
        return special, True
    exact = f"additional_characters_animations_{cid}_group.unity3d"
    if exact in animation_files:
        return exact, True
    # Do not accept merely numeric-prefix matches here: ids such as 1010020001
    # can belong to a costume/variant of a different hero rather than the base
    # character (101002 is Thor, while that prefix archive contains Halloween Thor).
    # Base launch-era heroes are covered explicitly by SPECIAL_ANIMATIONS.
    if FALLBACK_ANIMATION in animation_files:
        return FALLBACK_ANIMATION, False
    return None, False


def run(cmd: list[str], log_path: Path) -> None:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(result.stdout, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(cmd)}\n{result.stdout[-2000:]}")


def export_one(cid: int, prefab_name: str, animation_name: str, exact_animation: bool, args: argparse.Namespace, animation_files: list[str]) -> dict:
    res_root = Path(args.res_root)
    work = Path(args.workdir) / str(cid)
    staging = work / "input"
    fbx_out = work / "fbx"
    glb_out = Path(args.output) / f"{cid}.glb"

    if glb_out.exists() and not args.force:
        stats = glb_stats(glb_out)
        return {"id": cid, "file": f"assets/models/{cid}.glb", "status": "existing", "exactAnimation": exact_animation, **stats}

    shutil.rmtree(work, ignore_errors=True)
    staging.mkdir(parents=True, exist_ok=True)
    fbx_out.mkdir(parents=True, exist_ok=True)

    prefab_src = res_root / prefab_name
    if not prefab_src.exists():
        raise FileNotFoundError(f"missing prefab bundle: {prefab_src}")
    link_or_copy(prefab_src, staging / prefab_name)
    link_or_copy(res_root / animation_name, staging / animation_name)
    for common in COMMON_ANIMATORS:
        src = res_root / common
        if src.exists():
            link_or_copy(src, staging / common)

    run([
        str(AS_CLI), str(staging), "-m", "animator", "-o", str(fbx_out),
        "--unity-version", UNITY_VERSION, "--fbx-animation", "all", "--fbx-dump-materials", "-r", "--log-level", "warning",
    ], work / "assetstudio.log")

    fbx_files = list(fbx_out.rglob("*.fbx"))
    if not fbx_files:
        raise RuntimeError(f"AssetStudio did not produce an FBX for {cid}")
    fbx_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    fbx = fbx_files[0]

    tmp_glb = work / f"{cid}.glb"
    run([
        str(FBX2GLTF), "--binary", "--anim-framerate", "bake30", "--input", str(fbx), "--output", str(work / str(cid)),
    ], work / "fbx2gltf.log")
    if not tmp_glb.exists():
        # FBX2glTF appends .glb itself; this guard protects against odd output naming.
        candidates = list(work.glob("*.glb"))
        if not candidates:
            raise RuntimeError(f"FBX2glTF did not produce a GLB for {cid}")
        tmp_glb = candidates[0]

    glb_out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tmp_glb, glb_out)
    stats = glb_stats(glb_out)
    if stats.get("skins", 0) < 1 or stats.get("animationCount", 0) < 1:
        raise RuntimeError(f"GLB validation failed for {cid}: {stats}")
    if not args.keep_cache:
        shutil.rmtree(work, ignore_errors=True)
    return {"id": cid, "file": f"assets/models/{cid}.glb", "status": "exported", "exactAnimation": exact_animation, **stats}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--res-root", default=DEFAULT_RES)
    parser.add_argument("--output", default=str(ROOT / "public" / "assets" / "models"))
    parser.add_argument("--manifest", default=str(ROOT / "public" / "data" / "models.json"))
    parser.add_argument("--workdir", default=str(ROOT / ".cache" / "model_export"))
    parser.add_argument("--season-only", action="store_true", default=True)
    parser.add_argument("--all", action="store_true", help="export every character in roster.json")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--ids", default=None, help="comma-separated character ids")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--keep-cache", action="store_true")
    args = parser.parse_args()

    if not AS_CLI.exists():
        raise SystemExit(f"AssetStudio CLI not found: {AS_CLI}")
    if not FBX2GLTF.exists():
        raise SystemExit(f"FBX2glTF not found: {FBX2GLTF}")

    roster = json.loads((ROOT / "public" / "data" / "roster.json").read_text(encoding="utf-8"))
    characters = roster["characters"]
    season = set(roster["seasons"]["season1"])
    if args.ids:
        wanted = {int(x) for x in args.ids.split(",") if x.strip()}
    elif args.all:
        wanted = {int(c["id"]) for c in characters}
    else:
        wanted = season
    characters = [c for c in characters if c["id"] in wanted]
    characters.sort(key=lambda c: (c["cost"], c["id"]))
    if args.limit:
        characters = characters[:args.limit]

    res_root = Path(args.res_root)
    animation_files = [x for x in os.listdir(res_root) if x.startswith("additional_characters_animations_") and x.endswith("_group.unity3d")]
    manifest = {"version": 1, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "models": {}, "missing": []}
    manifest_path = Path(args.manifest)
    if manifest_path.exists():
        try:
            old = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["models"] = old.get("models", {})
        except Exception:
            pass

    total = len(characters)
    failures = []
    def safe_print(text: str) -> None:
        print(text.encode("ascii", errors="replace").decode("ascii"), flush=True)

    output_dir = Path(args.output)
    for index, character in enumerate(characters, 1):
        cid = int(character["id"])
        prefab_name = character.get("assets", {}).get("prefabBundle")
        animation_name, exact = choose_animation(cid, animation_files)
        safe_print(f"[{index}/{total}] {cid} {character.get('name')} anim={animation_name}")
        if not args.force and str(cid) in manifest["models"] and (output_dir / f"{cid}.glb").exists():
            safe_print("  skip existing")
            continue
        if not prefab_name or not animation_name:
            failures.append({"id": cid, "error": "missing prefab or animation bundle"})
            continue
        try:
            result = export_one(cid, prefab_name, animation_name, exact, args, animation_files)
            manifest["models"][str(cid)] = result
            safe_print(f"  ok anims={result.get('animationCount')} size={result.get('size', 0) // 1024}KB")
        except Exception as exc:  # noqa: BLE001
            if animation_name != LEGACY_FALLBACK_ANIMATION and LEGACY_FALLBACK_ANIMATION in animation_files:
                try:
                    result = export_one(cid, prefab_name, LEGACY_FALLBACK_ANIMATION, False, args, animation_files)
                    result["exactAnimation"] = False
                    manifest["models"][str(cid)] = result
                    safe_print(f"  ok anims={result.get('animationCount')} size={result.get('size', 0) // 1024}KB (generic fallback)")
                    continue
                except Exception:
                    pass
            failures.append({"id": cid, "error": f"{type(exc).__name__}: {exc}"})
            safe_print(f"  failed: {type(exc).__name__}: {exc}")
    manifest["missing"] = failures
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    safe_print(f"[done] models={len(manifest['models'])} failures={len(failures)} manifest={manifest_path}")
    if failures:
        print(json.dumps(failures, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
