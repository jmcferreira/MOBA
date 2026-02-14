import { GameController } from "./game-controller.js";
import { LaneStance, PlayerId } from "../types/enums.js";
import { PlanningCard } from "../types/card.js";
import { LANE_ZONE_COUNT, MINION_SPAWN_COST } from "../types/constants.js";

// ── State ───────────────────────────────────────────────────

const controller = new GameController();
let selectedCardIndex = -1;
let spawnCount = 0;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// Button hit areas
interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: () => void;
}
let buttons: Button[] = [];

// ── Colors ──────────────────────────────────────────────────

const COLORS = {
  bg: "#1a1a2e",
  panel: "#16213e",
  panelLight: "#1c2e4a",
  accent1: "#e94560",  // Player 1 red
  accent2: "#0f7cba",  // Player 2 blue
  gold: "#f5c518",
  text: "#eee",
  textDim: "#888",
  green: "#44bd32",
  red: "#e74c3c",
  lane: "#2d3436",
  zone: "#3d4a5c",
  zoneFront: "#5a6e8a",
  tower: "#f39c12",
  base: "#e74c3c",
  card: "#2d3a50",
  cardHover: "#3d4a60",
  cardSelected: "#1e6f50",
  button: "#2ecc71",
  buttonHover: "#27ae60",
  stanceAggro: "#e74c3c",
  stanceDefend: "#3498db",
  stanceNeutral: "#95a5a6",
  stanceAmbush: "#9b59b6",
};

function stanceColor(stance: LaneStance): string {
  switch (stance) {
    case LaneStance.Aggro: return COLORS.stanceAggro;
    case LaneStance.Defend: return COLORS.stanceDefend;
    case LaneStance.Neutral: return COLORS.stanceNeutral;
    case LaneStance.Ambush: return COLORS.stanceAmbush;
  }
}

// ── Init ────────────────────────────────────────────────────

function init() {
  canvas = document.getElementById("game") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  // Handle high-DPI
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 900 * dpr;
  canvas.height = 700 * dpr;
  canvas.style.width = "900px";
  canvas.style.height = "700px";
  ctx.scale(dpr, dpr);

  canvas.addEventListener("click", handleClick);
  render();
}

// ── Click Handling ──────────────────────────────────────────

function handleClick(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const btn of buttons) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      btn.action();
      render();
      return;
    }
  }
}

// ── Render ──────────────────────────────────────────────────

function render() {
  buttons = [];
  const W = 900;
  const H = 700;
  const ui = controller.getUIState();
  const gs = ui.gameState;
  const lane = gs.lanes["MID"];

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ──
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`MOBA BOARD GAME — Turn ${gs.turnNumber}`, W / 2, 30);

  // ── Player Stats ──
  renderPlayerStats(gs, "PLAYER_1", 20, 50, 420);
  renderPlayerStats(gs, "PLAYER_2", 460, 50, 420);

  // ── Lane Visualization ──
  renderLane(lane, 50, 130, W - 100, 80);

  // ── Message ──
  ctx.fillStyle = COLORS.gold;
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  const msgLines = wordWrap(ui.message, 80);
  msgLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 240 + i * 18);
  });

  // ── Phase-specific UI ──
  const currentPlayer: PlayerId = ui.phase === "P1_PLANNING" ? "PLAYER_1" : "PLAYER_2";

  if (ui.phase === "P1_PLANNING" || ui.phase === "P2_PLANNING") {
    const playerIdx = currentPlayer === "PLAYER_1" ? 0 : 1;
    const player = gs.players[playerIdx];
    const hand = player.hand;
    const champAlive = controller.isChampionAlive(currentPlayer);

    if (!champAlive) {
      ctx.fillStyle = COLORS.red;
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Champion is dead! Click Skip to continue.", W / 2, 320);
      addButton(W / 2 - 60, 340, 120, 36, "Skip Turn", () => {
        controller.skipPlanning(currentPlayer);
        selectedCardIndex = -1;
        spawnCount = 0;
      });
    } else {
      // Card selection
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `${currentPlayer === "PLAYER_1" ? "Player 1" : "Player 2"}'s Cards:`,
        50, 290
      );

      renderCardHand(hand, 50, 300, W - 100);

      // Spawn controls
      const maxSpawns = controller.getMaxSpawns(currentPlayer);
      renderSpawnControls(50, 480, maxSpawns, player.gold);

      // Confirm button
      if (selectedCardIndex >= 0) {
        addButton(W / 2 - 80, 550, 160, 40, "Confirm", () => {
          const card = hand[selectedCardIndex];
          controller.submitPlanning(currentPlayer, card.cardId, spawnCount);
          selectedCardIndex = -1;
          spawnCount = 0;
        });
      }
    }
  } else if (ui.phase === "GAME_OVER") {
    ctx.fillStyle = COLORS.gold;
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ui.message, W / 2, 350);

    addButton(W / 2 - 80, 390, 160, 40, "Play Again", () => {
      controller.restart();
      selectedCardIndex = -1;
      spawnCount = 0;
    });
  }

  // ── Render buttons ──
  for (const btn of buttons) {
    renderButton(btn);
  }
}

