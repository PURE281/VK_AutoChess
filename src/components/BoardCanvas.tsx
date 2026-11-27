import { useEffect, useMemo, useRef, useState } from "react";
import type { Champion, CombatResult, CombatUnitSnapshot, GameState, LocationRef, UnitInstance } from "../types";
import type { DataStore } from "../data";
import { boardKey } from "../game/roster";
import { deployLimit } from "../game/roster";
import { getCachedImage, useSeasonImages } from "../hooks/useImages";
import { sound } from "../sound";

interface BoardCanvasProps {
  store: DataStore;
  state: GameState;
  selected: LocationRef | null;
  onLocationClick: (loc: LocationRef | null) => void;
  onCombatEnd: () => void;
}

interface Projection {
  cx: number;
  cy: number;
  tileW: number;
  tileH: number;
  scale: number;
}

function projection(width: number, height: number): Projection {
  const scale = Math.max(0.66, Math.min(width / 690, height / 470));
  const tileW = 82 * scale;
  const tileH = 41 * scale;
  return {
    cx: width / 2,
    cy: 62 * scale,
    tileW,
    tileH,
    scale,
  };
}

function project(p: Projection, x: number, y: number): { x: number; y: number } {
  return {
    x: p.cx + ((x - y) * p.tileW) / 2,
    y: p.cy + ((x + y) * p.tileH) / 2,
  };
}

function unproject(p: Projection, sx: number, sy: number): { x: number; y: number } {
  const u = (sx - p.cx) / (p.tileW / 2);
  const v = (sy - p.cy) / (p.tileH / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

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
  const span = Math.max(0.001, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (time - a.t) / span));
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

function diamondPath(ctx: CanvasRenderingContext2D, p: Projection, x: number, y: number): void {
  const c = project(p, x, y);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - p.tileH / 2);
  ctx.lineTo(c.x + p.tileW / 2, c.y);
  ctx.lineTo(c.x, c.y + p.tileH / 2);
  ctx.lineTo(c.x - p.tileW / 2, c.y);
  ctx.closePath();
}

