import { PlanningCard } from "../../types/card.js";
import { MINION_SPAWN_COST } from "../../types/constants.js";
import { COLORS, stanceColor } from "../utils/colors.js";
import { roundRect, drawGoldIcon, FONT } from "../utils/draw.js";

export interface ButtonDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: () => void;
}

// ── Card Hand Renderer ─────────────────────────────────────

export function renderCardHand(
  ctx: CanvasRenderingContext2D,
  hand: PlanningCard[],
  selectedIndex: number,
  area: { x: number; y: number; w: number; h: number },
  onSelect: (index: number) => void
): ButtonDef[] {
  const { x, y, w, h } = area;
  const buttons: ButtonDef[] = [];

  const cardW = 130;
  const cardH = Math.min(h - 10, 170);
  const gap = 10;
  const totalCardsW = hand.length * cardW + (hand.length - 1) * gap;
  const startX = x + (w - totalCardsW) / 2;
  const cardY = y + 5;

  hand.forEach((card, i) => {
    const cx = startX + i * (cardW + gap);
    const isSelected = i === selectedIndex;

    renderCard(ctx, card, cx, cardY, cardW, cardH, isSelected, i);

    buttons.push({
      x: cx, y: cardY, w: cardW, h: cardH,
      label: "",
      action: () => onSelect(i),
    });
  });

  return buttons;
}

function renderCard(
  ctx: CanvasRenderingContext2D,
  card: PlanningCard,
  x: number, y: number, w: number, h: number,
  isSelected: boolean,
  index: number
): void {
  const sColor = stanceColor(card.stance);

  ctx.save();

  // Selection glow
  if (isSelected) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.cardSelectedBorder;
  }

  // Card background
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = isSelected ? COLORS.cardSelected : COLORS.cardBg;
  ctx.fill();

  // Border
  ctx.strokeStyle = isSelected ? COLORS.cardSelectedBorder : COLORS.cardBorder;
  ctx.lineWidth = isSelected ? 2 : 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Stance banner (gradient)
  ctx.save();
  roundRect(ctx, x, y, w, 24, 8);
  ctx.clip();
  ctx.fillRect(x, y + 12, w, 12); // square off bottom
  const bannerGrad = ctx.createLinearGradient(x, y, x, y + 24);
  bannerGrad.addColorStop(0, sColor);
  bannerGrad.addColorStop(1, adjustBrightness(sColor, -30));
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(x, y, w, 24);
  ctx.restore();

  // Stance text
  ctx.fillStyle = "#fff";
  ctx.font = FONT.smallBold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(card.stance, x + w / 2, y + 12);

  // Card name
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT.bodyBold;
  ctx.textBaseline = "top";
  const nameLines = wrapText(card.name, Math.floor(w / 8));
  nameLines.forEach((line, li) => {
    ctx.fillText(line, x + w / 2, y + 32 + li * 16);
  });

  // Effects
  ctx.font = FONT.small;
  const effectY = y + 32 + nameLines.length * 16 + 8;
  if (card.effects.length > 0) {
    card.effects.forEach((eff, ei) => {
      const effectColor = getEffectColor(eff.type);
      const label = formatEffectType(eff.type);

      // Small colored dot
      ctx.fillStyle = effectColor;
      ctx.beginPath();
      ctx.arc(x + w / 2 - 40, effectY + ei * 18 + 5, 4, 0, Math.PI * 2);
      ctx.fill();

      // Effect text
      ctx.fillStyle = COLORS.textDim;
      ctx.textAlign = "left";
      ctx.fillText(`+${eff.value} ${label}`, x + w / 2 - 32, effectY + ei * 18);
    });
  } else {
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = "center";
    ctx.fillText("(no bonus)", x + w / 2, effectY);
  }

  // Card index badge
  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.tiny;
  ctx.textAlign = "center";
  ctx.fillText(`[${index + 1}]`, x + w / 2, y + h - 10);

  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

// ── Spawn Controls ─────────────────────────────────────────

export function renderSpawnControls(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spawnCount: number,
  maxSpawns: number,
  gold: number,
  onMinus: () => void,
  onPlus: () => void
): ButtonDef[] {
  const buttons: ButtonDef[] = [];

  // Label
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Spawn Minions:", x, y + 12);

  // Minion silhouettes
  const silX = x + 120;
  for (let i = 0; i < 3; i++) {
    const sx = silX + i * 22;
    const filled = i < spawnCount;

    // Small circle (head) + body
    ctx.beginPath();
    ctx.arc(sx, y + 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = filled ? COLORS.text : "transparent";
    ctx.fill();
    ctx.strokeStyle = filled ? COLORS.text : COLORS.textDim;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Body line
    ctx.beginPath();
    ctx.moveTo(sx, y + 11);
    ctx.lineTo(sx, y + 18);
    ctx.strokeStyle = filled ? COLORS.text : COLORS.textDim;
    ctx.stroke();
  }

  // - button
  const minusBtnX = silX + 80;
  buttons.push(renderSmallButton(ctx, minusBtnX, y, 24, 24, "-", spawnCount > 0, onMinus));

  // Count
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = "center";
  ctx.fillText(`${spawnCount}`, minusBtnX + 36, y + 12);

  // + button
  buttons.push(renderSmallButton(ctx, minusBtnX + 48, y, 24, 24, "+", spawnCount < maxSpawns, onPlus));

  // Cost
  const costX = minusBtnX + 86;
  drawGoldIcon(ctx, costX, y + 12, 6);
  ctx.fillStyle = COLORS.textGold;
  ctx.font = FONT.small;
  ctx.textAlign = "left";
  ctx.fillText(`${spawnCount * MINION_SPAWN_COST}`, costX + 10, y + 12);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = FONT.tiny;
  ctx.fillText(`(max ${maxSpawns})`, costX + 30, y + 12);

  ctx.textBaseline = "alphabetic";

  return buttons;
}

function renderSmallButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string,
  enabled: boolean,
  action: () => void
): ButtonDef {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = enabled ? "#2a3a4a" : "#1a1a2a";
  ctx.fill();
  ctx.strokeStyle = enabled ? "#4a5a6a" : "#2a2a3a";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 4);
  ctx.stroke();

  ctx.fillStyle = enabled ? COLORS.text : COLORS.textDim;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);

  return { x, y, w, h, label, action: enabled ? action : () => {} };
}

// ── Action Button ──────────────────────────────────────────

export function renderActionButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string,
  action: () => void
): ButtonDef {
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = COLORS.button;

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "#3a8a4a");
  grad.addColorStop(1, COLORS.button);

  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = COLORS.buttonBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.fillStyle = COLORS.buttonText;
  ctx.font = FONT.subtitle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);

  ctx.textBaseline = "alphabetic";
  ctx.restore();

  return { x, y, w, h, label, action };
}

// ── Helpers ────────────────────────────────────────────────

function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxLen) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function getEffectColor(type: string): string {
  switch (type) {
    case "BONUS_MINIONS": return "#4a9a4a";
    case "BONUS_GOLD": return COLORS.textGold;
    case "MINION_DAMAGE_BOOST": return "#d04040";
    case "TOWER_DAMAGE_REDUCTION": return "#3080c0";
    case "SCOUT_REVEAL": return "#9060c0";
    case "FORTIFY_MINIONS": return "#40a0a0";
    default: return COLORS.textDim;
  }
}

function formatEffectType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c);
}

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