// ── Sub-renderers ───────────────────────────────────────────

function renderPlayerStats(gs: any, playerId: PlayerId, x: number, y: number, w: number) {
  const idx = playerId === "PLAYER_1" ? 0 : 1;
  const player = gs.players[idx];
  const champ = player.champions[0];
  const color = playerId === "PLAYER_1" ? COLORS.accent1 : COLORS.accent2;

  // Panel
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, w, 60);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 60);

  // Player label
  ctx.fillStyle = color;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(playerId === "PLAYER_1" ? "PLAYER 1" : "PLAYER 2", x + 10, y + 20);

  // Champion
  ctx.fillStyle = COLORS.text;
  ctx.font = "12px monospace";
  if (champ) {
    const hpPct = champ.currentHp / champ.maxHp;
    const hpColor = hpPct > 0.5 ? COLORS.green : hpPct > 0.25 ? COLORS.gold : COLORS.red;
    ctx.fillText(`${champ.name} Lv${champ.level}`, x + 10, y + 38);

    // HP bar
    const barX = x + 140;
    const barW = 100;
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, y + 28, barW, 12);
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, y + 28, barW * hpPct, 12);
    ctx.fillStyle = COLORS.text;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${champ.currentHp}/${champ.maxHp}`, barX + barW / 2, y + 38);

    // Energy
    ctx.textAlign = "left";
    ctx.fillStyle = "#5dade2";
    ctx.fillText(`E:${champ.currentEnergy}`, barX + barW + 10, y + 38);

    if (!champ.isAlive) {
      ctx.fillStyle = COLORS.red;
      ctx.font = "bold 12px monospace";
      ctx.fillText("DEAD", barX + barW + 40, y + 38);
    }
  }

  // Gold
  ctx.fillStyle = COLORS.gold;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${player.gold}g`, x + w - 10, y + 20);

  // Cards in hand
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "11px monospace";
  ctx.fillText(`Hand: ${player.hand.length}`, x + w - 10, y + 38);
  ctx.textAlign = "left";
}