function drawBoard(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, selected: LocationRef | null): Projection {
  const p = projection(width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0a1022");
  bg.addColorStop(0.48, "#101a30");
  bg.addColorStop(1, "#07101d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.48;
  for (let i = 0; i < 42; i++) {
    const x = (i * 173) % width;
    const y = (i * 97) % Math.max(1, height * 0.55);
    ctx.fillStyle = i % 3 === 0 ? "#9cc8ff" : "#4b6f9f";
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const center = project(p, 3.5, 3.5);
  const aura = ctx.createRadialGradient(center.x, center.y, 20, center.x, center.y, 360 * p.scale);
  aura.addColorStop(0, "rgba(77, 163, 255, 0.20)");
  aura.addColorStop(0.55, "rgba(42, 89, 156, 0.08)");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  for (let sum = 0; sum <= 14; sum++) {
    for (let x = 0; x < 8; x++) {
      const y = sum - x;
      if (y < 0 || y > 7) continue;
      const isPlayerZone = y >= 4;
      const isSelected = selected?.type === "board" && selected.x === x && selected.y === y - 4;
      diamondPath(ctx, p, x, y);
      ctx.fillStyle = isPlayerZone ? "rgba(41, 104, 171, 0.22)" : "rgba(105, 48, 70, 0.17)";
      if ((x + y) % 2 === 0) ctx.fillStyle = isPlayerZone ? "rgba(51, 126, 199, 0.19)" : "rgba(126, 56, 78, 0.14)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffe59a" : isPlayerZone ? "rgba(117, 188, 255, 0.44)" : "rgba(230, 123, 143, 0.24)";
      ctx.lineWidth = isSelected ? 2.4 : 1;
      ctx.stroke();
    }
  }

  const midA = project(p, -0.55, 3.5);
  const midB = project(p, 7.55, 3.5);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 219, 128, 0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  ctx.moveTo(midA.x, midA.y);
  ctx.lineTo(midB.x, midB.y);
  ctx.stroke();
  ctx.restore();

  if (state.phase === "planning") {
    const player = state.players[0];
    const c = project(p, 3.5, 7.92);
    ctx.save();
    ctx.font = `${Math.round(13 * p.scale)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(190, 220, 255, 0.82)";
    ctx.fillText(`我方布阵区 · 上阵 ${Object.keys(player.board).length}/${deployLimit(player)}`, c.x, c.y + 12 * p.scale);
    ctx.restore();
  }
  return p;
}

function starColor(star: number): string {
  if (star >= 3) return "#ffd75e";
  if (star === 2) return "#b9c7ff";
  return "#9ad0ff";
}

function drawUnitDisc(
  ctx: CanvasRenderingContext2D,
  p: Projection,
  x: number,
  y: number,
  champion: Champion | undefined,
  opts: {
    side: "player" | "enemy";
    star: number;
    hpPct: number;
    manaPct: number;
    shieldPct?: number;
    alive?: boolean;
    selected?: boolean;
    casting?: boolean;
    itemCount?: number;
  },
): void {
  const pos = project(p, x, y);
  const scale = p.scale;
  const radius = (24 + opts.star * 1.7) * scale;
  const alive = opts.alive !== false;

  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.34;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + radius * 0.54, radius * 1.05, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  if (opts.casting) {
    ctx.strokeStyle = "rgba(255, 224, 122, 0.78)";
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - radius * 0.18, radius + 7 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(pos.x, pos.y - radius * 0.22, radius, 0, Math.PI * 2);
  const fallback = ctx.createLinearGradient(pos.x, pos.y - radius, pos.x, pos.y + radius);
  fallback.addColorStop(0, opts.side === "player" ? "#365f98" : "#7c364d");
  fallback.addColorStop(1, "#111827");
  ctx.fillStyle = fallback;
  ctx.fill();

  const image = champion ? getCachedImage(champion.assets.icon) : null;
  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - radius * 0.22, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, pos.x - radius, pos.y - radius * 1.22, radius * 2, radius * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `bold ${Math.round(radius * 0.82)}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(champion?.name?.slice(0, 1) ?? "?", pos.x, pos.y - radius * 0.2);
  }

  ctx.beginPath();
  ctx.arc(pos.x, pos.y - radius * 0.22, radius, 0, Math.PI * 2);
  ctx.strokeStyle = opts.selected ? "#ffe58a" : opts.side === "player" ? "#74d0ff" : "#ff7d91";
  ctx.lineWidth = (opts.selected ? 3.6 : 2.4) * scale;
  ctx.stroke();

  for (let i = 0; i < opts.star; i++) {
    const sx = pos.x + (i - (opts.star - 1) / 2) * 10 * scale;
    const sy = pos.y - radius * 1.55;
    ctx.fillStyle = starColor(opts.star);
    ctx.beginPath();
    ctx.arc(sx, sy, 3.3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const barW = 48 * scale;
  const barH = 5.2 * scale;
  const bx = pos.x - barW / 2;
  const by = pos.y + radius * 0.78;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH * 2 + 4);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = opts.side === "player" ? "#45df8d" : "#ff6478";
  ctx.fillRect(bx, by, barW * Math.max(0, Math.min(1, opts.hpPct)), barH);
  if ((opts.shieldPct ?? 0) > 0) {
    ctx.fillStyle = "rgba(235,245,255,0.82)";
    ctx.fillRect(bx, by - 2 * scale, barW * Math.min(1, opts.shieldPct ?? 0), 2 * scale);
  }
  ctx.fillStyle = "#172554";
  ctx.fillRect(bx, by + barH + 2 * scale, barW, barH * 0.78);
  ctx.fillStyle = "#65c7ff";
  ctx.fillRect(bx, by + barH + 2 * scale, barW * Math.max(0, Math.min(1, opts.manaPct)), barH * 0.78);

  if ((opts.itemCount ?? 0) > 0) {
    for (let i = 0; i < (opts.itemCount ?? 0); i++) {
      ctx.fillStyle = "#ffd76c";
      ctx.beginPath();
      ctx.arc(pos.x + radius * 0.72, pos.y - radius * 0.75 + i * 8 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCombatEffects(ctx: CanvasRenderingContext2D, p: Projection, result: CombatResult, time: number): void {
  const events = result.events.filter((event) => event.t <= time && time - event.t < 0.95);
  for (const event of events) {
    const age = time - event.t;
    const alpha = Math.max(0, 1 - age / 0.95);
    if (event.type === "attack" && event.x != null && event.y != null && event.x2 != null && event.y2 != null) {
      const a = project(p, event.x, event.y);
      const b = project(p, event.x2, event.y2);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = "#dceeff";
      ctx.lineWidth = 1.8 * p.scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 16 * p.scale);
      ctx.lineTo(b.x, b.y - 16 * p.scale);
      ctx.stroke();
      ctx.restore();
    }
    if (event.type === "skill" && event.x != null && event.y != null) {
      const a = project(p, event.x, event.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffd86f";
      ctx.lineWidth = 2.8 * p.scale;
      ctx.beginPath();
      ctx.arc(a.x, a.y - 18 * p.scale, (20 + age * 42) * p.scale, 0, Math.PI * 2);
      ctx.stroke();
      if (event.x2 != null && event.y2 != null) {
        const b = project(p, event.x2, event.y2);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, "rgba(255,218,105,0.88)");
        grad.addColorStop(1, "rgba(124,211,255,0.18)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 5 * p.scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 16 * p.scale);
        ctx.lineTo(b.x, b.y - 16 * p.scale);
        ctx.stroke();
      }
      if (event.text) {
        ctx.font = `bold ${Math.round(12 * p.scale)}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe9a8";
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 3;
        ctx.strokeText(event.text, a.x, a.y - (52 + age * 20) * p.scale);
        ctx.fillText(event.text, a.x, a.y - (52 + age * 20) * p.scale);
      }
      ctx.restore();
    }
    if (["damage", "heal", "shield", "status", "death"].includes(event.type) && event.x != null && event.y != null) {
      const pos = project(p, event.x, event.y);
      let text = event.text ?? "";
      let color = "#f8fafc";
      if (event.type === "damage" && event.amount) {
        text = `-${event.amount}`;
        color = "#ff8d7a";
      } else if (event.type === "heal" && event.amount) {
        text = `+${event.amount}`;
        color = "#65f0a0";
      } else if (event.type === "shield" && event.amount) {
        text = `盾 ${event.amount}`;
        color = "#bcd8ff";
      } else if (event.type === "death") {
        text = "阵亡";
        color = "#cbd5e1";
      }
      if (!text) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round((event.type === "damage" ? 13 : 11) * p.scale)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.78)";
      ctx.lineWidth = 3;
      ctx.fillStyle = color;
      const yy = pos.y - (38 + age * 32) * p.scale;
      ctx.strokeText(text, pos.x, yy);
      ctx.fillText(text, pos.x, yy);
      ctx.restore();
    }
  }
}

function drawCombatBanner(ctx: CanvasRenderingContext2D, width: number, result: CombatResult, time: number): void {
  if (time < result.duration - 0.05) return;
  const label = result.winner === "player" ? "胜利" : result.winner === "enemy" ? "败北" : "鏖战";
  const color = result.winner === "player" ? "#ffe08a" : result.winner === "enemy" ? "#ff7185" : "#cbd5e1";
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.font = '900 54px "Microsoft YaHei", sans-serif';
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 8;
  ctx.strokeText(label, width / 2, 118);
  ctx.fillStyle = color;
  ctx.fillText(label, width / 2, 118);
  ctx.restore();
}

export default function BoardCanvas({ store, state, selected, onLocationClick, onCombatEnd }: BoardCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 540 });
  const [playback, setPlayback] = useState(0);
  const playbackRef = useRef(0);
  const soundTimeRef = useRef(0);
  const finishedRef = useRef(false);
  useSeasonImages(store);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.max(320, rect.width), height: Math.max(360, rect.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    playbackRef.current = 0;
    soundTimeRef.current = 0;
    setPlayback(0);
    if (state.phase !== "combat" || !state.combat) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      if (!state.combat) return;
      const dt = ((now - last) / 1000) * state.combatSpeed;
      last = now;
      const nextTime = Math.min(state.combat.result.duration + 0.55, playbackRef.current + dt);
      playbackRef.current = nextTime;
      setPlayback(nextTime);
      const audible = state.combat.result.events
        .filter((event) => event.t > soundTimeRef.current && event.t <= nextTime && ["attack", "skill", "death"].includes(event.type))
        .slice(0, 5);
      for (const event of audible) {
        if (event.type === "attack") sound.attack();
        else if (event.type === "skill") sound.skill();
        else sound.death();
      }
      soundTimeRef.current = Math.max(soundTimeRef.current, nextTime);
      if (nextTime >= state.combat.result.duration + 0.22 && !finishedRef.current) {
        finishedRef.current = true;
        if (state.combat.result.winner === "player") sound.victory();
        else if (state.combat.result.winner === "enemy") sound.defeat();
        window.setTimeout(onCombatEnd, 120);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state.phase, state.combat, state.combatSpeed, onCombatEnd]);

  const combatUnits = useMemo(() => {
    if (state.phase !== "combat" || !state.combat) return [];
    return interpUnits(state.combat.result, playback);
  }, [state, playback]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = drawBoard(ctx, size.width, size.height, state, selected);

    const drawables: Array<{
      x: number;
      y: number;
      champion?: Champion;
      side: "player" | "enemy";
      star: number;
      hpPct: number;
      manaPct: number;
      shieldPct?: number;
      alive?: boolean;
      selected?: boolean;
      casting?: boolean;
      itemCount?: number;
    }> = [];

    if (state.phase === "combat" && state.combat) {
      const maxima = new Map<number, { hp: number; mana: number }>();
      const first = state.combat.result.frames[0];
      for (const unit of first?.units ?? []) maxima.set(unit.id, { hp: Math.max(1, unit.hp + unit.shield), mana: 100 });
      for (const unit of combatUnits) {
        const label = state.combat.result.unitLabels[unit.id];
        const champion = label ? store.champions.get(label.championId) : undefined;
        const original = first?.units.find((u) => u.id === unit.id);
        drawables.push({
          x: unit.x,
          y: unit.y,
          champion,
          side: label?.side ?? "enemy",
          star: label?.star ?? 1,
          hpPct: unit.hp / Math.max(1, original?.hp ?? unit.hp ?? 1),
          manaPct: unit.mana / 104,
          shieldPct: unit.shield / Math.max(1, original?.hp ?? 1),
          alive: unit.alive,
          casting: unit.casting,
        });
      }
    } else {
      const player = state.players[0];
      for (const [key, unit] of Object.entries(player.board)) {
        const [x, localY] = key.split(",").map(Number);
        const champion = store.champions.get(unit.championId);
        drawables.push({
          x,
          y: localY + 4,
          champion,
          side: "player",
          star: unit.star,
          hpPct: 1,
          manaPct: 0.12,
          selected: selected?.type === "board" && selected.x === x && selected.y === localY,
          itemCount: unit.items.length,
        });
      }
    }

    drawables.sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const unit of drawables) drawUnitDisc(ctx, p, unit.x, unit.y, unit.champion, unit);

    if (state.phase === "combat" && state.combat) {
      drawCombatEffects(ctx, p, state.combat.result, playback);
      drawCombatBanner(ctx, size.width, state.combat.result, playback);
    }
  }, [store, state, selected, size, playback, combatUnits]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.phase !== "planning") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const p = projection(rect.width, rect.height);
    const point = unproject(p, event.clientX - rect.left, event.clientY - rect.top);
    const x = Math.round(point.x);
    const worldY = Math.round(point.y);
    const y = worldY - 4;
    if (x >= 0 && x < 8 && y >= 0 && y < 4) onLocationClick({ type: "board", x, y });
    else onLocationClick(null);
  };

  return (
    <div ref={wrapRef} className="board-canvas-wrap">
      <canvas ref={canvasRef} className="board-canvas" onClick={handleClick} />
      {state.phase === "combat" && state.combat && (
        <div className="combat-hud">
          <div>
            <strong>第 {state.combat.round} 回合</strong>
            <span>{state.combat.roundType === "pve" ? "世界树试炼" : `对阵 ${state.combat.opponentName}`}</span>
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
    </div>
  );
}
