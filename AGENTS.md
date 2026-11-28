# Project Notes

## Commands

- Install: `npm install`
- Dev servers: `npm run dev` starts both Vite (`http://127.0.0.1:5173/`) and the LAN PVP WebSocket server (`ws://<host-ip>:8787`)
- Typecheck: `npx tsc --noEmit`
- Production build: `npm run build`
- Engine smoke tests: regenerate `.verify/engine-test.mjs` with esbuild after changing `.verify/engine-test.ts`, then run `node .verify/engine-test.mjs pve` and `node .verify/engine-test.mjs trial`
- Browser 3D smoke test: `node .verify/check3d-animations.mjs` (requires dev server)
- Broader browser 3D stress test: `node .verify/stress3d.mjs` (requires dev server)

## Data Extraction

- `tools/extract_autochess_data.py` regenerates `public/data/roster.json` and image assets from the local Valkyrie Connect resource cache.
- `tools/export_3d_models.py` converts season-one character prefabs to GLB files in `public/assets/models/` and writes `public/data/models.json`.
- The 3D pipeline uses `.tools/assetstudio/cli/AssetStudioModCLI.exe` and `.tools/fbx2gltf/FBX2glTF.exe`.
- Launch-era characters often use codename animation archives rather than numeric archives. These explicit mappings live in `SPECIAL_ANIMATIONS` in `tools/export_3d_models.py`.
- Do not re-add loose numeric-prefix matching for animation archives: extra digits can represent costume/variant heroes rather than the base character.

## 3D Implementation Notes

- The active board renderer is `src/components/BoardCanvas3D.tsx`; `BoardCanvas.tsx` is the retained 2D fallback implementation.
- GLBs use the original game scale. Do not normalize model scale from skinned-mesh bounding boxes: bind-space vertices make those boxes unreliable. `BoardCanvas3D` intentionally uses a fixed scale so giants and small characters keep correct relative sizes.
- Animation clips are grouped into logical actions (`idle`, `run`, `attack`, `skill`, `damage`, `down`, `win`) with explicit preference for `@attack` and `@skill` over autos/bursts.
- In development, `window.__board3dDebug` exposes loaded models/current clips for browser validation.

## Verification Expectations

- Balance regression: regenerate `.verify/balance-test.mjs` / `.verify/pvp-balance-test.mjs` with esbuild after changing their `.ts` sources. `node .verify/balance-test.mjs` validates streak gold, item/augment tier weighting, and local loss-streak reward chaining; `node .verify/pvp-balance-test.mjs` spawns an isolated short-countdown PVP server and validates online catch-up rewards over three consecutive losses.
- Catch-up balance rules are centralized in `src/game/balance.ts`: win and loss streak gold are separate, loss streaks increase item/augment tier weights, 2+ losses guarantee advanced item options, and 2+ losses can unlock higher augment tiers early.

- Online reward rule: every non-gameover PVP combat gives both players a mandatory artifact choice, including losses and draws. On augment rounds the artifact modal comes first and the augment modal follows immediately; the server auto-picks pending rewards at planning timeout so reward phases cannot be overwritten or deadlock the room.

Before considering gameplay or rendering changes complete:

1. `npx tsc --noEmit` passes.
2. `npm run build` passes.
3. `node .verify/engine-test.mjs pve` and `node .verify/engine-test.mjs trial` reach `gameover` and cycle planning/combat/item/augment phases.
4. With the dev server running, `node .verify/check3d-animations.mjs` reports `modelReady: true`, nonzero clips, and no browser errors.
- Combat facing is driven by the precomputed attack/skill target timeline in `BoardCanvas3D`; do not revert to fixed side-only facing. Models use local +Z as their forward axis (confirmed by `faceEmitter` nodes).
- Audio extraction: `python tools/export_audio.py` rebuilds curated original BGM/SFX into `public/assets/audio/*.mp3` and writes `public/data/audio.json`; ffmpeg is expected at `C:\Softwares\ffmpeg\bin\ffmpeg.exe` or on PATH.
- Modes: `pve` is the local 8-player autochess match against 7 bots; `trial` is the solo 20-round World Tree gauntlet; `pvp` inside a running online match means real-player LAN对决.
- Online PVP is implemented by `server/pvp-server.ts` plus `src/components/OnlineScreen.tsx`. It is a LAN-first 1v1 room flow with synchronized shops, bench/board actions, shared season card pool, items, augments, direct mirrored combat, elimination, skip votes, and name-based reconnection. Static hosting alone is insufficient; the WebSocket server must run.
- Online verification: `node .verify/pvp-server-test.mjs` validates one combat round; `node .verify/pvp-fullflow-test.mjs` validates six rounds including items/augments/shared pool; `node .verify/pvp-reconnect-test.mjs` validates reconnect; `node .verify/pvp-browser-test.mjs` validates two browser clients end-to-end; `node .verify/pvp-rewardchain-test.mjs` validates guaranteed item rewards and the round-3 item-to-augment chain; `node .verify/pvp-audio-item-test.mjs` validates playback stability across speed/skip broadcasts plus visible item modals. `PVP_PLANNING_MS` can shorten the planning timeout for reward-timeout tests.


