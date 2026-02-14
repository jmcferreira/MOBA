import { GameState, PlayerState } from "../../types/game-state.js";
import { PlayerId, ChampionRole } from "../../types/enums.js";
import { COLORS, playerColor, playerColorDark } from "../utils/colors.js";
import { drawPanel, drawHpBar, drawEnergyPips, drawGoldIcon, roundRect, FONT, wordWrap } from "../utils/draw.js";
import { GamePhase } from "../game-controller.js";

// ── Player HUD Panel ───────────────────────────────────────

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  phase: GamePhase,
  area: { x: number; y: number; w: number; h: number }
): void {
  const { x, y, w, h } = area;

  // P1 panel (left)
  renderPlayerPanel(ctx, gs.players[0], x, y, w * 0.38, h);

  // Turn indicator (center)
  renderTurnIndicator(ctx, gs.turnNumber, phase, x + w * 0.38, y, w * 0.24, h);

  // P2 panel (right)
  renderPlayerPanel(ctx, gs.players[1], x + w * 0.62, y, w * 0.38, h);
}

function renderPlayerPanel(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  x: number, y: number, w: number, h: number
): void {
  const color = playerColor(player.playerId);
  const darkColor = playerColorDark(player.playerId);

  drawPanel(ctx, x, y, w, h, darkColor);

  const champ = player.champions[0];
  if (!champ) return;

  const isP1 = player.playerId === "PLAYER_1";
  const pad = 10;

  // Champion portrait circle
  const portraitR = 18;
  const portraitX = isP1 ? x + pad + portraitR : x + w - pad - portraitR;
  const portraitY = y + h / 2;

  ctx.beginPath();
  ctx.arc(portraitX, portraitY, portraitR, 0, Math.PI * 2);
  ctx.fillStyle = darkColor;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Role icon inside portrait
  drawRoleIcon(ctx, portraitX, portraitY, champ.role, color);

  // Player label
  const textX = isP1 ? portraitX + portraitR + 10 : x + pad;
  const textEndX = isP1 ? x + w - pad : portraitX - portraitR - 10;
  const textW = textEndX - textX;

  ctx.textAlign = isP1 ? "left" : "right";
  const textAnchor = isP1 ? textX : textEndX;

  // Player name
  ctx.fillStyle = color;
  ctx.font = FONT.subtitle;
  ctx.textBaseline = "top";
  ctx.fillText(isP1 ? "PLAYER 1" : "PLAYER 2", textAnchor, y + 6);

  // Champion name + level
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT.body;
  ctx.fillText(`${champ.name} Lv${champ.level}`, textAnchor, y + 22);

  if (!champ.isAlive) {
    ctx.fillStyle = COLORS.hpLow;
    ctx.font = FONT.smallBold;
    ctx.fillText("DEAD", textAnchor, y + 38);
  } else {
    // HP bar - positioned based on alignment
    const hpBarW = Math.min(textW, 120);
    const hpBarX = isP1 ? textX : textEndX - hpBarW;
    drawHpBar(ctx, hpBarX, y + 38, hpBarW, 10, champ.currentHp, champ.maxHp);

    // Energy pips
    const energyX = isP1 ? textX : textEndX - champ.maxEnergy * 9;
    drawEnergyPips(ctx, energyX, y + 52, champ.currentEnergy, champ.maxEnergy, 5);
  }

  // Gold (far side)
  const goldX = isP1 ? x + w - pad - 30 : x + pad + 10;
  drawGoldIcon(ctx, goldX, y + 14, 7);
  ctx.fillStyle = COLORS.textGold;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = isP1 ? "left" : "right";
  ctx.fillText(`${player.gold}`, isP1 ? goldX + 12 : goldX - 12, y + 10);

  // Hand count
  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.small;
  ctx.fillText(`Cards: ${player.hand.length}`, isP1 ? goldX + 12 : goldX - 12, y + 26);

  // Reset text baseline
  ctx.textBaseline = "alphabetic";
}

function drawRoleIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  role: ChampionRole,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  switch (role) {
    case ChampionRole.Tank:
      // Shield shape
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 8, cy - 5);
      ctx.lineTo(cx + 8, cy + 3);
      ctx.lineTo(cx, cy + 10);
      ctx.lineTo(cx - 8, cy + 3);
      ctx.lineTo(cx - 8, cy - 5);
      ctx.closePath();
      ctx.stroke();
      break;

    case ChampionRole.Mage:
      // Flame
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.quadraticCurveTo(cx + 8, cy - 4, cx + 4, cy + 2);
      ctx.quadraticCurveTo(cx + 6, cy + 6, cx, cy + 10);
      ctx.quadraticCurveTo(cx - 6, cy + 6, cx - 4, cy + 2);
      ctx.quadraticCurveTo(cx - 8, cy - 4, cx, cy - 10);
      ctx.stroke();
      break;

    case ChampionRole.Fighter:
      // Sword
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 5);
      ctx.moveTo(cx - 6, cy - 3);
      ctx.lineTo(cx + 6, cy - 3);
      ctx.stroke();
      break;

    case ChampionRole.Assassin:
      // Dagger
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy - 8);
      ctx.lineTo(cx - 6, cy + 8);
      ctx.moveTo(cx - 3, cy - 2);
      ctx.lineTo(cx + 3, cy + 2);
      ctx.stroke();
      break;

    case ChampionRole.Support:
      // Cross
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.moveTo(cx - 6, cy);
      ctx.lineTo(cx + 6, cy);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

// ── Turn Indicator ─────────────────────────────────────────

function renderTurnIndicator(
  ctx: CanvasRenderingContext2D,
  turn: number,
  phase: GamePhase,
  x: number, y: number, w: number, h: number
): void {
  const cx = x + w / 2;
  const cy = y + h / 2 - 4;

  // Decorative frame lines
  ctx.strokeStyle = COLORS.textGold;
  ctx.lineWidth = 1;

  // Left line
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy);
  ctx.lineTo(cx - 30, cy);
  ctx.stroke();

  // Right line
  ctx.beginPath();
  ctx.moveTo(cx + 30, cy);
  ctx.lineTo(cx + 70, cy);
  ctx.stroke();

  // Diamond endpoints
  const diamondSize = 3;
  for (const dx of [-70, 70]) {
    ctx.fillStyle = COLORS.textGold;
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - diamondSize);
    ctx.lineTo(cx + dx + diamondSize, cy);
    ctx.lineTo(cx + dx, cy + diamondSize);
    ctx.lineTo(cx + dx - diamondSize, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Turn text
  ctx.fillStyle = COLORS.textGold;
  ctx.font = FONT.title;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`TURN ${turn}`, cx, cy);

  // Phase label below
  const phaseLabel =
    phase === "P1_PLANNING" ? "Player 1 Planning" :
    phase === "P2_PLANNING" ? "Player 2 Planning" :
    phase === "BATTLE_REPLAY" ? "BATTLE" :
    phase === "GAME_OVER" ? "GAME OVER" :
    "Resolving...";

  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.small;
  ctx.fillText(phaseLabel, cx, cy + 18);
  ctx.textBaseline = "alphabetic";
}

// ── Message Bar ────────────────────────────────────────────

export function renderMessageBar(
  ctx: CanvasRenderingContext2D,
  message: string,
  x: number, y: number, w: number, h: number
): void {
  // Background strip
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x, y, w, h);

  // Message text
  ctx.fillStyle = COLORS.textGold;
  ctx.font = FONT.body;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wordWrap(message, Math.floor(w / 8));
  const lineH = 16;
  const startY = y + h / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, startY + i * lineH);
  });
  ctx.textBaseline = "alphabetic";
}
