import { BattleState, BattleChampion } from "../../types/battle.js";
import { BattleMinion } from "../../types/minion.js";
import { ActionType, HexTerrain } from "../../types/enums.js";
import { BATTLE_GRID_WIDTH, BATTLE_GRID_HEIGHT } from "../../types/constants.js";
import { COLORS, playerColor, playerColorDark } from "../utils/colors.js";
import { drawHexagon, hexToPixel, drawHpBar, drawEnergyPips, roundRect, drawPanel, FONT } from "../utils/draw.js";
import { BattleFrame } from "../game-controller.js";
import { renderActionButton, ButtonDef } from "./card-hand.js";

const HEX_RADIUS = 36;

// ── Main Battle View Renderer ──────────────────────────────

export function renderBattleView(
  ctx: CanvasRenderingContext2D,
  frames: BattleFrame[],
  currentFrameIndex: number,
  area: { x: number; y: number; w: number; h: number },
  time: number
): ButtonDef[] {
  const { x, y, w, h } = area;
  const buttons: ButtonDef[] = [];
  const frame = frames[currentFrameIndex];
  if (!frame) return buttons;

  const battle = frame.battleState;

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, w, h);

  // Grid dimensions
  const gridW = BATTLE_GRID_WIDTH * HEX_RADIUS * Math.sqrt(3);
  const gridH = BATTLE_GRID_HEIGHT * HEX_RADIUS * 1.5 + HEX_RADIUS * 0.5;
  const originX = x + (w - gridW) / 2 + HEX_RADIUS * Math.sqrt(3) / 2;
  const originY = y + 70 + HEX_RADIUS;

  // Dark overlay behind grid
  ctx.fillStyle = "rgba(10, 10, 20, 0.7)";
  roundRect(ctx, originX - HEX_RADIUS, originY - HEX_RADIUS, gridW + HEX_RADIUS, gridH + HEX_RADIUS, 12);
  ctx.fill();

  // ── Render hex grid ──
  renderHexGrid(ctx, battle, originX, originY, frame.action?.actorId ?? null, time);

  // ── Render units ──
  renderBattleUnits(ctx, battle, originX, originY, frame.action?.actorId ?? null, time);

  // ── Action description ──
  if (frame.action) {
    renderActionDescription(ctx, frame.action.description, x, y + 10, w);
  } else {
    // Initial state
    ctx.fillStyle = COLORS.textGold;
    ctx.font = FONT.subtitle;
    ctx.textAlign = "center";
    ctx.fillText("Battle begins!", x + w / 2, y + 30);
  }

  // ── Round indicator ──
  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.small;
  ctx.textAlign = "left";
  ctx.fillText(`Round ${battle.roundNumber}`, x + 10, y + 20);

  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = "right";
  ctx.fillText(`${currentFrameIndex + 1}/${frames.length}`, x + w - 10, y + 20);

  return buttons;
}

// ── Hex Grid ───────────────────────────────────────────────

