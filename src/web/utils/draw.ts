import { COLORS, hpColor } from "./colors.js";

// ── Fonts ──────────────────────────────────────────────────

export const FONT = {
  title: "bold 20px 'Segoe UI', Arial, sans-serif",
  subtitle: "bold 14px 'Segoe UI', Arial, sans-serif",
  body: "13px 'Segoe UI', Arial, sans-serif",
  bodyBold: "bold 13px 'Segoe UI', Arial, sans-serif",
  small: "11px 'Segoe UI', Arial, sans-serif",
  smallBold: "bold 11px 'Segoe UI', Arial, sans-serif",
  tiny: "9px 'Segoe UI', Arial, sans-serif",
  damage: "bold 16px 'Segoe UI', Arial, sans-serif",
  mono: "12px monospace",
  monoBold: "bold 12px monospace",
};

// ── Shape Drawing ──────────────────────────────────────────

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  current: number, max: number,
  showText = true
): void {
  const pct = max > 0 ? current / max : 0;

  // Background
  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();

  // Fill
  if (pct > 0) {
    ctx.fillStyle = hpColor(pct);
    roundRect(ctx, x, y, w * pct, h, h / 2);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.stroke();

  // Text
  if (showText && h >= 10) {
    ctx.fillStyle = COLORS.text;
    ctx.font = h >= 14 ? FONT.small : FONT.tiny;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${current}/${max}`, x + w / 2, y + h / 2);
  }
}

export function drawEnergyPips(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  current: number, max: number,
  size: number = 6
): void {
  for (let i = 0; i < max; i++) {
    const px = x + i * (size + 3);
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(px + size / 2, y);
    ctx.lineTo(px + size, y + size / 2);
    ctx.lineTo(px + size / 2, y + size);
    ctx.lineTo(px, y + size / 2);
    ctx.closePath();

    if (i < current) {
      ctx.fillStyle = COLORS.energy;
      ctx.fill();
    }
    ctx.strokeStyle = i < current ? "#2080b0" : "#333";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawGoldIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number = 7
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.gold;
  ctx.fill();
  ctx.strokeStyle = "#b08a10";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#806008";
  ctx.font = `bold ${radius}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", x, y + 1);
}

// ── Hexagon Drawing ────────────────────────────────────────

export function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * Math.PI / 3; // pointy-top
    const hx = cx + radius * Math.cos(angle);
    const hy = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

export function hexToPixel(
  q: number, r: number,
  radius: number,
  originX: number, originY: number
): { x: number; y: number } {
  const xSpacing = radius * Math.sqrt(3);
  const ySpacing = radius * 1.5;
  const x = originX + q * xSpacing + (r % 2) * (xSpacing / 2);
  const y = originY + r * ySpacing;
  return { x, y };
}

// ── Panel / Gradient helpers ───────────────────────────────

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  borderColor: string = COLORS.panelBorder,
  r: number = 6
): void {
  // Gradient background
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, COLORS.panel);
  grad.addColorStop(1, "#080810");
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.max(w, h) * 0.7;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

// ── Text helpers ───────────────────────────────────────────

export function wordWrap(text: string, maxLen: number): string[] {
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

// ── Tree drawing ───────────────────────────────────────────

export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number
): void {
  // Trunk
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.fillRect(x - size * 0.1, y, size * 0.2, size * 0.4);

  // Canopy
  ctx.beginPath();
  ctx.arc(x, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.treeDark;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - size * 0.1, y - size * 0.2, size * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.treeLight;
  ctx.fill();
}