## Character Archive / Distance Types

- `roster.json` currently contains 985 character records, 979+ icons, and 982 standing arts. The default balanced season pool is still 92; the lobby also exposes an experimental `chaos` full-archive mode.
- Valkyrie Connect character `type` is a distance type: 1=近战, 2=中程, 3=远程. Do not overwrite `Champion.range` with autochess role-derived ranges.
- Current GLB coverage is 984/985 characters after batch conversion and special animation remapping. `206017` is the remaining character without a complete prefab/animation bundle. Full-archive units use GLBs when available and portrait rendering only as a fallback.
- Character voices are extracted from the fully updated MuMu Android emulator cache, not the PC cache. Current voice coverage is 937 characters / 5605 MP3 files under `public/assets/audio/voices/`; see `tools/export_voices.py`. Nine locally available action-skill performance sounds are exported under `public/assets/audio/skills/` and manifest `public/data/skill-audio.json`.
- Original arena backdrop: `public/assets/scenes/arena-bg.png`, extracted from `additional_images_backgrounds_arena_bg.unity3d`.


## Voice Extraction

- PC client cache does not include optional character voice bundles. Use the fully updated MuMu Android emulator cache through adb (`jp.co.atm.vcon.ww`).
- Voice extraction command: `python tools/export_voices.py` (uses `127.0.0.1:16416` by default, pulls only join/hit/skill/win clips, and writes `public/data/voices.json` plus `public/assets/audio/voices/`).
- Current voice coverage: 937 characters, 5605 MP3 files. Characters without voice data are mostly NPC/collab units that do not ship standard voice lines.


## Mobile / tablet layout notes

- Immersive battlefield layout: `App.tsx` and `OnlineScreen.tsx` use `useImmersiveDrawers` plus `.battle-shell` edge drawers. Planning opens resource/shop drawers; combat hides all drawers except the floating combat-output panel. Keep drawer interactions overlay-based and do not reintroduce fixed side columns.
- At widths up to 1180px the game uses a single-column layout: board/shop first, sidebars after. Do not allow sidebar elements to overlap the shop.
- The 3D board container must remain fixed-height in the single-column layout. The canvas is absolutely positioned and `BoardCanvas3D` rounds/guards resize dimensions to prevent ResizeObserver layout feedback loops.
- Long-pressing shop, bench, or deployed board units opens `ChampionInfoModal`; ordinary clicks still buy/select/deploy.
## Runtime Resource Loading

- The Three.js battlefield is lazy-loaded after entering a match; do not reintroduce a static top-level import of `BoardCanvas3D` in shell screens.
- Production registers `public/sw.js`, which cache-first stores immutable runtime assets with bounded model cache capacity and stale-while-revalidate data JSON. Bump the cache version when asset naming/semantics change.
- Codex grid icons intentionally use native lazy loading to avoid hundreds of simultaneous image requests.
## Loading Progress UI

- Initial roster download uses streaming fetch in `loadGameData(onProgress)`; `LoadingScreen` shows percent, bytes and ETA. The static boot splash in `index.html` covers the JS bundle download before React mounts.
- GLB downloads are tracked by `src/hooks/useModelLoadProgress.ts` (`modelLoadTracker`); `BoardCanvas3D` reports begin/progress/end and renders the `.model-load-badge` overlay. When extending asset loading, reuse the tracker rather than adding parallel indicators.
## Git Workflow

- The project is version controlled at `https://github.com/PURE281/VK_AutoChess.git` (branch `main`). Commit completed work with the standard Devin commit format and push when the user asks.
- `public/assets/`, `.cache/`, `.tools/`, `node_modules/`, `dist/` and verification artifacts are intentionally untracked; do not force-add them. `.verify` keeps only `*.ts`/`*.mjs` test sources.

## Custom Skins

- Player-made texture skins live in `public/assets/skins/<unitId>/<key>/` (body.png required, face.png/icon.png optional, skin.json metadata).
- `python tools/extract_skin_template.py <unitId> [name]` extracts editable texture templates from a GLB; `python tools/build_custom_skins.py` regenerates `public/data/custom-skins.json` after editing.
- Skin creation guide for users: `public/assets/skins/README.md`.
