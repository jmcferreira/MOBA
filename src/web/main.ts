import { GameController, GamePhase } from "./game-controller.js";
import { PlayerId } from "../types/enums.js";
import { COLORS } from "./utils/colors.js";
import { FONT } from "./utils/draw.js";
import { ViewMode, TransitionState, createTransition, getTransitionProgress, easeOutCubic, lerp, renderFloatingTexts } from "./utils/animation.js";
import { renderStrategicMap } from "./renderers/strategic-map.js";
import { renderHUD, renderMessageBar } from "./renderers/hud.js";
import { renderCardHand, renderSpawnControls, renderActionButton, ButtonDef } from "./renderers/card-hand.js";
import { renderBattleView, renderBattleResult, renderActionEffect } from "./renderers/battle-view.js";

// ── Constants ──────────────────────────────────────────────

const W = 1200;
const H = 800;

// Layout regions
const LAYOUT = {
  hud: { x: 10, y: 5, w: W - 20, h: 65 },
  map: { x: 20, y: 75, w: W - 40, h: 340 },
  message: { x: 20, y: 420, w: W - 40, h: 30 },
  cards: { x: 20, y: 455, w: W - 40, h: 195 },
  bottom: { x: 20, y: 655, w: W - 40, h: 30 },
};

// ── State ──────────────────────────────────────────────────

const controller = new GameController();
let selectedCardIndex = -1;
let spawnCount = 0;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let buttons: ButtonDef[] = [];
let mouseX = 0;
let mouseY = 0;

// View state
let viewMode: ViewMode = "STRATEGIC";
let transition: TransitionState | null = null;
let lastTimestamp = 0;

// Battle replay state
let battleFrameIndex = 0;
let battleAutoPlayTimer = 0;
let battleShowResult = false;
const BATTLE_FRAME_DURATION = 1500; // ms per frame

// ── Init ───────────────────────────────────────────────────

function init() {
  canvas = document.getElementById("game") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);

  canvas.addEventListener("click", handleClick);
  canvas.addEventListener("mousemove", handleMouseMove);

  requestAnimationFrame(gameLoop);
}

// ── Game Loop ──────────────────────────────────────────────

function gameLoop(timestamp: number) {
  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  update(timestamp, dt);
  render(timestamp);

  requestAnimationFrame(gameLoop);
}

function update(now: number, dt: number) {
  const ui = controller.getUIState();

  // Handle transition to battle view
  if (ui.phase === "BATTLE_REPLAY" && viewMode === "STRATEGIC") {
    viewMode = "TRANSITION_TO_BATTLE";
    transition = createTransition("TRANSITION_TO_BATTLE", now, 1500, W / 2, LAYOUT.map.y + LAYOUT.map.h / 2);
    battleFrameIndex = 0;
    battleAutoPlayTimer = 0;
    battleShowResult = false;
  }

  // Handle transition progress
  if (transition) {
    const progress = getTransitionProgress(transition, now);
    if (progress >= 1) {
      if (transition.mode === "TRANSITION_TO_BATTLE") {
        viewMode = "BATTLE";
        transition = null;
      } else if (transition.mode === "TRANSITION_TO_STRATEGIC") {
        viewMode = "STRATEGIC";
        transition = null;
      }
    }
  }

  // Battle auto-play
  if (viewMode === "BATTLE" && !battleShowResult) {
    battleAutoPlayTimer += dt;
    if (battleAutoPlayTimer >= BATTLE_FRAME_DURATION) {
      battleAutoPlayTimer = 0;
      const frames = ui.battleFrames;
      if (battleFrameIndex < frames.length - 1) {
        battleFrameIndex++;
      } else {
        battleShowResult = true;
      }
    }
  }
}

// ── Click Handling ─────────────────────────────────────────

function handleClick(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const btn of buttons) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      btn.action();
      return;
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
}

// ── Render ─────────────────────────────────────────────────

function render(now: number) {
  buttons = [];
  const ui = controller.getUIState();

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  if (viewMode === "STRATEGIC" || viewMode === "TRANSITION_TO_BATTLE") {
    renderStrategicView(now, ui);
  }

  if (viewMode === "TRANSITION_TO_BATTLE" && transition) {
    renderBattleTransition(now, ui);
  }

  if (viewMode === "BATTLE") {
    renderBattlePhase(now, ui);
  }

  if (viewMode === "TRANSITION_TO_STRATEGIC" && transition) {
    const progress = getTransitionProgress(transition, now);
    const alpha = easeOutCubic(progress);
    ctx.globalAlpha = alpha;
    renderStrategicView(now, ui);
    ctx.globalAlpha = 1;
  }

  // Floating texts always on top
  renderFloatingTexts(ctx, now);
}

