import { LaneState } from "../../types/lane.js";
import { PlayerState } from "../../types/game-state.js";
import { PlayerId } from "../../types/enums.js";
import { LANE_ZONE_COUNT, TOWER_HP, BASE_HP } from "../../types/constants.js";
import { COLORS, playerColor, playerColorLight, playerColorDark } from "../utils/colors.js";
import { drawHpBar, drawTree, drawVignette, FONT } from "../utils/draw.js";

// Seeded pseudo-random for consistent tree placement
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Lane Path Geometry ─────────────────────────────────────

interface PathPoint {
  x: number;
  y: number;
}

function getLanePathPoints(
  x: number, y: number, w: number, h: number
): PathPoint[] {
  const midY = y + h / 2;
  const points: PathPoint[] = [];
  const segments = 20;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x + t * w;
    // Gentle S-curve
    const wave = Math.sin(t * Math.PI * 2) * (h * 0.08);
    const py = midY + wave;
    points.push({ x: px, y: py });
  }
  return points;
}

function getZoneCenterOnPath(
  zoneIndex: number, x: number, y: number, w: number, h: number
): PathPoint {
  const t = (zoneIndex + 0.5) / LANE_ZONE_COUNT;
  const midY = y + h / 2;
  const wave = Math.sin(t * Math.PI * 2) * (h * 0.08);
  return { x: x + t * w, y: midY + wave };
}

// ── Main Map Renderer ──────────────────────────────────────

export function renderStrategicMap(
  ctx: CanvasRenderingContext2D,
  lane: LaneState,
  players: [PlayerState, PlayerState],
  area: { x: number; y: number; w: number; h: number },
  time: number
): void {
  const { x, y, w, h } = area;

  ctx.save();

  // Clip to map area
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // ── Ground layers ──
  drawGround(ctx, x, y, w, h);

  // ── Vegetation ──
  drawVegetation(ctx, x, y, w, h);

  // ── Lane Path ──
  drawLanePath(ctx, x, y, w, h);

  // ── Frontline rift ──
  drawFrontlineRift(ctx, lane.frontlinePosition, x, y, w, h, time);

  // ── Structures ──
  drawStructures(ctx, lane, x, y, w, h);

  // ── Minions ──
  drawMinions(ctx, lane, x, y, w, h);

  // ── Champions ──
  drawChampions(ctx, lane, players, x, y, w, h);

  // ── Vignette overlay ──
  drawVignette(ctx, x, y, w, h);

  ctx.restore();
}

// ── Ground ─────────────────────────────────────────────────

