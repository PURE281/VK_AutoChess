#!/usr/bin/env python3
"""Upload public/assets to Cloudflare R2 (bucket vk-chess-assets).

Credentials are read from the environment or from .env.local in the project
root (never commit that file):

    R2_ACCESS_KEY_ID=...
    R2_SECRET_ACCESS_KEY=...

Usage: python tools/upload_r2.py [--dry-run] [--workers N]
"""
import os
import sys
import mimetypes
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
BUCKET = "vk-chess-assets"
ENDPOINT = "https://03634870e71b8850279e8c2f30379ce0.r2.cloudflarestorage.com"
CACHE_CONTROL = "public, max-age=31536000, immutable"

EXTRA_TYPES = {
    ".glb": "model/gltf-binary",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".json": "application/json",
}


def load_credentials():
    env_file = os.path.join(ROOT, ".env.local")
    if os.path.exists(env_file):
        with open(env_file, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())
    key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    if not key or not secret:
        print("缺少 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY（环境变量或 .env.local）")
        sys.exit(1)
    return key, secret


def content_type(path):
    ext = os.path.splitext(path)[1].lower()
    return EXTRA_TYPES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"


def main():
    dry_run = "--dry-run" in sys.argv
    workers = 16
    for i, arg in enumerate(sys.argv):
        if arg == "--workers" and i + 1 < len(sys.argv):
            workers = int(sys.argv[i + 1])
    key, secret = load_credentials()

    import boto3
    from botocore.config import Config
    session = boto3.session.Session()
    client = session.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 5, "mode": "standard"},
            # Optional proxy via R2_PROXY env (e.g. http://127.0.0.1:7890) can
            # significantly speed up Cloudflare access on some networks.
            proxies=({"http": os.environ.get("R2_PROXY", ""), "https": os.environ.get("R2_PROXY", "")} if os.environ.get("R2_PROXY", "") else {}),
        ),
    )

    files = []
    for base, _dirs, names in os.walk(ASSETS):
        for name in names:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, ASSETS).replace(os.sep, "/")
            files.append((full, "assets/" + rel))
    files.sort()
    total = len(files)
    total_bytes = sum(os.path.getsize(f) for f, _k in files)
    print("共 %d 个文件，%.1f MB" % (total, total_bytes / 1048576))
    if dry_run:
        for _f, k in files[:5]:
            print("示例 key:", k)
        return

    lock = threading.Lock()
    state = {"done": 0, "skipped": 0, "uploaded": 0, "failed": 0, "bytes": 0}

    def upload_one(item):
        full, key_name = item
        size = os.path.getsize(full)
        try:
            try:
                head = client.head_object(Bucket=BUCKET, Key=key_name)
                if head.get("ContentLength") == size:
                    return ("skipped", size, key_name)
            except Exception:
                pass
            with open(full, "rb") as fh:
                client.put_object(
                    Bucket=BUCKET,
                    Key=key_name,
                    Body=fh,
                    ContentType=content_type(full),
                    CacheControl=CACHE_CONTROL,
                )
            return ("uploaded", size, key_name)
        except Exception as exc:  # noqa: BLE001 - batch uploader reports and continues
            return ("failed", size, "%s -> %s" % (key_name, exc))

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(upload_one, item) for item in files]
        for future in as_completed(futures):
            status, size, info = future.result()
            with lock:
                state["done"] += 1
                state[status] += 1
                if status != "failed":
                    state["bytes"] += size
                done = state["done"]
                if done % 100 == 0 or done == total or status == "failed":
                    print(
                        "[%d/%d] 上传 %d 跳过 %d 失败 %d · %.1fMB"
                        % (done, total, state["uploaded"], state["skipped"], state["failed"], state["bytes"] / 1048576)
                    )
                if status == "failed":
                    print("  失败:", info)

    print("完成：上传 %(uploaded)d，跳过 %(skipped)d，失败 %(failed)d" % state)
    sys.exit(1 if state["failed"] else 0)


if __name__ == "__main__":
    main()
