"""Extract character voice lines from the Android Valkyrie Connect cache."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tarfile
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADB = Path(r"C:\Program Files\Netease\MuMuPlayer-12.0\shell\adb.exe")
DEVICE = "127.0.0.1:16416"
REMOTE_BASE = "/sdcard/Android/data/jp.co.atm.vcon.ww"
REMOTE_RES = f"{REMOTE_BASE}/files/res"
AS_CLI = ROOT / ".tools" / "assetstudio" / "cli" / "AssetStudioModCLI.exe"
FFMPEG = shutil.which("ffmpeg") or r"C:\Softwares\ffmpeg\bin\ffmpeg.exe"
WORK = ROOT / ".cache" / "voice_export"
OUT = ROOT / "public" / "assets" / "audio" / "voices"
UNITY_VERSION = "6000.0.68f1"
CLIPS = ["join", "hit_1", "hit_2", "skill_1", "skill_2", "win"]


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    if check and result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(cmd)}\n{result.stdout[-1800:]}")
    return result


def adb(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run([str(ADB), "-s", DEVICE, *args], check=check)


def voice_listing(refresh: bool) -> list[str]:
    cache = ROOT / ".verify" / "android-voices-list.txt"
    if cache.exists() and not refresh:
        text = cache.read_text(encoding="utf-8", errors="replace")
    else:
        result = adb("shell", f"cd {REMOTE_RES} && ls additional_voices_*")
        text = result.stdout
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8")
    return sorted(set(re.findall(r"additional_voices_\d+_[^\s]+\.unity3d", text)))


def selected_voice_files() -> tuple[list[str], dict[int, dict[str, str]], list[int]]:
    roster = json.loads((ROOT / "public" / "data" / "roster.json").read_text(encoding="utf-8"))
    roster_ids = sorted(int(c["id"]) for c in roster["characters"])
    available = set(voice_listing(refresh=False))
    wanted: list[str] = []
    mapping: dict[int, dict[str, str]] = {}
    for cid in roster_ids:
        entry: dict[str, str] = {}
        for clip in CLIPS:
            bundle = f"additional_voices_{cid}_{clip}.unity3d"
            if bundle in available:
                wanted.append(bundle)
                entry[clip] = bundle
        if entry:
            mapping[cid] = entry
    missing = [cid for cid in roster_ids if cid not in mapping]
    return wanted, mapping, missing


def pull_selected(wanted: list[str], force_pull: bool) -> Path:
    archive = WORK / "voices-selected.tar"
    if archive.exists() and not force_pull:
        print(f"using existing archive {archive} ({archive.stat().st_size // 1024 // 1024}MB)", flush=True)
        return archive
    WORK.mkdir(parents=True, exist_ok=True)
    list_local = WORK / "voices-selected.txt"
    list_local.write_bytes(("\n".join(wanted) + "\n").encode("ascii"))
    remote_list = f"{REMOTE_BASE}/voices-selected.txt"
    remote_tar = f"{REMOTE_BASE}/voices-selected.tar"
    adb("push", str(list_local), remote_list)
    print(f"creating android tar with {len(wanted)} voice bundles...", flush=True)
    adb("shell", f"cd {REMOTE_RES} && tar -cf {remote_tar} -T {remote_list}")
    print("pulling voice archive...", flush=True)
    adb("pull", remote_tar, str(archive))
    adb("shell", f"rm -f {remote_tar} {remote_list}", check=False)
    print(f"pulled {archive} ({archive.stat().st_size // 1024 // 1024}MB)", flush=True)
    return archive


def extract_archive(archive: Path) -> Path:
    bundle_dir = WORK / "bundles"
    if bundle_dir.exists() and any(bundle_dir.iterdir()):
        return bundle_dir
    shutil.rmtree(bundle_dir, ignore_errors=True)
    bundle_dir.mkdir(parents=True, exist_ok=True)
    print("extracting tar locally...", flush=True)
    with tarfile.open(archive) as tar:
        tar.extractall(bundle_dir)
    return bundle_dir


def export_wavs(bundle_dir: Path) -> list[Path]:
    wav_root = WORK / "wav"
    existing = list(wav_root.rglob("*.wav")) if wav_root.exists() else []
    if existing:
        return existing
    shutil.rmtree(wav_root, ignore_errors=True)
    print("decoding unity voice bundles...", flush=True)
    run([str(AS_CLI), str(bundle_dir), "-m", "export", "-t", "audio", "--unity-version", UNITY_VERSION, "-o", str(wav_root)])
    wavs = list(wav_root.rglob("*.wav"))
    if not wavs:
        raise RuntimeError("AssetStudio exported no voice wav files")
    return wavs


def convert_one(job: tuple[str, str]) -> tuple[str, bool, str]:
    src, dst = job
    try:
        if not os.path.exists(dst) or os.path.getsize(dst) == 0:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            result = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", src, "-codec:a", "libmp3lame", "-q:a", "5", dst], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
            if result.returncode != 0:
                return src, False, result.stdout[-500:]
        return src, True, ""
    except Exception as exc:  # noqa: BLE001
        return src, False, str(exc)


def convert_mp3s(wavs: list[Path], workers: int) -> dict[str, Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs: list[tuple[str, str]] = []
    outputs: dict[str, Path] = {}
    for wav in wavs:
        match = re.match(r"(\d+)_(join|hit_1|hit_2|skill_1|skill_2|win)\.wav$", wav.name)
        if not match:
            continue
        key = f"{match.group(1)}_{match.group(2)}"
        out = OUT / f"{key}.mp3"
        outputs[key] = out
        jobs.append((str(wav), str(out)))
    print(f"converting {len(jobs)} voice wavs to mp3...", flush=True)
    failures = []
    done = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(convert_one, job) for job in jobs]
        for future in as_completed(futures):
            src, ok, error = future.result()
            done += 1
            if not ok:
                failures.append({"src": src, "error": error})
            if done % 250 == 0:
                print(f"  converted {done}/{len(jobs)}", flush=True)
    if failures:
        raise RuntimeError(f"ffmpeg conversion failures: {len(failures)} first={failures[0]}")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh-list", action="store_true")
    parser.add_argument("--force-pull", action="store_true")
    parser.add_argument("--workers", type=int, default=max(4, min(10, (os.cpu_count() or 8) // 2)))
    args = parser.parse_args()

    if args.refresh_list:
        voice_listing(refresh=True)
    wanted, bundle_mapping, missing_characters = selected_voice_files()
    print(f"selected {len(wanted)} bundles for {len(bundle_mapping)} characters; no voice data for {len(missing_characters)}", flush=True)
    archive = pull_selected(wanted, args.force_pull)
    bundle_dir = extract_archive(archive)
    wavs = export_wavs(bundle_dir)
    outputs = convert_mp3s(wavs, args.workers)

    manifest = {
        "version": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "clips": CLIPS,
        "voices": {},
        "missingCharacters": missing_characters,
        "missingFiles": [],
    }
    for cid, clips in bundle_mapping.items():
        voice_entry: dict[str, str] = {}
        for clip in clips:
            key = f"{cid}_{clip}"
            out = outputs.get(key)
            if out and out.exists() and out.stat().st_size > 0:
                voice_entry[clip] = f"assets/audio/voices/{key}.mp3"
            else:
                manifest["missingFiles"].append({"character": cid, "clip": clip})
        if voice_entry:
            manifest["voices"][str(cid)] = voice_entry
    (ROOT / "public" / "data" / "voices.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done voices={len(manifest['voices'])} files={sum(len(v) for v in manifest['voices'].values())} missingFiles={len(manifest['missingFiles'])}", flush=True)


if __name__ == "__main__":
    main()
