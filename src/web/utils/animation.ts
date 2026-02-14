// ── Easing Functions ───────────────────────────────────────

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// ── Floating Text (damage numbers, etc.) ───────────────────

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  startTime: number;
  duration: number;
}

const activeFloats: FloatingText[] = [];

export function spawnFloatingText(
  text: string, x: number, y: number,
  color: string, duration: number = 800
): void {
  activeFloats.push({ text, x, y, color, startTime: performance.now(), duration });
}

export function renderFloatingTexts(ctx: CanvasRenderingContext2D, now: number): void {
  for (let i = activeFloats.length - 1; i >= 0; i--) {
    const ft = activeFloats[i];
    const elapsed = now - ft.startTime;
    const t = elapsed / ft.duration;
    if (t >= 1) {
      activeFloats.splice(i, 1);
      continue;
    }

    const alpha = 1 - easeOutQuad(t);
    const yOffset = -30 * easeOutQuad(t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ft.text, ft.x, ft.y + yOffset);
    ctx.restore();
  }
}

// ── View Transition State ──────────────────────────────────

export type ViewMode =
  | "STRATEGIC"
  | "TRANSITION_TO_BATTLE"
  | "BATTLE"
  | "TRANSITION_TO_STRATEGIC";

export interface TransitionState {
  mode: ViewMode;
  startTime: number;
  duration: number;
  // For zoom transition: the x,y position on the strategic map to zoom toward
  focusX: number;
  focusY: number;
}

export function createTransition(
  mode: ViewMode,
  now: number,
  duration: number,
  focusX: number,
  focusY: number
): TransitionState {
  return { mode, startTime: now, duration, focusX, focusY };
}

export function getTransitionProgress(trans: TransitionState, now: number): number {
  const elapsed = now - trans.startTime;
  return clamp01(elapsed / trans.duration);
}