function renderStrategicView(now: number, ui: ReturnType<typeof controller.getUIState>) {
  const gs = ui.gameState;
  const lane = gs.lanes["MID"];

  // HUD
  renderHUD(ctx, gs, ui.phase, LAYOUT.hud);

  // Strategic map
  renderStrategicMap(ctx, lane, gs.players, LAYOUT.map, now);

  // Message bar
  renderMessageBar(ctx, ui.message, LAYOUT.message.x, LAYOUT.message.y, LAYOUT.message.w, LAYOUT.message.h);

  // Phase-specific UI
  const currentPlayer: PlayerId = ui.phase === "P1_PLANNING" ? "PLAYER_1" : "PLAYER_2";

  if (ui.phase === "P1_PLANNING" || ui.phase === "P2_PLANNING") {
    const playerIdx = currentPlayer === "PLAYER_1" ? 0 : 1;
    const player = gs.players[playerIdx];
    const hand = player.hand;
    const champAlive = controller.isChampionAlive(currentPlayer);

    if (!champAlive) {
      // Dead champion — show skip
      ctx.fillStyle = COLORS.hpLow;
      ctx.font = FONT.subtitle;
      ctx.textAlign = "center";
      ctx.fillText("Champion is dead! Click Skip to continue.", W / 2, LAYOUT.cards.y + 60);
      buttons.push(renderActionButton(ctx, W / 2 - 70, LAYOUT.cards.y + 80, 140, 36, "Skip Turn", () => {
        controller.skipPlanning(currentPlayer);
        selectedCardIndex = -1;
        spawnCount = 0;
      }));
    } else {
      // Player label
      ctx.fillStyle = COLORS.text;
      ctx.font = FONT.subtitle;
      ctx.textAlign = "left";
      ctx.fillText(
        `${currentPlayer === "PLAYER_1" ? "Player 1" : "Player 2"}'s Turn — Select a card:`,
        LAYOUT.cards.x + 10, LAYOUT.cards.y + 16
      );

      // Card hand
      const cardButtons = renderCardHand(
        ctx, hand, selectedCardIndex,
        { x: LAYOUT.cards.x, y: LAYOUT.cards.y + 22, w: LAYOUT.cards.w, h: LAYOUT.cards.h - 50 },
        (index) => { selectedCardIndex = index; spawnCount = 0; }
      );
      buttons.push(...cardButtons);

      // Spawn controls
      const maxSpawns = controller.getMaxSpawns(currentPlayer);
      const spawnButtons = renderSpawnControls(
        ctx,
        LAYOUT.bottom.x, LAYOUT.bottom.y,
        spawnCount, maxSpawns, player.gold,
        () => { if (spawnCount > 0) spawnCount--; },
        () => { if (spawnCount < maxSpawns) spawnCount++; }
      );
      buttons.push(...spawnButtons);

      // Confirm button
      if (selectedCardIndex >= 0) {
        buttons.push(renderActionButton(
          ctx, W - 200, LAYOUT.bottom.y - 4, 160, 32, "Confirm", () => {
            const card = hand[selectedCardIndex];
            controller.submitPlanning(currentPlayer, card.cardId, spawnCount);
            selectedCardIndex = -1;
            spawnCount = 0;
          }
        ));
      }
    }
  } else if (ui.phase === "GAME_OVER") {
    // Game over overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.textGold;
    ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ui.message, W / 2, H / 2 - 30);

    buttons.push(renderActionButton(ctx, W / 2 - 80, H / 2 + 10, 160, 40, "Play Again", () => {
      controller.restart();
      selectedCardIndex = -1;
      spawnCount = 0;
      viewMode = "STRATEGIC";
      battleFrameIndex = 0;
      battleShowResult = false;
    }));
  }
}

function renderBattleTransition(now: number, ui: ReturnType<typeof controller.getUIState>) {
  if (!transition) return;
  const progress = getTransitionProgress(transition, now);

  // Phase 1 (0-0.33): "BATTLE!" flash
  if (progress < 0.33) {
    const flashT = progress / 0.33;
    const alpha = 1 - flashT;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.textGold;
    ctx.font = "bold 48px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.textGold;
    ctx.fillText("BATTLE!", W / 2, H / 2);
    ctx.shadowBlur = 0;

    // Expanding rings
    for (let i = 0; i < 3; i++) {
      const ringT = Math.max(0, flashT - i * 0.1);
      const radius = ringT * 200;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(240, 192, 32, ${(1 - ringT) * 0.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Phase 2 (0.33-1.0): Fade to battle
  if (progress >= 0.33) {
    const fadeT = (progress - 0.33) / 0.67;
    ctx.save();
    ctx.globalAlpha = fadeT * 0.85;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function renderBattlePhase(now: number, ui: ReturnType<typeof controller.getUIState>) {
  const frames = ui.battleFrames;
  if (frames.length === 0) return;

  // Battle view
  const battleButtons = renderBattleView(
    ctx, frames, battleFrameIndex,
    { x: 0, y: 0, w: W, h: H },
    now
  );
  buttons.push(...battleButtons);

  // Skip button (always visible during replay)
  if (!battleShowResult) {
    buttons.push(renderActionButton(
      ctx, W - 150, H - 50, 120, 34, "Skip", () => {
        battleFrameIndex = frames.length - 1;
        battleShowResult = true;
      }
    ));
  }

  // Result overlay
  if (battleShowResult) {
    const resultButtons = renderBattleResult(
      ctx, frames,
      { x: 0, y: 0, w: W, h: H },
      () => {
        // Continue → transition back to strategic view
        controller.finishBattle();
        battleShowResult = false;
        battleFrameIndex = 0;

        if (controller.getUIState().phase === "GAME_OVER") {
          viewMode = "STRATEGIC";
        } else {
          viewMode = "TRANSITION_TO_STRATEGIC";
          transition = createTransition("TRANSITION_TO_STRATEGIC", now, 800, W / 2, H / 2);
        }
      }
    );
    buttons.push(...resultButtons);
  }
}

// ── Start ──────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", init);