function renderLane(lane: any, x: number, y: number, w: number, h: number) {
  const zoneW = w / LANE_ZONE_COUNT;

  // Lane background
  ctx.fillStyle = COLORS.lane;
  ctx.fillRect(x, y, w, h);

  for (let i = 0; i < LANE_ZONE_COUNT; i++) {
    const zx = x + i * zoneW;
    const zone = lane.zones[i];

    // Zone fill
    if (i === lane.frontlinePosition) {
      ctx.fillStyle = COLORS.zoneFront;
    } else {
      ctx.fillStyle = COLORS.zone;
    }
    ctx.fillRect(zx + 1, y + 1, zoneW - 2, h - 2);

    // Zone label
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Z${i}`, zx + zoneW / 2, y + 12);

    // Minion counts
    const p1m = zone.minions.player1.count;
    const p2m = zone.minions.player2.count;
    if (p1m > 0 || p2m > 0) {
      ctx.font = "11px monospace";
      if (p1m > 0) {
        ctx.fillStyle = COLORS.accent1;
        ctx.fillText(`${p1m}`, zx + zoneW / 2 - 12, y + h / 2 + 4);
      }
      if (p2m > 0) {
        ctx.fillStyle = COLORS.accent2;
        ctx.fillText(`${p2m}`, zx + zoneW / 2 + 12, y + h / 2 + 4);
      }
    }

    // Champion markers
    if (zone.championsPresent.includes("PLAYER_1")) {
      ctx.fillStyle = COLORS.accent1;
      ctx.beginPath();
      ctx.arc(zx + zoneW / 2 - 12, y + h - 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (zone.championsPresent.includes("PLAYER_2")) {
      ctx.fillStyle = COLORS.accent2;
      ctx.beginPath();
      ctx.arc(zx + zoneW / 2 + 12, y + h - 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tower/Base indicators
    if (i === 0) {
      ctx.fillStyle = COLORS.base;
      ctx.font = "bold 10px monospace";
      ctx.fillText(`B:${lane.baseHp.player1}`, zx + zoneW / 2, y + h - 4);
    }
    if (i === 1) {
      ctx.fillStyle = COLORS.tower;
      ctx.font = "bold 10px monospace";
      ctx.fillText(`T:${lane.towerHp.player1}`, zx + zoneW / 2, y + h - 4);
    }
    if (i === LANE_ZONE_COUNT - 2) {
      ctx.fillStyle = COLORS.tower;
      ctx.font = "bold 10px monospace";
      ctx.fillText(`T:${lane.towerHp.player2}`, zx + zoneW / 2, y + h - 4);
    }
    if (i === LANE_ZONE_COUNT - 1) {
      ctx.fillStyle = COLORS.base;
      ctx.font = "bold 10px monospace";
      ctx.fillText(`B:${lane.baseHp.player2}`, zx + zoneW / 2, y + h - 4);
    }

    // Frontline marker
    if (i === lane.frontlinePosition) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(zx + 1, y + 1, zoneW - 2, h - 2);
    }
  }

  // Labels
  ctx.fillStyle = COLORS.accent1;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("P1 Base <", x, y + h + 14);
  ctx.fillStyle = COLORS.accent2;
  ctx.textAlign = "right";
  ctx.fillText("> P2 Base", x + w, y + h + 14);
}

function renderCardHand(hand: PlanningCard[], x: number, y: number, totalW: number) {
  const cardW = Math.min(150, (totalW - 20) / Math.max(hand.length, 1));
  const cardH = 140;
  const gap = 8;

  hand.forEach((card, i) => {
    const cx = x + i * (cardW + gap);
    const isSelected = i === selectedCardIndex;

    // Card background
    ctx.fillStyle = isSelected ? COLORS.cardSelected : COLORS.card;
    ctx.fillRect(cx, y, cardW, cardH);
    ctx.strokeStyle = isSelected ? COLORS.green : stanceColor(card.stance);
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(cx, y, cardW, cardH);

    // Stance badge
    ctx.fillStyle = stanceColor(card.stance);
    ctx.fillRect(cx, y, cardW, 22);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(card.stance, cx + cardW / 2, y + 15);

    // Card name
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    const nameLines = wordWrap(card.name, Math.floor(cardW / 7));
    nameLines.forEach((line, li) => {
      ctx.fillText(line, cx + cardW / 2, y + 42 + li * 14);
    });

    // Effects
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "10px monospace";
    if (card.effects.length > 0) {
      card.effects.forEach((eff, ei) => {
        const label = eff.type.replace(/_/g, " ").toLowerCase();
        ctx.fillText(`+${eff.value} ${label}`, cx + cardW / 2, y + 80 + ei * 14);
      });
    } else {
      ctx.fillText("(no bonus)", cx + cardW / 2, y + 80);
    }

    // Click index
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "9px monospace";
    ctx.fillText(`[${i + 1}]`, cx + cardW / 2, y + cardH - 6);

    // Click area
    addButton(cx, y, cardW, cardH, "", () => {
      selectedCardIndex = i;
      spawnCount = 0;
    });
  });
}

function renderSpawnControls(x: number, y: number, maxSpawns: number, gold: number) {
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Spawn Minions: ${spawnCount}  (cost: ${spawnCount * MINION_SPAWN_COST}g)`, x, y);

  // - button
  addButton(x + 280, y - 14, 30, 22, "-", () => {
    if (spawnCount > 0) spawnCount--;
  });

  // + button
  addButton(x + 318, y - 14, 30, 22, "+", () => {
    if (spawnCount < maxSpawns) spawnCount++;
  });

  ctx.fillStyle = COLORS.textDim;
  ctx.font = "11px monospace";
  ctx.fillText(`(max ${maxSpawns}, ${MINION_SPAWN_COST}g each)`, x + 360, y);
}

function addButton(x: number, y: number, w: number, h: number, label: string, action: () => void) {
  buttons.push({ x, y, w, h, label, action });
}

function renderButton(btn: Button) {
  if (!btn.label) return; // Invisible click area (cards)

  ctx.fillStyle = COLORS.button;
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = "#1a8a4a";
  ctx.lineWidth = 1;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.textBaseline = "alphabetic";
}

function wordWrap(text: string, maxLen: number): string[] {
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

// ── Start ───────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", init);