function drawGround(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  // Three-section gradient: P1 territory | neutral | P2 territory
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, COLORS.mapGrassP1);
  grad.addColorStop(0.35, COLORS.mapGrassP1);
  grad.addColorStop(0.45, COLORS.mapGrassCenter);
  grad.addColorStop(0.55, COLORS.mapGrassCenter);
  grad.addColorStop(0.65, COLORS.mapGrassP2);
  grad.addColorStop(1, COLORS.mapGrassP2);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Subtle noise texture via small dots
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let i = 0; i < 200; i++) {
    const dx = seededRandom(i * 3) * w;
    const dy = seededRandom(i * 3 + 1) * h;
    const r = seededRandom(i * 3 + 2) * 3 + 1;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Vegetation ─────────────────────────────────────────────

function drawVegetation(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  const midY = y + h / 2;
  // Trees in upper and lower regions, avoiding the lane center
  for (let i = 0; i < 30; i++) {
    const tx = x + seededRandom(i * 7 + 100) * w;
    const rawY = seededRandom(i * 7 + 101) * h;
    let ty = y + rawY;
    // Push away from center lane path
    const distFromCenter = Math.abs(ty - midY);
    if (distFromCenter < h * 0.2) {
      ty = ty < midY ? midY - h * 0.2 : midY + h * 0.2;
    }
    const size = 8 + seededRandom(i * 7 + 102) * 10;
    drawTree(ctx, tx, ty, size);
  }
}

// ── Lane Path ──────────────────────────────────────────────

function drawLanePath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  const points = getLanePathPoints(x, y, w, h);

  // Draw path shadow (wider, darker)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = COLORS.lanePathEdge;
  ctx.lineWidth = 48;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Draw path fill (narrower, lighter)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = COLORS.lanePath;
  ctx.lineWidth = 36;
  ctx.stroke();

  // Center line (subtle)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── Frontline Rift ─────────────────────────────────────────

function drawFrontlineRift(
  ctx: CanvasRenderingContext2D,
  frontline: number,
  x: number, y: number, w: number, h: number,
  time: number
): void {
  const center = getZoneCenterOnPath(frontline, x, y, w, h);

  // Animated glow offset
  const pulse = Math.sin(time * 0.003) * 0.3 + 0.7;

  // Vertical rift line
  const riftH = h * 0.5;
  const grad = ctx.createLinearGradient(center.x, center.y - riftH / 2, center.x, center.y + riftH / 2);
  grad.addColorStop(0, "rgba(45, 212, 191, 0)");
  grad.addColorStop(0.3, `rgba(45, 212, 191, ${0.4 * pulse})`);
  grad.addColorStop(0.5, `rgba(45, 212, 191, ${0.8 * pulse})`);
  grad.addColorStop(0.7, `rgba(45, 212, 191, ${0.4 * pulse})`);
  grad.addColorStop(1, "rgba(45, 212, 191, 0)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = COLORS.riftLight;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y - riftH / 2);
  ctx.lineTo(center.x, center.y + riftH / 2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Crossed swords icon at center
  drawCrossedSwords(ctx, center.x, center.y, 10);
}

function drawCrossedSwords(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.textGold;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  // Sword 1: top-left to bottom-right
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.stroke();

  // Sword 2: top-right to bottom-left
  ctx.beginPath();
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  // Guard crosspieces
  ctx.beginPath();
  ctx.moveTo(x - size * 0.3, y - size * 0.5);
  ctx.lineTo(x + size * 0.3, y - size * 0.9);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - size * 0.3, y - size * 0.9);
  ctx.lineTo(x + size * 0.3, y - size * 0.5);
  ctx.stroke();

  ctx.restore();
}

// ── Structures ─────────────────────────────────────────────

function drawStructures(
  ctx: CanvasRenderingContext2D,
  lane: LaneState,
  x: number, y: number, w: number, h: number
): void {
  // P1 Base (zone 0)
  const p1Base = getZoneCenterOnPath(0, x, y, w, h);
  drawBase(ctx, p1Base.x, p1Base.y, "PLAYER_1", lane.baseHp.player1, BASE_HP);

  // P1 Tower (zone 1)
  const p1Tower = getZoneCenterOnPath(1, x, y, w, h);
  drawTower(ctx, p1Tower.x, p1Tower.y, "PLAYER_1", lane.towerHp.player1, TOWER_HP);

  // P2 Tower (zone 5)
  const p2Tower = getZoneCenterOnPath(LANE_ZONE_COUNT - 2, x, y, w, h);
  drawTower(ctx, p2Tower.x, p2Tower.y, "PLAYER_2", lane.towerHp.player2, TOWER_HP);

  // P2 Base (zone 6)
  const p2Base = getZoneCenterOnPath(LANE_ZONE_COUNT - 1, x, y, w, h);
  drawBase(ctx, p2Base.x, p2Base.y, "PLAYER_2", lane.baseHp.player2, BASE_HP);
}

function drawBase(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  playerId: PlayerId,
  hp: number, maxHp: number
): void {
  const size = 28;
  const color = playerColorDark(playerId);
  const lightColor = playerColor(playerId);

  if (hp <= 0) {
    // Rubble
    drawRubble(ctx, cx, cy, size);
    return;
  }

  ctx.save();

  // Glow
  ctx.shadowBlur = 15;
  ctx.shadowColor = lightColor;

  // Hexagonal fortress shape
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3 - Math.PI / 6;
    const hx = cx + size * Math.cos(angle);
    const hy = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = lightColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner shape
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3 - Math.PI / 6;
    const hx = cx + size * 0.55 * Math.cos(angle);
    const hy = cy + size * 0.55 * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = lightColor;
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Damage cracks
  if (hp < maxHp) {
    const dmgPct = 1 - hp / maxHp;
    drawCracks(ctx, cx, cy, size, dmgPct);
  }

  ctx.restore();

  // HP bar below
  drawHpBar(ctx, cx - 22, cy + size + 4, 44, 6, hp, maxHp, false);

  // Label
  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.tiny;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BASE", cx, cy + size + 13);
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  playerId: PlayerId,
  hp: number, maxHp: number
): void {
  const crystalColor = playerId === "PLAYER_1" ? COLORS.towerCrystalP1 : COLORS.towerCrystalP2;

  if (hp <= 0) {
    drawRubble(ctx, cx, cy, 16);
    return;
  }

  ctx.save();

  // Base circle
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 14, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.towerStone;
  ctx.fill();
  ctx.strokeStyle = "#6a5a40";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Turret body (trapezoid)
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 8);
  ctx.lineTo(cx - 5, cy - 14);
  ctx.lineTo(cx + 5, cy - 14);
  ctx.lineTo(cx + 8, cy + 8);
  ctx.closePath();
  ctx.fillStyle = "#7a6a50";
  ctx.fill();
  ctx.strokeStyle = "#5a4a30";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Crystal at top
  ctx.shadowBlur = 12;
  ctx.shadowColor = crystalColor;
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 6, 0, Math.PI * 2);
  const crystalGrad = ctx.createRadialGradient(cx, cy - 16, 0, cx, cy - 16, 6);
  crystalGrad.addColorStop(0, "#fff");
  crystalGrad.addColorStop(0.5, crystalColor);
  crystalGrad.addColorStop(1, playerColorDark(playerId));
  ctx.fillStyle = crystalGrad;
  ctx.fill();

  // Damage cracks
  if (hp < maxHp) {
    ctx.shadowBlur = 0;
    drawCracks(ctx, cx, cy, 14, 1 - hp / maxHp);
  }

  ctx.restore();

  // HP bar
  drawHpBar(ctx, cx - 18, cy + 24, 36, 5, hp, maxHp, false);
}

