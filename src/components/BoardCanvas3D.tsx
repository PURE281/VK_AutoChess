import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { formatBytes, modelLoadTracker, useModelLoadProgress } from "../hooks/useModelLoadProgress";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Champion, CombatResult, CombatUnitSnapshot, GameState, LocationRef } from "../types";
import type { DataStore } from "../data";
import { assetUrl } from "../data";
import { deployLimit } from "../game/roster";
import { customSkinDef, getSkin, onSkinChange, parseCustomSkinKey, type CustomSkinDef } from "../skins";
import { sound } from "../sound";

interface Props {
  store: DataStore;
  state: GameState;
  selected: LocationRef | null;
  onLocationClick: (loc: LocationRef | null) => void;
  onCombatEnd: () => void;
  onInspect: (championId: number, popup?: boolean) => void;
}

type UnitVisual = {
  key: string;
  group: THREE.Group;
  bars: THREE.Group;
  hpBar: THREE.Sprite;
  shieldBar: THREE.Sprite;
  manaBar: THREE.Sprite;
  starMeshes: THREE.Sprite[];
  barHeight: number;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  current?: THREE.AnimationAction;
  championId: number;
  side: "player" | "enemy";
  x: number;
  z: number;
  dead: boolean;
  casting: boolean;
  lastEventT: number;
  targetId?: number;
  faceX?: number;
  faceZ?: number;
  initializedPosition?: boolean;
  snapFacing?: boolean;
  modelReady: boolean;
  celebrateUntil?: number;
  skinId?: number | string;
  portrait?: THREE.Object3D;
  modelRoot?: THREE.Object3D;
};

function interpUnits(result: CombatResult, time: number): CombatUnitSnapshot[] {
  const frames = result.frames;
  if (!frames.length) return [];
  if (time <= 0) return frames[0].units;
  const last = frames[frames.length - 1];
  if (time >= last.t) return last.units;
  let index = Math.max(0, Math.floor(time / 0.2));
  while (index < frames.length - 1 && frames[index + 1].t < time) index += 1;
  while (index > 0 && frames[index].t > time) index -= 1;
  const a = frames[index];
  const b = frames[Math.min(frames.length - 1, index + 1)];
  const alpha = Math.max(0, Math.min(1, (time - a.t) / Math.max(0.001, b.t - a.t)));
  const before = new Map(a.units.map((u) => [u.id, u]));
  return b.units.map((end) => {
    const start = before.get(end.id) ?? end;
    return {
      ...end,
      x: start.x + (end.x - start.x) * alpha,
      y: start.y + (end.y - start.y) * alpha,
      hp: start.hp + (end.hp - start.hp) * alpha,
      mana: start.mana + (end.mana - start.mana) * alpha,
      shield: start.shield + (end.shield - start.shield) * alpha,
      alive: alpha < 0.5 ? start.alive : end.alive,
      casting: start.casting || end.casting,
    };
  });
}

function makeBar(width: number, height: number, color: number, x: number, y: number, z: number) {
  // Sprites stay camera-aligned even while units rotate to face their combat
  // target. Plane meshes become edge-on/invisible at some orbit angles.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, transparent: true }));
  sprite.scale.set(width, height, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 30;
  sprite.userData.width = width;
  return sprite;
}



function mvpChampionId(result: CombatResult, side: "player" | "enemy"): number | undefined {
  let bestId: number | undefined;
  let bestDamage = 0;
  for (const [idText, damage] of Object.entries(result.damageDealt ?? {})) {
    const id = Number(idText);
    const label = result.unitLabels[id];
    if (label?.side === side && damage > bestDamage) {
      bestDamage = damage;
      bestId = label.championId;
    }
  }
  return bestId;
}

function clipPriority(key: string, name: string): number {
  const n = name.toLowerCase();
  if (key === "attack") return n.endsWith("@attack") ? 4 : n.includes("auto1") ? 3 : n.includes("auto2") ? 2 : 1;
  if (key === "skill") return n.endsWith("@skill") ? 4 : n.includes("burst") ? 2 : 1;
  if (key === "win") return n.endsWith("@win") ? 4 : n.includes("win_loop") ? 3 : 1;
  return 1;
}


function dampAngle(current: number, target: number, sharpness: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-sharpness * dt));
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj: any) => {
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
    else obj.material?.dispose?.();
  });
}

function clipKey(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("wait")) return "idle";
  if (n.includes("run_loop")) return "run";
  if (n.includes("skill") || n.includes("burst")) return "skill";
  if (n.includes("attack") || n.includes("auto1")) return "attack";
  if (n.includes("damage")) return "damage";
  if (n.includes("down")) return "down";
  if (n.includes("win")) return "win";
  return "misc";
}

