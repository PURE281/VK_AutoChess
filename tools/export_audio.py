"""Extract curated Valkyrie Connect audio bundles to web-ready MP3 files."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RES = Path(r"C:\Users\pure81\AppData\LocalLow\Ateam\Valkyrie Connect WW\res")
AS_CLI = ROOT / ".tools" / "assetstudio" / "cli" / "AssetStudioModCLI.exe"
FFMPEG = shutil.which("ffmpeg") or r"C:\Softwares\ffmpeg\bin\ffmpeg.exe"
OUT = ROOT / "public" / "assets" / "audio"
WORK = ROOT / ".cache" / "audio_export"
UNITY_VERSION = "6000.0.68f1"

SOUNDS = {
    "bgm_home": "additional_sounds_home_loop.unity3d",
    "bgm_map": "additional_sounds_map_loop.unity3d",
    "bgm_battle": "additional_sounds_battle_loop1.unity3d",
    "bgm_battle_pvp": "additional_sounds_arena_loop.unity3d",
    "battle_start": "additional_sounds_s_battle_start.unity3d",
    "attack": "additional_sounds_s_knife.unity3d",
    "damage": "additional_sounds_s_battle_damage.unity3d",
    "critical": "additional_sounds_s_battle_damage_critical.unity3d",
    "heal": "additional_sounds_s_heal.unity3d",
    "death": "additional_sounds_s_battle_dead.unity3d",
    "skill": "additional_sounds_s_battle_burst.unity3d",
    "burst": "additional_sounds_s_battle_burst_max.unity3d",
    "win": "additional_sounds_s_battle_win.unity3d",
    "lose": "additional_sounds_s_battle_lose.unity3d",
    "buy": "additional_sounds_s_new_character_appeal.unity3d",
    "item": "additional_sounds_s_itemget.unity3d",
    "reward": "additional_sounds_s_battle_result_get.unity3d",
    "levelup": "additional_sounds_s_levelup_p.unity3d",
    "combine": "additional_sounds_s_levelup_c.unity3d",
    "click": "additional_sounds_flappy_game_button.unity3d",
    "error": "additional_sounds_s_incorrect.unity3d",
    "quest_clear": "additional_sounds_quest_clear.unity3d",
    "treasure": "additional_sounds_s_treasure_open.unity3d",
}


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise RuntimeError(result.stdout[-1600:])


def export_one(key: str, bundle: str, force: bool) -> dict:
    out = OUT / f"{key}.mp3"
    if out.exists() and not force:
        return {"file": f"assets/audio/{key}.mp3", "bundle": bundle, "size": out.stat().st_size, "cached": True}
    src = RES / bundle
    if not src.exists():
        raise FileNotFoundError(src)
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True, exist_ok=True)
    run([str(AS_CLI), str(src), "-m", "export", "-t", "audio", "--unity-version", UNITY_VERSION, "-o", str(WORK)])
    wavs = list(WORK.rglob("*.wav"))
    if not wavs:
        raise RuntimeError(f"no wav exported from {bundle}")
    OUT.mkdir(parents=True, exist_ok=True)
    run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wavs[0]), "-codec:a", "libmp3lame", "-q:a", "4", str(out)])
    return {"file": f"assets/audio/{key}.mp3", "bundle": bundle, "size": out.stat().st_size}


def main() -> None:
    force = "--force" in os.sys.argv
    manifest = {"version": 1, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "sounds": {}, "missing": []}
    for key, bundle in SOUNDS.items():
        try:
            manifest["sounds"][key] = export_one(key, bundle, force)
            print(f"ok {key} {manifest['sounds'][key]['size'] // 1024}KB")
        except Exception as exc:
            manifest["missing"].append({"key": key, "bundle": bundle, "error": str(exc)})
            print(f"fail {key}: {exc}")
    (ROOT / "public" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "data" / "audio.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.rmtree(WORK, ignore_errors=True)
    print(f"done sounds={len(manifest['sounds'])} missing={len(manifest['missing'])}")


if __name__ == "__main__":
    main()
