/** Central asset location resolution.
 *
 * Game assets (models/images/audio) are large and intentionally excluded from
 * git. They are served from a CDN (Cloudflare R2 public bucket by default).
 * Override with VITE_ASSET_BASE:
 *   - unset/empty  -> default R2 public bucket
 *   - "local"      -> same-origin /assets (offline dev with extracted assets)
 *   - any URL      -> custom CDN mirror
 */
export const DEFAULT_ASSET_BASE = "https://pub-1dfe6bb1f974425580d2845f59875408.r2.dev";

export function assetBase(): string | null {
  const raw = ((import.meta.env.VITE_ASSET_BASE as string | undefined) ?? "").trim();
  if (raw.toLowerCase() === "local") return null;
  const base = (raw || DEFAULT_ASSET_BASE).replace(/\/+$/, "");
  return base || null;
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("assets/")) {
    const base = assetBase();
    if (base) return `${base}/${path}`;
  }
  return `${import.meta.env.BASE_URL}${path}`;
}