export default function BoardCanvas3D({ store, state, selected, onLocationClick, onCombatEnd, onInspect }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const selectedRef = useRef(selected);
  const locationClickRef = useRef(onLocationClick);
  const inspectRef = useRef(onInspect);
  const [playback, setPlayback] = useState(0);
  const modelProgress = useModelLoadProgress();
  const playbackRef = useRef(0);
  const cameraResetRef = useRef<() => void>(() => {});
  const finishedRef = useRef(false);
  const soundTimeRef = useRef(0);
  const combatEndRef = useRef(onCombatEnd);
  const previousBoardStarsRef = useRef(new Map<number, number>());
  stateRef.current = state;
  selectedRef.current = selected;
  locationClickRef.current = onLocationClick;
  inspectRef.current = onInspect;
  combatEndRef.current = onCombatEnd;

  const threeRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    tiles: THREE.Mesh[];
    tileMap: Map<string, THREE.Mesh>;
    units: Map<string, UnitVisual>;
    effects: THREE.Group;
    loader: GLTFLoader;
    modelCache: Map<number, Promise<any | null>>;
    textureLoader: THREE.TextureLoader;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    frame: number;
  }>({ tiles: [], tileMap: new Map(), units: new Map(), effects: new THREE.Group(), loader: new GLTFLoader(), modelCache: new Map(), textureLoader: new THREE.TextureLoader(), raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), frame: 0 });

  const combatKey = state.phase === "combat" && state.combat
    ? `${state.combat.round}:${state.combat.opponentId}:${state.combat.startedAt}:${state.combat.result.duration}:${state.combat.result.frames.length}`
    : "idle";

  // Combat playback clock.
  useEffect(() => {
    finishedRef.current = false;
    playbackRef.current = 0;
    soundTimeRef.current = -0.001;
    setPlayback(0);
    if (stateRef.current.phase !== "combat" || !stateRef.current.combat) return;
    sound.preloadCombat(stateRef.current.combat.result.unitLabels);
    let raf = 0;
    let finishTimer = 0;
    let last = performance.now();
    const step = (now: number) => {
      const combat = stateRef.current.combat;
      if (!combat) return;
      const dt = ((now - last) / 1000) * stateRef.current.combatSpeed;
      last = now;
      const next = Math.min(combat.result.duration + 1.55, playbackRef.current + dt);
      playbackRef.current = next;
      setPlayback(next);
      const audible = combat.result.events
        .filter((event) => event.t > soundTimeRef.current && event.t <= next && ["attack", "skill", "death"].includes(event.type))
        .slice(0, 5);
      for (const event of audible) {
        if (event.type === "attack") sound.combatAttack();
        else if (event.type === "skill") sound.skillFor(combat.result.unitLabels[event.source ?? -1]?.championId, true);
        else {
          sound.combatDeath();
          sound.combatDeathVoice(combat.result.unitLabels[event.target ?? -1]?.championId);
        }
      }
      soundTimeRef.current = Math.max(soundTimeRef.current, next);
      if (next >= combat.result.duration + 1.25 && !finishedRef.current) {
        finishedRef.current = true;
        // Combat event audio belongs to the replay timeline. Stop it at the
        // result boundary; victory/jingle/MVP voice are post-combat audio and
        // may continue briefly into the reward/planning transition.
        sound.endCombat();
        if (combat.result.winner === "player") sound.victory();
        else if (combat.result.winner === "enemy") sound.defeat();
        if (combat.result.winner === "player" || combat.result.winner === "enemy") {
          sound.winVoice(mvpChampionId(combat.result, combat.result.winner));
        }
        finishTimer = window.setTimeout(() => combatEndRef.current(), 120);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (finishTimer) window.clearTimeout(finishTimer);
      sound.endCombat();
    };
  }, [combatKey]);

  const loadModel = useCallback((championId: number, customSkin?: CustomSkinDef | null) => {
    const t = threeRef.current;
    const cacheKey: any = customSkin ? `cs:${championId}:${customSkin.key}` : championId;
    let promise = t.modelCache.get(cacheKey);
    if (!promise) {
      modelLoadTracker.begin(championId);
      promise = new Promise((resolve) => {
        t.loader.load(
          assetUrl(`assets/models/${championId}.glb`),
          (gltf) => {
            modelLoadTracker.end(championId);
            if (customSkin) {
              const bodyTex = t.textureLoader.load(assetUrl(customSkin.body));
              const faceTex = customSkin.face ? t.textureLoader.load(assetUrl(customSkin.face)) : null;
              for (const tex of [bodyTex, faceTex]) {
                if (!tex) continue;
                tex.flipY = false;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
              }
              gltf.scene.traverse((obj: any) => {
                if (!(obj.isMesh || obj.isSkinnedMesh) || !obj.material) return;
                if (obj.material.name === "body_m" && bodyTex) {
                  obj.material = obj.material.clone();
                  obj.material.map = bodyTex;
                } else if (obj.material.name === "face_m" && faceTex) {
                  obj.material = obj.material.clone();
                  obj.material.map = faceTex;
                }
              });
            }
            resolve(gltf);
          },
          (event) => modelLoadTracker.progress(championId, event.loaded, event.total),
          () => {
            modelLoadTracker.end(championId);
            resolve(null);
          },
        );
      });
      t.modelCache.set(cacheKey, promise);
    }
    return promise;
  }, []);

  const play = useCallback((visual: UnitVisual, key: string, once = false, fade = 0.16) => {
    const action = visual.actions?.[key] ?? visual.actions?.idle ?? visual.actions?.misc;
    if (!action || visual.current === action) return;
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    if (visual.current) {
      visual.current.fadeOut(fade);
      action.fadeIn(fade);
    }
    action.play();
    visual.current = action;
  }, []);

  const attachModel = useCallback((visual: UnitVisual, champion: Champion | undefined) => {
    if (!champion) return;
    const t = threeRef.current;
    // Cosmetic skins only swap the GLB; the portrait card keeps the unit's own
    // icon so bench/shop identity stays readable.
    const skinChoice = getSkin(store.costumes, champion.id);
    const parsedCustom = parseCustomSkinKey(skinChoice);
    const activeCustom = parsedCustom && parsedCustom.unitId === champion.id ? customSkinDef(store.customSkins, skinChoice) : null;
    const modelId = typeof skinChoice === "number" ? skinChoice : champion.id;
    visual.skinId = skinChoice;
    // Portrait fallback is visible immediately and remains as a small aura card if the GLB is absent.
    const texture = t.textureLoader.load(assetUrl(champion.assets.icon));
    texture.colorSpace = THREE.SRGBColorSpace;
    const portrait = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.72),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    portrait.position.y = 0.58;
    portrait.rotation.x = -0.18;
    visual.group.add(portrait);
    visual.portrait = portrait;

    void loadModel(modelId, activeCustom).then((gltf) => {
      if (!gltf || !visual.group.parent) return;
      visual.group.remove(portrait);
      if (visual.portrait === portrait) visual.portrait = undefined;
      const model = cloneSkinned(gltf.scene);
      // The source game uses one consistent world-unit scale across its humanoid rigs.
      // Bounding boxes of exported skinned meshes are unreliable because several rigs
      // store vertices in bind space rather than posed model space; normalizing from
      // those boxes makes some heroes tiny and some bosses too small. A fixed scale
      // preserves the original relative body sizes (giants are genuinely larger).
      const scale = 72;
      model.scale.setScalar(scale);
      model.position.set(0, 0, 0);
      model.updateMatrixWorld(true);
      let headY = 0;
      const emitterPos = new THREE.Vector3();
      model.traverse((obj: any) => {
        if (obj.name === "headEmitter") {
          obj.getWorldPosition(emitterPos);
          headY = Math.max(headY, emitterPos.y);
        }
      });
      if (headY > 0.05) visual.barHeight = Math.max(1.02, Math.min(2.25, headY + 0.24));
      // Some prefabs ship disabled costume-variant shells that share the "body"
      // node name. The conversion exports every mesh, so the variant shell ends up
      // overlapping the real head with garbage UVs (visible as texture patchwork
      // on the face). Keep the highest-vertex "body" mesh and hide the rest.
      const bodyMeshes: any[] = [];
      model.traverse((obj: any) => {
        if ((obj.isMesh || obj.isSkinnedMesh) && obj.material?.name !== "face_m" && (obj.name === "body" || obj.parent?.name === "body")) {
          bodyMeshes.push(obj);
        }
      });
      if (bodyMeshes.length > 1) {
        const vertCount = (m: any) => m.geometry?.attributes?.position?.count ?? 0;
        // Multi-primitive bodies split into several child meshes that belong together;
        // only hide a mesh when it is tiny compared to the largest same-name mesh.
        const maxVerts = Math.max(...bodyMeshes.map(vertCount));
        for (const m of bodyMeshes) {
          if (vertCount(m) < maxVerts * 0.2) m.visible = false;
        }
      }
      model.traverse((obj: any) => {
        if (obj.isMesh || obj.isSkinnedMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.frustumCulled = false;
        }
      });
      visual.group.add(model);
      visual.modelRoot = model;
      visual.mixer = new THREE.AnimationMixer(model);
      const actions: Record<string, THREE.AnimationAction> = {};
      const priorities: Record<string, number> = {};
      for (const clip of gltf.animations ?? []) {
        const key = clipKey(clip.name);
        const priority = clipPriority(key, clip.name);
        if (!actions[key] || priority > (priorities[key] ?? 0)) {
          actions[key] = visual.mixer.clipAction(clip);
          priorities[key] = priority;
        }
      }
      visual.actions = actions;
      visual.modelReady = true;
      play(visual, visual.dead ? "down" : "idle", visual.dead);
    });
  }, [loadModel, play]);

  const ensureUnit = useCallback((key: string, championId: number, side: "player" | "enemy") => {
    const t = threeRef.current;
    let visual = t.units.get(key);
    if (visual) return visual;
    const group = new THREE.Group();
    const bars = new THREE.Group();
    bars.position.y = 1.56;
    const hpBack = makeBar(0.68, 0.055, 0x101827, 0, 0.11, 0);
    const hp = makeBar(0.68, 0.055, side === "player" ? 0x42df88 : 0xff536d, 0, 0.111, 0.002);
    const shield = makeBar(0.68, 0.055, 0x82cfff, 0, 0.112, 0.003);
    (shield.material as THREE.SpriteMaterial).opacity = 0.78;
    const manaBack = makeBar(0.68, 0.035, 0x101827, 0, 0.03, 0);
    const mana = makeBar(0.68, 0.035, 0x5fc7ff, 0, 0.031, 0.002);
    bars.add(hpBack, hp, shield, manaBack, mana);
    const starMeshes: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Sprite(
        new THREE.SpriteMaterial({ color: i === 2 ? 0xffd25f : 0xffedaa, depthTest: false, transparent: true }),
      );
      star.scale.set(0.085, 0.085, 1);
      star.position.set((i - 1) * 0.105, 0.205, 0.004);
      (star.material as THREE.SpriteMaterial).rotation = Math.PI / 4;
      star.renderOrder = 31;
      starMeshes.push(star);
      bars.add(star);
    }
    // Bars live outside the rotating unit group. Plane/sprite offsets inside
    // a yawing character can become depth-aligned when the camera orbits.
    if (t.scene) t.scene.add(bars);
    else group.add(bars);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.33, 0.42, 36),
      new THREE.MeshBasicMaterial({ color: side === "player" ? 0x58cfff : 0xff6178, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.018;
    group.add(ring);
    visual = { key, group, bars, hpBar: hp, shieldBar: shield, manaBar: mana, starMeshes, barHeight: 1.56, championId, side, x: 0, z: 0, dead: false, casting: false, lastEventT: -1, modelReady: false };
    t.units.set(key, visual);
    t.scene?.add(group);
    attachModel(visual, store.champions.get(championId));
    return visual;
  }, [attachModel, store]);

  // Rebuild unit models when the player switches a cosmetic skin.
  useEffect(() => onSkinChange(() => {
    const t = threeRef.current;
    for (const visual of t.units.values()) {
      const champion = store.champions.get(visual.championId);
      if (!champion) continue;
      const desired = getSkin(store.costumes, champion.id);
      if (desired === visual.skinId) continue;
      if (visual.modelRoot) visual.group.remove(visual.modelRoot);
      if (visual.portrait) visual.group.remove(visual.portrait);
      visual.modelRoot = undefined;
      visual.portrait = undefined;
      visual.mixer?.stopAllAction();
      visual.mixer = undefined;
      visual.actions = undefined;
      visual.current = undefined;
      visual.modelReady = false;
      attachModel(visual, champion);
    }
  }), [attachModel, store]);

  // Initialize renderer, board, input and animation loop once.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const t = threeRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x0b1526, 18, 38);
    // The original Valkyrie Connect arena illustration is applied as the CSS
    // backdrop of the canvas wrapper. Keeping the WebGL clear color transparent
    // makes it visible regardless of camera angle or scene-background texture
    // implementation differences.
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(7.6, 8.7, 9.5);
    camera.lookAt(3.5, 0, 3.45);
    t.renderer = renderer;
    t.scene = scene;
    t.camera = camera;

    // Mouse-drag orbital camera. The default angles reproduce the original fixed
    // three-quarter board view; dragging only rotates the camera around the board
    // center and never changes logical board coordinates.
    const orbit = {
      center: new THREE.Vector3(3.5, 0, 3.45),
      radius: 12.25,
      yaw: 0.595,
      pitch: 0.785,
      dragging: false,
      moved: false,
      lastX: 0,
      lastY: 0,
    };
    const updateCamera = () => {
      const sinPitch = Math.sin(orbit.pitch);
      camera.position.set(
        orbit.center.x + orbit.radius * sinPitch * Math.sin(orbit.yaw),
        orbit.center.y + orbit.radius * Math.cos(orbit.pitch),
        orbit.center.z + orbit.radius * sinPitch * Math.cos(orbit.yaw),
      );
      camera.lookAt(orbit.center);
    };
    const resetCamera = () => {
      orbit.radius = 12.25;
      orbit.yaw = 0.595;
      orbit.pitch = 0.785;
      orbit.dragging = false;
      orbit.moved = false;
      updateCamera();
    };
    cameraResetRef.current = resetCamera;
    updateCamera();
    let pressTimer = 0;
    let pressX = 0;
    let pressY = 0;
    // Multi-touch pinch zoom: track every active pointer so a second finger can
    // switch the gesture from rotate-drag into pinch without jittering the camera.
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const clearPressTimer = () => {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = 0;
    };
    const pinchGap = () => {
      const pts = Array.from(activePointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        clearPressTimer();
        orbit.dragging = false;
        orbit.moved = true;
        pinchDistance = pinchGap();
        try { canvas.setPointerCapture?.(event.pointerId); } catch { /* synthetic or stale pointer */ }
        return;
      }
      orbit.dragging = true;
      orbit.moved = false;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* synthetic or stale pointer */ }
      pressX = event.clientX;
      pressY = event.clientY;
      clearPressTimer();
      pressTimer = window.setTimeout(() => {
        const st = stateRef.current;
        if (st.phase !== "planning" || !t.camera) return;
        const rect = canvas.getBoundingClientRect();
        t.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        t.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        t.raycaster.setFromCamera(t.pointer, t.camera);
        const hit = t.raycaster.intersectObjects(t.tiles, false)[0];
        if (!hit) return;
        const loc = hit.object.userData.loc;
        const y = loc.z - 4;
        if (loc.x < 0 || loc.x >= 8 || y < 0 || y >= 4) return;
        const unit = st.players[0].board[`${loc.x},${y}`];
        if (!unit) return;
        orbit.dragging = false;
        orbit.moved = true;
        inspectRef.current(unit.championId, true);
      }, 540);
    };
    const pointerMove = (event: PointerEvent) => {
      if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 12) clearPressTimer();
      if (activePointers.size >= 2) {
        orbit.moved = true;
        const gap = pinchGap();
        if (pinchDistance > 0 && gap > 0) {
          orbit.radius = Math.max(8.2, Math.min(17.5, orbit.radius * (pinchDistance / gap)));
          updateCamera();
        }
        pinchDistance = gap;
        return;
      }
      if (!orbit.dragging) return;
      const dx = event.clientX - orbit.lastX;
      const dy = event.clientY - orbit.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) orbit.moved = true;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      orbit.yaw -= dx * 0.0062;
      orbit.pitch = Math.max(0.42, Math.min(1.24, orbit.pitch + dy * 0.0048));
      updateCamera();
    };
    const pointerUp = (event: PointerEvent) => {
      clearPressTimer();
      activePointers.delete(event.pointerId);
      pinchDistance = 0;
      orbit.dragging = false;
      // Re-anchor the rotate baseline onto the remaining finger so lifting one
      // hand does not make the camera jump on the next move event.
      if (activePointers.size === 1) {
        const rest = Array.from(activePointers.values())[0];
        orbit.lastX = rest.x;
        orbit.lastY = rest.y;
        orbit.dragging = true;
      }
      try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
    };
    const wheel = (event: WheelEvent) => {
      // Plain mouse-wheel/touchpad scrolling must not zoom the battlefield: on
      // tablets and hybrid laptops those events are often generated while the
      // user only intends to scroll the page. Require Ctrl for an explicit zoom.
      if (!event.ctrlKey) return;
      event.preventDefault();
      orbit.radius = Math.max(8.2, Math.min(17.5, orbit.radius + event.deltaY * 0.008));
      updateCamera();
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    scene.add(new THREE.HemisphereLight(0xd8ecff, 0x27324a, 2.35));
    const sun = new THREE.DirectionalLight(0xffdda0, 3.15);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x78d8ff, 1.65);
    rim.position.set(-4, 5, 9);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.5, 0.28, 8), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 }));
    ground.position.set(3.5, -0.18, 3.5);
    ground.rotation.y = Math.PI / 8;
    ground.receiveShadow = true;
    scene.add(ground);

    const tileGeo = new THREE.BoxGeometry(0.91, 0.055, 0.91);
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) {
        const playerZone = z >= 4;
        const mat = new THREE.MeshStandardMaterial({
          color: playerZone ? ((x + z) % 2 ? 0x173f68 : 0x123557) : ((x + z) % 2 ? 0x4b2136 : 0x3d1c2f),
          roughness: 0.68,
          metalness: 0.1,
          transparent: true,
          opacity: 0.92,
        });
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(x, 0, z);
        tile.receiveShadow = true;
        tile.userData.loc = { x, z };
        scene.add(tile);
        t.tiles.push(tile);
        t.tileMap.set(`${x},${z}`, tile);
      }
    }
    const mid = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffd978, transparent: true, opacity: 0.32 }));
    mid.position.set(3.5, 0.06, 3.5);
    scene.add(mid);
    scene.add(t.effects);

    let lastResizeW = 0;
    let lastResizeH = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      // Integer sizes avoid a fractional ResizeObserver feedback loop on tablets:
      // canvas bitmap resize -> layout rounding -> another resize observation.
      const w = Math.max(320, Math.round(rect.width));
      const h = Math.max(240, Math.round(rect.height));
      if (w === lastResizeW && h === lastResizeH) return;
      lastResizeW = w;
      lastResizeH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const click = (event: MouseEvent) => {
      if (orbit.moved) {
        orbit.moved = false;
        return;
      }
      const st = stateRef.current;
      if (st.phase !== "planning" || !t.camera) return;
      const rect = canvas.getBoundingClientRect();
      t.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      t.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      t.raycaster.setFromCamera(t.pointer, t.camera);
      const hit = t.raycaster.intersectObjects(t.tiles, false)[0];
      if (!hit) {
        locationClickRef.current(null);
        return;
      }
      const loc = hit.object.userData.loc;
      const y = loc.z - 4;
      if (loc.x >= 0 && loc.x < 8 && y >= 0 && y < 4) locationClickRef.current({ type: "board", x: loc.x, y });
      else locationClickRef.current(null);
    };
    canvas.addEventListener("click", click);

    const clock = new THREE.Clock();
    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());
      for (const visual of t.units.values()) {
        visual.mixer?.update(dt * (stateRef.current.combatSpeed || 1));
        visual.bars.position.set(visual.group.position.x, visual.barHeight, visual.group.position.z);
        visual.bars.visible = visual.group.visible;
        visual.bars.lookAt(camera.position);
        if (visual.modelReady) {
          const combat = stateRef.current.combat;
          const celebrating = Boolean(combat && playbackRef.current >= combat.result.duration - 0.04 && combat.result.winner === visual.side && !visual.dead);
          const combineCelebrating = !visual.dead && visual.celebrateUntil != null && performance.now() < visual.celebrateUntil;
          if (visual.dead) play(visual, "down", true);
          else if (combineCelebrating || celebrating) play(visual, "win", true);
          else if (visual.casting) play(visual, "skill", true);
          else {
            const moving = Math.hypot(visual.group.position.x - visual.x, visual.group.position.z - visual.z) > 0.035;
            if (moving) play(visual, "run");
            else if (!visual.current || visual.current.loop === THREE.LoopRepeat || !visual.current.isRunning()) play(visual, "idle");
          }
        }
        visual.group.position.x += (visual.x - visual.group.position.x) * Math.min(1, dt * 10);
        visual.group.position.z += (visual.z - visual.group.position.z) * Math.min(1, dt * 10);
        if (!visual.dead) {
          const dx = visual.x - visual.group.position.x;
          const dz = visual.z - visual.group.position.z;
          const moving = Math.hypot(dx, dz) > 0.02;
          const combat = stateRef.current.combat;
          const celebrating = Boolean(combat && playbackRef.current >= combat.result.duration - 0.04 && combat.result.winner === visual.side);
          let targetRotation: number;
          if (celebrating) {
            targetRotation = Math.atan2(camera.position.x - visual.group.position.x, camera.position.z - visual.group.position.z);
          } else if (moving) {
            targetRotation = Math.atan2(dx, dz);
          } else if (visual.faceX != null && visual.faceZ != null) {
            const facingDx = visual.faceX - visual.group.position.x;
            const facingDz = visual.faceZ - visual.group.position.z;
            targetRotation = Math.hypot(facingDx, facingDz) > 0.02 ? Math.atan2(facingDx, facingDz) : visual.group.rotation.y;
          } else {
            targetRotation = visual.side === "player" ? Math.PI : 0;
          }
          visual.group.rotation.y = dampAngle(visual.group.rotation.y, targetRotation, moving ? 14 : 10, dt);
        }
      }
      if (import.meta.env.DEV) {
        (window as any).__board3dDebug = {
          unitCount: t.units.size,
          cameraRadius: orbit.radius,
          playback: playbackRef.current,
          units: Array.from(t.units.values()).map((visual) => ({
            key: visual.key,
            championId: visual.championId,
            modelReady: visual.modelReady,
            clips: Object.keys(visual.actions ?? {}),
            current: visual.current?.getClip().name ?? null,
            dead: visual.dead,
            rotation: visual.group.rotation.y,
            x: visual.group.position.x,
            z: visual.group.position.z,
            logicalX: visual.x,
            logicalZ: visual.z,
            targetId: visual.targetId ?? null,
            faceX: visual.faceX ?? null,
            faceZ: visual.faceZ ?? null,
          })),
        };
      }
      renderer.render(scene, camera);
      t.frame = requestAnimationFrame(animate);
    };
    t.frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(t.frame);
      clearPressTimer();
      observer.disconnect();
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      cameraResetRef.current = () => {};
      renderer.dispose();
      scene.traverse((obj: any) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose?.());
        else obj.material?.dispose?.();
      });
      t.units.clear();
      t.tiles.length = 0;
      t.tileMap.clear();
    };
  }, [play]);

  const combatUnits = useMemo(() => {
    if (state.phase !== "combat" || !state.combat) return [];
    return interpUnits(state.combat.result, playback);
  }, [state.combat, state.phase, playback]);

  const targetTimelines = useMemo(() => {
    const timelines = new Map<number, Array<{ t: number; target: number }>>();
    if (state.phase !== "combat" || !state.combat) return timelines;
    for (const event of state.combat.result.events) {
      if ((event.type !== "attack" && event.type !== "skill") || event.source == null || event.target == null) continue;
      const list = timelines.get(event.source) ?? [];
      list.push({ t: event.t, target: event.target });
      timelines.set(event.source, list);
    }
    for (const list of timelines.values()) list.sort((a, b) => a.t - b.t);
    return timelines;
  }, [state.combat, state.phase]);

  // Synchronize logical game state into the persistent Three scene.
  useEffect(() => {
    const t = threeRef.current;
    if (!t.scene) return;
    const wanted = new Set<string>();

    if (state.phase === "combat" && state.combat) {
      const first = state.combat.result.frames[0];
      const unitById = new Map(combatUnits.map((unit) => [unit.id, unit]));
      const sideById = new Map(combatUnits.map((unit) => [unit.id, state.combat!.result.unitLabels[unit.id]?.side]));
      for (const unit of combatUnits) {
        const label = state.combat.result.unitLabels[unit.id];
        if (!label) continue;
        const key = `c${unit.id}`;
        wanted.add(key);
        const visual = ensureUnit(key, label.championId, label.side);
        visual.x = unit.x;
        visual.z = unit.y;
        if (!visual.initializedPosition) {
          visual.group.position.set(unit.x, 0, unit.y);
          visual.initializedPosition = true;
          visual.snapFacing = true;
        }
        visual.dead = !unit.alive;
        visual.casting = Boolean(unit.casting);
        const maxHp = Math.max(1, unit.maxHp ?? first?.units.find((u) => u.id === unit.id)?.hp ?? unit.hp ?? 1);
        const hpPct = Math.max(0, Math.min(1, unit.hp / maxHp));
        const shownHpPct = unit.alive && hpPct > 0 ? Math.max(0.018, hpPct) : hpPct;
        visual.hpBar.scale.x = 0.68 * Math.max(0.001, shownHpPct);
        visual.hpBar.position.x = -0.34 * (1 - shownHpPct);
        const shieldPct = Math.max(0, Math.min(1, (unit.shield ?? 0) / maxHp));
        visual.shieldBar.scale.x = 0.68 * Math.max(0.001, shieldPct);
        visual.shieldBar.position.x = -0.34 * (1 - shieldPct);
        visual.shieldBar.visible = shieldPct > 0.01;
        const manaPct = unit.mana / 104;
        visual.manaBar.scale.x = 0.68 * Math.max(0.001, Math.min(1, manaPct));
        visual.manaBar.position.x = -0.34 * (1 - Math.max(0, Math.min(1, manaPct)));
        // In this autochess adaptation a defeated unit is removed from the field
        // immediately. The planning board is authoritative and rebuilds the unit
        // after the combat replay ends, so dead bodies do not block the board.
        visual.group.visible = unit.alive;
        visual.starMeshes.forEach((star, starIndex) => { star.visible = starIndex < label.star; });

        // Trigger attack/skill one-shots when a new event for this unit enters the playback window.
        // Combat events also carry the real target id, so ranged units can keep facing
        // the exact unit they are attacking instead of using a fixed side direction.
        const events = state.combat.result.events.filter((e) => e.source === unit.id && e.t > visual.lastEventT && e.t <= playback && (e.type === "attack" || e.type === "skill" || e.type === "damage"));
        if (events.length) {
          visual.lastEventT = Math.max(...events.map((e) => e.t));
          const skillEvent = events.find((e) => e.type === "skill");
          if (skillEvent) play(visual, "skill", true);
          else if (events.some((e) => e.type === "attack")) play(visual, "attack", true, 0.08);
        }

        const timeline = targetTimelines.get(unit.id) ?? [];
        let previousTarget: number | undefined;
        let nextTarget: number | undefined;
        for (const entry of timeline) {
          if (entry.t <= playback + 0.001) previousTarget = entry.target;
          else {
            nextTarget = entry.target;
            break;
          }
        }
        const previousSnapshot = previousTarget != null ? unitById.get(previousTarget) : undefined;
        const preferredTargetId = previousSnapshot?.alive ? previousTarget : nextTarget ?? previousTarget;
        visual.targetId = preferredTargetId;

        let target = visual.targetId != null ? unitById.get(visual.targetId) : undefined;
        if (!target || sideById.get(target.id) === label.side) {
          let bestDistance = Infinity;
          target = undefined;
          for (const candidate of combatUnits) {
            if (!candidate.alive || sideById.get(candidate.id) === label.side) continue;
            const candidateDistance = Math.hypot(candidate.x - unit.x, candidate.y - unit.y);
            if (candidateDistance < bestDistance) {
              bestDistance = candidateDistance;
              target = candidate;
            }
          }
          visual.targetId = target?.id;
        }
        if (target) {
          visual.faceX = target.x;
          visual.faceZ = target.y;
        } else {
          visual.faceX = undefined;
          visual.faceZ = undefined;
        }
        if (visual.snapFacing) {
          visual.group.rotation.y = target
            ? Math.atan2(target.x - unit.x, target.y - unit.y)
            : (label.side === "player" ? Math.PI : 0);
          visual.snapFacing = false;
        }
      }
    } else if (state.phase === "planning") {
      const player = state.players[0];
      const currentMaxStars = new Map<number, number>();
      for (const unit of Object.values(player.board)) currentMaxStars.set(unit.championId, Math.max(currentMaxStars.get(unit.championId) ?? 0, unit.star));
      const upgradedChampions = new Set<number>();
      for (const [championId, star] of currentMaxStars) {
        const previousStar = previousBoardStarsRef.current.get(championId);
        // Only an increase from an already deployed copy is a combine. The first
        // deployment of a one-star unit must not be mistaken for a star-up.
        if (previousStar != null && star > previousStar) upgradedChampions.add(championId);
      }
      for (const [key, unit] of Object.entries(player.board)) {
        const [x, y] = key.split(",").map(Number);
        const visualKey = `p${unit.uid}`;
        wanted.add(visualKey);
        const visual = ensureUnit(visualKey, unit.championId, "player");
        if (upgradedChampions.has(unit.championId) && unit.star === currentMaxStars.get(unit.championId)) {
          visual.celebrateUntil = performance.now() + 1650;
        }
        visual.x = x;
        visual.z = y + 4;
        if (!visual.initializedPosition) {
          visual.group.position.set(x, 0, y + 4);
          visual.group.rotation.y = Math.PI;
          visual.initializedPosition = true;
        }
        visual.dead = false;
        visual.casting = false;
        visual.targetId = undefined;
        visual.faceX = undefined;
        visual.faceZ = undefined;
        visual.hpBar.scale.x = 0.68;
        visual.hpBar.position.x = 0;
        visual.shieldBar.scale.x = 0.00068;
        visual.shieldBar.position.x = -0.34;
        visual.shieldBar.visible = false;
        visual.manaBar.scale.x = 0.0816;
        visual.manaBar.position.x = -0.3;
        visual.starMeshes.forEach((star, starIndex) => { star.visible = starIndex < unit.star; });
        if (visual.modelReady && !(visual.celebrateUntil != null && performance.now() < visual.celebrateUntil)) play(visual, "idle");
      }
      previousBoardStarsRef.current = currentMaxStars;
    }

    for (const [key, visual] of Array.from(t.units.entries())) {
      if (!wanted.has(key)) {
        t.scene.remove(visual.group);
        // Bars are scene-level billboards rather than children of the unit
        // group, so removing only the group leaves ghost HP bars behind.
        t.scene.remove(visual.bars);
        t.units.delete(key);
      }
    }

    // Selected tile highlight.
    for (const tile of t.tiles) {
      const mat = tile.material as THREE.MeshStandardMaterial;
      const loc = tile.userData.loc;
      const isSelected = selectedRef.current?.type === "board" && selectedRef.current.x === loc.x && selectedRef.current.y === loc.z - 4;
      mat.emissive = new THREE.Color(isSelected ? 0xffc95e : 0x000000);
      mat.emissiveIntensity = isSelected ? 0.85 : 0;
    }

    // Lightweight combat beams/rings. Dispose transient geometry before clearing;
    // Object3D.clear() alone would leak GPU buffers every rendered frame.
    disposeObject3D(t.effects);
    t.effects.clear();
    if (state.phase === "combat" && state.combat) {
      const visible = state.combat.result.events.filter((e) => e.t <= playback && playback - e.t < 0.45).slice(-18);
      for (const event of visible) {
        if ((event.type === "attack" || event.type === "skill") && event.x != null && event.y != null && event.x2 != null && event.y2 != null) {
          const points = [new THREE.Vector3(event.x, 0.82, event.y), new THREE.Vector3(event.x2, 0.82, event.y2)];
          const geo = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: event.type === "skill" ? 0xffd66e : 0xcceeff, transparent: true, opacity: event.type === "skill" ? 0.9 : 0.55 }));
          t.effects.add(line);
        }
        if (event.type === "skill" && event.x != null && event.y != null) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.25 + (playback - event.t) * 1.8, 0.3 + (playback - event.t) * 1.8, 42),
            new THREE.MeshBasicMaterial({ color: 0xffd66e, transparent: true, opacity: Math.max(0, 0.8 - (playback - event.t) * 1.6), side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(event.x, 0.04, event.y);
          t.effects.add(ring);
        }
      }
    }
  }, [state, combatUnits, playback, targetTimelines, ensureUnit, play]);

  const overlayEvents = useMemo(() => {
    if (state.phase !== "combat" || !state.combat || !threeRef.current.camera) return [];
    const camera = threeRef.current.camera;
    return state.combat.result.events
      .map((event, index) => ({ event, index, age: playback - event.t }))
      .filter(({ event, age }) => age >= 0 && age < 0.95 && event.x != null && event.y != null && (
        (event.type === "damage" && (event.amount || event.text)) ||
        (event.type === "heal" && event.amount) ||
        (event.type === "shield" && event.amount) ||
        (event.type === "skill" && event.text)
      ))
      .slice(-34)
      .map(({ event, index, age }) => {
        const projected = new THREE.Vector3(event.x!, 1.78, event.y!).project(camera);
        const type = event.type === "damage" ? (event.text === "暴击" ? "crit" : event.text === "闪避" ? "dodge" : "damage") : event.type;
        const text = event.type === "skill" ? event.text : event.text && !event.amount ? event.text : `${event.type === "heal" ? "+" : event.type === "shield" ? "盾" : "-"}${event.amount ?? ""}`;
        return {
          key: `${index}-${event.t}`,
          text: text ?? "",
          type,
          left: `${(projected.x + 1) * 50}%`,
          top: `${(1 - projected.y) * 50}%`,
          opacity: Math.max(0, 1 - age / 0.95),
          lift: age * 34,
          scale: event.type === "skill" ? 1 : type === "crit" ? 1.18 : 0.94,
        };
      });
  }, [state.combat, state.phase, playback]);

  return (
    <div ref={wrapRef} className="board-canvas-wrap board-3d-wrap">
      <canvas ref={canvasRef} className="board-canvas" />
      {modelProgress.active > 0 && (
        <div className="model-load-badge" role="status">
          <div className="model-load-text">
            <strong>正在下载角色模型</strong>
            <span>
              剩余 {modelProgress.active} 个
              {modelProgress.knownTotal ? ` · ${formatBytes(modelProgress.bytesLoaded)} / ${formatBytes(modelProgress.bytesTotal)}` : ` · 已下载 ${formatBytes(modelProgress.bytesLoaded)}`}
            </span>
          </div>
          <div className="model-load-track">
            {modelProgress.knownTotal ? (
              <i style={{ width: `${Math.max(4, Math.min(100, (modelProgress.bytesLoaded / modelProgress.bytesTotal) * 100))}%` }} />
            ) : (
              <i className="indeterminate" />
            )}
          </div>
        </div>
      )}
      <div className="combat-float-layer" aria-hidden="true">
        {overlayEvents.map((item) => (
          <span
            key={item.key}
            className={`combat-float combat-float-${item.type}`}
            style={{ left: item.left, top: item.top, opacity: item.opacity, transform: `translate(-50%, calc(-100% - ${item.lift}px)) scale(${item.scale})` }}
          >
            {item.text}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="camera-reset-button"
        title="重置棋盘视角"
        onClick={(event) => {
          event.stopPropagation();
          cameraResetRef.current();
        }}
      >
        重置视角
      </button>
      {state.phase === "combat" && state.combat && (
        <div className="combat-hud">
          <div>
            <strong>第 {state.combat.round} 回合</strong>
            <span>{state.combat.roundType === "pve" ? "世界树试炼" : `对阵 ${state.combat.opponentName}`} · 3D</span>
          </div>
          <button className="ghost-button compact" onClick={onCombatEnd}>跳过演出</button>
        </div>
      )}
      {state.phase === "planning" && state.round === 1 && Object.keys(state.players[0].board).length === 0 && (
        <div className="tutorial-ribbon">
          <strong>开局指引</strong>
          <span>1 购买英灵</span><b>→</b><span>2 点击备战席棋子</span><b>→</b><span>3 点击蓝色棋盘格上阵</span><b>→</b><span>空格开战</span>
        </div>
      )}
      {state.phase === "planning" && (
        <div className="board-3d-caption">上阵 {Object.keys(state.players[0].board).length}/{deployLimit(state.players[0])} · 原版 3D 模型战斗场景</div>
      )}
    </div>
  );
}