function drawRubble(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number
): void {
  ctx.fillStyle = COLORS.rubble;
  for (let i = 0; i < 5; i++) {
    const rx = cx + (seededRandom(i * 13 + cx) - 0.5) * size * 1.2;
    const ry = cy + (seededRandom(i * 13 + cy) - 0.5) * size * 0.8;
    const rs = 2 + seededRandom(i * 13 + 50) * 4;
    ctx.beginPath();
    ctx.moveTo(rx, ry - rs);
    ctx.lineTo(rx + rs, ry + rs * 0.5);
    ctx.lineTo(rx - rs, ry + rs * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCracks(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  severity: number // 0-1
): void {
  const numCracks = Math.floor(severity * 4) + 1;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1;
  for (let i = 0; i < numCracks; i++) {
    const angle = seededRandom(i * 31 + cx) * Math.PI * 2;
    const len = size * (0.3 + severity * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const midX = cx + Math.cos(angle) * len * 0.5 + (seededRandom(i * 37) - 0.5) * 6;
    const midY = cy + Math.sin(angle) * len * 0.5 + (seededRandom(i * 41) - 0.5) * 6;
    ctx.lineTo(midX, midY);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
}

// ── Minions ────────────────────────────────────────────────

function drawMinions(
  ctx: CanvasRenderingContext2D,
  lane: LaneState,
  x: number, y: number, w: number, h: number
): void {
  for (let i = 0; i < LANE_ZONE_COUNT; i++) {
    const zone = lane.zones[i];
    const center = getZoneCenterOnPath(i, x, y, w, h);

    // P1 minions (above lane path)
    if (zone.minions.player1.count > 0) {
      drawMinionFormation(ctx, center.x - 15, center.y - 18, "PLAYER_1", zone.minions.player1.count);
    }

    // P2 minions (below lane path)
    if (zone.minions.player2.count > 0) {
      drawMinionFormation(ctx, center.x + 15, center.y + 18, "PLAYER_2", zone.minions.player2.count);
    }
  }
}

function drawMinionFormation(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  playerId: PlayerId,
  count: number
): void {
  const color = playerColor(playerId);
  const maxShow = 3;
  const show = Math.min(count, maxShow);

  // V-formation offset
  const positions = [
    { dx: 0, dy: 0 },
    { dx: -5, dy: -5 },
    { dx: 5, dy: -5 },
  ];

  for (let i = 0; i < show; i++) {
    const px = cx + positions[i].dx;
    const py = cy + positions[i].dy;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // +N indicator
  if (count > maxShow) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = FONT.tiny;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${count - maxShow}`, cx + 10, cy);
  }
}

// ── Champions ──────────────────────────────────────────────

function drawChampions(
  ctx: CanvasRenderingContext2D,
  lane: LaneState,
  players: [PlayerState, PlayerState],
  x: number, y: number, w: number, h: number
): void {
  for (let pi = 0; pi < 2; pi++) {
    const player = players[pi];
    const playerId = player.playerId;
    const champ = player.champions[0];
    if (!champ) continue;

    // Find which zone the champion is in
    let champZone = -1;
    for (let z = 0; z < LANE_ZONE_COUNT; z++) {
      if (lane.zones[z].championsPresent.includes(playerId)) {
        champZone = z;
        break;
      }
    }

    if (champZone < 0) continue;

    const center = getZoneCenterOnPath(champZone, x, y, w, h);
    // Offset slightly based on player
    const offsetY = pi === 0 ? -4 : 4;
    const cx2 = center.x;
    const cy2 = center.y + offsetY;

    if (!champ.isAlive) {
      drawDeadChampion(ctx, cx2, cy2, playerId);
      continue;
    }

    const color = playerColor(playerId);
    const initial = champ.name.charAt(0).toUpperCase();

    ctx.save();

    // Glow aura
    ctx.beginPath();
    ctx.arc(cx2, cy2, 18, 0, Math.PI * 2);
    ctx.fillStyle = `${color}33`;
    ctx.fill();

    // Main circle
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(cx2, cy2, 12, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Initial letter
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, cx2, cy2);

    ctx.restore();

    // Small HP bar
    drawHpBar(ctx, cx2 - 14, cy2 + 15, 28, 4, champ.currentHp, champ.maxHp, false);
  }
}

function drawDeadChampion(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  playerId: PlayerId
): void {
  ctx.save();
  ctx.globalAlpha = 0.4;

  // Gray circle
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = "#444";
  ctx.fill();
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.stroke();

  // X mark
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.moveTo(cx + 5, cy - 5);
  ctx.lineTo(cx - 5, cy + 5);
  ctx.stroke();

  ctx.restore();
}