function renderHexGrid(
  ctx: CanvasRenderingContext2D,
  battle: BattleState,
  originX: number, originY: number,
  activeUnitId: string | null,
  time: number
): void {
  for (let r = 0; r < BATTLE_GRID_HEIGHT; r++) {
    for (let q = 0; q < BATTLE_GRID_WIDTH; q++) {
      const key = `${q},${r}`;
      const cell = battle.grid.cells.get(key);
      if (!cell) continue;

      const { x: hx, y: hy } = hexToPixel(q, r, HEX_RADIUS, originX, originY);

      // Hex fill based on terrain
      drawHexagon(ctx, hx, hy, HEX_RADIUS - 1);
      ctx.fillStyle = getTerrainColor(cell.terrain);
      ctx.fill();

      // Team tint
      if (q <= 2) {
        drawHexagon(ctx, hx, hy, HEX_RADIUS - 1);
        ctx.fillStyle = COLORS.hexP1Tint;
        ctx.fill();
      } else if (q >= 4) {
        drawHexagon(ctx, hx, hy, HEX_RADIUS - 1);
        ctx.fillStyle = COLORS.hexP2Tint;
        ctx.fill();
      }

      // Active unit highlight
      if (cell.occupantId && cell.occupantId === activeUnitId) {
        const pulse = 0.3 + Math.sin(time * 0.005) * 0.15;
        drawHexagon(ctx, hx, hy, HEX_RADIUS - 1);
        ctx.fillStyle = `rgba(240, 192, 32, ${pulse})`;
        ctx.fill();
      }

      // Hex border
      drawHexagon(ctx, hx, hy, HEX_RADIUS - 1);
      ctx.strokeStyle = COLORS.hexBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Coordinate label (subtle)
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.font = FONT.tiny;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${q},${r}`, hx, hy + HEX_RADIUS - 6);
    }
  }
}

function getTerrainColor(terrain: HexTerrain): string {
  switch (terrain) {
    case HexTerrain.Open: return COLORS.hexBg;
    case HexTerrain.Blocked: return "#1a1a1a";
    case HexTerrain.Bush: return "#1a3a1a";
    case HexTerrain.HighGround: return "#3a4a3a";
  }
}

// ── Battle Units ───────────────────────────────────────────

function renderBattleUnits(
  ctx: CanvasRenderingContext2D,
  battle: BattleState,
  originX: number, originY: number,
  activeUnitId: string | null,
  time: number
): void {
  // Render minions first (below champions visually)
  for (const minion of battle.minions) {
    if (!minion.isAlive) continue;
    const { x: hx, y: hy } = hexToPixel(
      minion.position.q, minion.position.r,
      HEX_RADIUS, originX, originY
    );
    renderBattleMinion(ctx, minion, hx, hy, minion.minionId === activeUnitId, time);
  }

  // Render champions
  for (const bc of battle.champions) {
    if (!bc.championRef.isAlive) continue;
    const pos = bc.championRef.battlePosition;
    if (!pos) continue;
    const { x: hx, y: hy } = hexToPixel(pos.q, pos.r, HEX_RADIUS, originX, originY);
    renderBattleChampion(ctx, bc, hx, hy, bc.championRef.championId === activeUnitId, time);
  }
}

function renderBattleChampion(
  ctx: CanvasRenderingContext2D,
  bc: BattleChampion,
  cx: number, cy: number,
  isActive: boolean,
  time: number
): void {
  const champ = bc.championRef;
  const color = playerColor(champ.ownerId);
  const initial = champ.name.charAt(0).toUpperCase();

  ctx.save();

  // Active glow ring
  if (isActive) {
    const pulse = 0.5 + Math.sin(time * 0.006) * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(240, 192, 32, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Champion circle
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Initial
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, cx, cy);

  ctx.restore();

  // HP bar below
  drawHpBar(ctx, cx - 16, cy + 17, 32, 5, champ.currentHp, champ.maxHp, false);

  // Energy pips
  drawEnergyPips(ctx, cx - champ.maxEnergy * 4, cy + 24, champ.currentEnergy, champ.maxEnergy, 4);

  // Status effects
  renderStatusIcons(ctx, champ.statusEffects, cx + 16, cy - 16);
}

function renderBattleMinion(
  ctx: CanvasRenderingContext2D,
  minion: BattleMinion,
  cx: number, cy: number,
  isActive: boolean,
  time: number
): void {
  const color = playerColor(minion.ownerId);

  // Active ring
  if (isActive) {
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.hexHighlight;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Minion circle
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // HP line below
  const hpPct = minion.maxHp > 0 ? minion.hp / minion.maxHp : 0;
  const barW = 14;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(cx - barW / 2, cy + 9, barW, 2);
  if (hpPct > 0) {
    ctx.fillStyle = hpPct > 0.5 ? COLORS.hpHigh : COLORS.hpLow;
    ctx.fillRect(cx - barW / 2, cy + 9, barW * hpPct, 2);
  }
}

function renderStatusIcons(
  ctx: CanvasRenderingContext2D,
  effects: { type: string; remainingDuration: number }[],
  x: number, y: number
): void {
  effects.forEach((eff, i) => {
    const sx = x + i * 10;
    let color: string;
    switch (eff.type) {
      case "STUN": color = "#f0c020"; break;
      case "SLOW": color = "#6090d0"; break;
      case "SHIELD": color = COLORS.shield; break;
      case "BUFF_ATTACK": color = "#d04040"; break;
      case "DEBUFF_ARMOR": color = "#804080"; break;
      default: color = COLORS.textDim;
    }
    ctx.fillStyle = color;
    ctx.fillRect(sx, y, 7, 7);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx, y, 7, 7);
  });
}

// ── Action Description ─────────────────────────────────────

function renderActionDescription(
  ctx: CanvasRenderingContext2D,
  description: string,
  x: number, y: number, w: number
): void {
  // Background pill
  const textW = ctx.measureText(description).width + 40;
  const pillX = x + (w - textW) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, pillX, y, textW, 26, 13);
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = FONT.body;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(description, x + w / 2, y + 13);
  ctx.textBaseline = "alphabetic";
}

// ── Battle Result Overlay ──────────────────────────────────

export function renderBattleResult(
  ctx: CanvasRenderingContext2D,
  frames: BattleFrame[],
  area: { x: number; y: number; w: number; h: number },
  onContinue: () => void
): ButtonDef[] {
  const { x, y, w, h } = area;
  const buttons: ButtonDef[] = [];
  const lastFrame = frames[frames.length - 1];
  if (!lastFrame) return buttons;

  const battle = lastFrame.battleState;
  const outcome = battle.outcome;

  // Semi-transparent overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(x, y, w, h);

  // Result panel
  const panelW = 400;
  const panelH = 220;
  const panelX = x + (w - panelW) / 2;
  const panelY = y + (h - panelH) / 2 - 20;

  drawPanel(ctx, panelX, panelY, panelW, panelH, COLORS.textGold, 12);

  // Title
  ctx.fillStyle = COLORS.textGold;
  ctx.font = FONT.title;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BATTLE COMPLETE", panelX + panelW / 2, panelY + 15);

  // Winner
  if (outcome) {
    const winnerText = outcome.winner
      ? `${outcome.winner === "PLAYER_1" ? "Player 1" : "Player 2"} wins!`
      : "Draw!";
    const winnerColor = outcome.winner
      ? playerColor(outcome.winner)
      : COLORS.textDim;

    ctx.fillStyle = winnerColor;
    ctx.font = FONT.subtitle;
    ctx.fillText(winnerText, panelX + panelW / 2, panelY + 50);

    // Stats
    ctx.fillStyle = COLORS.text;
    ctx.font = FONT.body;
    let statY = panelY + 80;

    if (outcome.championDeaths.length > 0) {
      ctx.fillText(
        `Champion killed: ${outcome.championDeaths.map(p => p === "PLAYER_1" ? "P1" : "P2").join(", ")}`,
        panelX + panelW / 2, statY
      );
      statY += 20;
    }

    ctx.fillText(
      `Lane push: +${outcome.lanePushBonus} zones`,
      panelX + panelW / 2, statY
    );
    statY += 20;

    ctx.fillStyle = COLORS.textGold;
    ctx.fillText(
      `Gold: P1 +${outcome.goldAwarded.PLAYER_1} | P2 +${outcome.goldAwarded.PLAYER_2}`,
      panelX + panelW / 2, statY
    );
    statY += 20;

    ctx.fillStyle = COLORS.energy;
    ctx.fillText(
      `XP: P1 +${outcome.xpAwarded.PLAYER_1} | P2 +${outcome.xpAwarded.PLAYER_2}`,
      panelX + panelW / 2, statY
    );
  }

  ctx.textBaseline = "alphabetic";

  // Continue button
  buttons.push(renderActionButton(
    ctx,
    panelX + panelW / 2 - 70, panelY + panelH - 50,
    140, 36, "Continue", onContinue
  ));

  return buttons;
}

// ── Action Effect Animations ───────────────────────────────

export function renderActionEffect(
  ctx: CanvasRenderingContext2D,
  frame: BattleFrame,
  progress: number,  // 0-1 within the action animation
  originX: number, originY: number
): void {
  if (!frame.action) return;

  const { actionType, actorId, targetId } = frame.action;
  const battle = frame.battleState;

  // Find actor position
  const actorPos = findUnitPixelPos(actorId, battle, originX, originY);
  if (!actorPos) return;

  if (actionType === ActionType.Attack && targetId) {
    const targetPos = findUnitPixelPos(targetId, battle, originX, originY);
    if (targetPos) {
      // Slash line from actor to target
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff4040";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(actorPos.x, actorPos.y);
      ctx.lineTo(
        actorPos.x + (targetPos.x - actorPos.x) * progress,
        actorPos.y + (targetPos.y - actorPos.y) * progress
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  if (actionType === ActionType.Ability && targetId) {
    const targetPos = findUnitPixelPos(targetId, battle, originX, originY);
    if (targetPos) {
      // Expanding circle at target
      const radius = 10 + progress * 20;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.textGold;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

function findUnitPixelPos(
  unitId: string,
  battle: BattleState,
  originX: number, originY: number
): { x: number; y: number } | null {
  // Check champions
  for (const bc of battle.champions) {
    if (bc.championRef.championId === unitId && bc.championRef.battlePosition) {
      return hexToPixel(
        bc.championRef.battlePosition.q,
        bc.championRef.battlePosition.r,
        HEX_RADIUS, originX, originY
      );
    }
  }
  // Check minions
  for (const m of battle.minions) {
    if (m.minionId === unitId && m.isAlive) {
      return hexToPixel(m.position.q, m.position.r, HEX_RADIUS, originX, originY);
    }
  }
  return null;
}
