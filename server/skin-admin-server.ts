// Skin admin backend: receives texture uploads from the skin-admin page and
// pushes them to the R2 bucket, then rebuilds the skin manifest.
//
// Required environment (put in a local .env file next to the repo root - it is
// gitignored - or export before starting):
//   SKIN_ADMIN_PASSWORD   admin page password
//   R2_ACCESS_KEY_ID      Cloudflare R2 key
//   R2_SECRET_ACCESS_KEY  Cloudflare R2 secret
//   R2_BUCKET             optional, default vk-chess-assets
//   R2_ENDPOINT           optional, default the project endpoint
//   SKIN_ADMIN_PORT       optional, default 8788
//
// The password is NEVER stored in the repository. The admin page sends it as
// the x-admin-key header; every request is validated server-side.

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

// Minimal .env loader (KEY=VALUE lines) so the server can run without extra deps.
try {
  const envPath = new URL("../.env", import.meta.url);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
} catch {
  // .env is optional
}

const PORT = Number(process.env.SKIN_ADMIN_PORT ?? 8788);
const PASSWORD = process.env.SKIN_ADMIN_PASSWORD ?? "";
const BUCKET = process.env.R2_BUCKET ?? "vk-chess-assets";
const ENDPOINT = process.env.R2_ENDPOINT ?? "https://03634870e71b8850279e8c2f30379ce0.r2.cloudflarestorage.com";

if (!PASSWORD) {
  console.error("[skin-admin] SKIN_ADMIN_PASSWORD is not set - refusing to start");
  process.exit(1);
}
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error("[skin-admin] R2 credentials missing - refusing to start");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// The admin page is hosted on GitHub Pages / localhost; the API is cross-origin.
const ALLOWED_ORIGINS = new Set([
  "https://pure281.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function cors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-admin-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function authed(req: http.IncomingMessage): boolean {
  return Boolean(PASSWORD) && req.headers["x-admin-key"] === PASSWORD;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage, limit = 12 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).byteLength;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

async function put(key: string, data: Buffer, cacheSeconds = 3600): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: data,
    ContentType: contentTypeFor(key),
    CacheControl: `public, max-age=${cacheSeconds}`,
  }));
}

interface SkinMeta {
  key: string;
  name: string;
  author: string;
  body: string;
  face?: string;
  icon?: string;
}

// Rebuild manifest.json by listing the bucket - no local state needed.
async function rebuildManifest(): Promise<{ units: number; skins: number }> {
  const skins: Record<string, SkinMeta[]> = {};
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "assets/skins/", ContinuationToken: token }));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    for (const obj of page.Contents ?? []) {
      const m = /^assets\/skins\/(\d+)\/([^/]+)\/skin\.json$/.exec(obj.Key ?? "");
      if (!m) continue;
      const [, unitId, skinKey] = m;
      // fetch the skin.json for display metadata
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
      const text = await got.Body?.transformToString();
      let meta: { name?: string; author?: string } = {};
      try { meta = JSON.parse(text ?? "{}"); } catch { /* keep defaults */ }
      const base = `assets/skins/${unitId}/${skinKey}`;
      const entry: SkinMeta = {
        key: skinKey,
        name: meta.name || skinKey,
        author: meta.author || "",
        body: `${base}/body.png`,
      };
      // face/icon presence is verified with dedicated list entries - simplest: probe keys in this page
      (skins[unitId] ??= []).push(entry);
    }
  } while (token);

  // probe face/icon existence per skin with individual list calls would be many
  // requests; instead list each skin folder once.
  for (const [unitId, entries] of Object.entries(skins)) {
    for (const entry of entries) {
      const prefix = `assets/skins/${unitId}/${entry.key}/`;
      const listing = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
      const names = new Set((listing.Contents ?? []).map((o) => (o.Key ?? "").slice(prefix.length)));
      if (names.has("face.png")) entry.face = `${prefix}face.png`;
      if (names.has("icon.png")) entry.icon = `${prefix}icon.png`;
    }
  }

  const manifest = JSON.stringify({ version: 1, skins });
  await put("assets/skins/manifest.json", Buffer.from(manifest, "utf8"), 300);
  return { units: Object.keys(skins).length, skins: Object.values(skins).reduce((a, b) => a + b.length, 0) };
}

const server = http.createServer(async (req, res) => {
  if (cors(req, res)) return;
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/health") {
      send(res, 200, { ok: true });
      return;
    }
    if (!authed(req)) {
      send(res, 401, { ok: false, error: "unauthorized" });
      return;
    }

    if (url.pathname === "/upload" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as {
        unitId?: string;
        skinKey?: string;
        name?: string;
        author?: string;
        bodyPng?: string;
        facePng?: string;
        iconPng?: string;
      };
      const unitId = String(body.unitId ?? "").replace(/[^0-9]/g, "");
      const skinKey = String(body.skinKey ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!unitId || !skinKey || !body.bodyPng) {
        send(res, 400, { ok: false, error: "unitId, skinKey and bodyPng are required" });
        return;
      }
      const base = `assets/skins/${unitId}/${skinKey}`;
      const meta = { name: body.name || skinKey, author: body.author || "" };
      await put(`${base}/body.png`, Buffer.from(body.bodyPng, "base64"));
      if (body.facePng) await put(`${base}/face.png`, Buffer.from(body.facePng, "base64"));
      if (body.iconPng) await put(`${base}/icon.png`, Buffer.from(body.iconPng, "base64"));
      await put(`${base}/skin.json`, Buffer.from(JSON.stringify(meta, null, 2), "utf8"));
      const stats = await rebuildManifest();
      send(res, 200, { ok: true, ...stats });
      return;
    }

    if (url.pathname === "/delete" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as { unitId?: string; skinKey?: string };
      const unitId = String(body.unitId ?? "").replace(/[^0-9]/g, "");
      const skinKey = String(body.skinKey ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!unitId || !skinKey) {
        send(res, 400, { ok: false, error: "unitId and skinKey are required" });
        return;
      }
      const prefix = `assets/skins/${unitId}/${skinKey}/`;
      const listing = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
      const keys = (listing.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((k) => k.Key);
      if (keys.length) {
        await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
      }
      const stats = await rebuildManifest();
      send(res, 200, { ok: true, deleted: keys.length, ...stats });
      return;
    }

    send(res, 404, { ok: false, error: "not found" });
  } catch (err) {
    console.error("[skin-admin] error", err);
    send(res, 500, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[skin-admin] listening on 127.0.0.1:${PORT}`);
});
