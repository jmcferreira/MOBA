import { GameState, PlayerState } from "../types/game-state.js";
import { LaneState } from "../types/lane.js";
import { Champion } from "../types/champion.js";
import { PlanningCard } from "../types/card.js";
import { LaneId, PlayerId } from "../types/enums.js";
import { BattleState } from "../types/battle.js";
import { LANE_ZONE_COUNT } from "../types/constants.js";

export function renderGameState(gameState: GameState): string {
  const lines: string[] = [];
  lines.push(`\n=== Turn ${gameState.turnNumber} | Phase: ${gameState.phase} ===\n`);

  for (const pid of ["PLAYER_1", "PLAYER_2"] as PlayerId[]) {
    const player = gameState.players[pid === "PLAYER_1" ? 0 : 1];
    lines.push(renderPlayerSummary(player));
  }

  for (const laneId of Object.keys(gameState.lanes) as LaneId[]) {
    lines.push(renderLane(gameState.lanes[laneId]));
  }

  return lines.join("\n");
}

function renderPlayerSummary(player: PlayerState): string {
  const champ = player.champions[0];
  const champStatus = champ
    ? `${champ.name} [HP:${champ.currentHp}/${champ.maxHp} E:${champ.currentEnergy} Lv${champ.level}]${champ.isAlive ? "" : " (DEAD)"}`
    : "No champion";
  return `${player.playerId}: Gold=${player.gold} | ${champStatus} | Hand: ${player.hand.length} cards`;
}

function renderLane(lane: LaneState): string {
  const lines: string[] = [];
  lines.push(`\n--- ${lane.laneId} Lane ---`);
  lines.push(
    `  P1 Base[${lane.baseHp.player1}] Tower[${lane.towerHp.player1}]` +
      `  |  Frontline: Zone ${lane.frontlinePosition}  |` +
      `  Tower[${lane.towerHp.player2}] Base[${lane.baseHp.player2}] P2`
  );

  // Simple lane visualization
  const zoneChars: string[] = [];
  for (let i = 0; i < LANE_ZONE_COUNT; i++) {
    const zone = lane.zones[i];
    const p1m = zone.minions.player1.count;
    const p2m = zone.minions.player2.count;
    const hasChamps = zone.championsPresent.length > 0;

    if (i === lane.frontlinePosition) {
      zoneChars.push(`[*${p1m}v${p2m}*]`);
    } else if (hasChamps) {
      zoneChars.push(`[C${p1m}v${p2m}]`);
    } else if (p1m > 0 || p2m > 0) {
      zoneChars.push(`[${p1m}v${p2m}]`);
    } else {
      zoneChars.push("[   ]");
    }
  }
  lines.push(`  ${zoneChars.join("-")}`);
  lines.push(`  P1 side <<<                          >>> P2 side`);

  return lines.join("\n");
}

export function renderHand(player: PlayerState): string {
  const lines: string[] = [];
  lines.push(`\n${player.playerId}'s Hand:`);
  player.hand.forEach((card, i) => {
    const effects =
      card.effects.length > 0
        ? ` (${card.effects.map((e) => `${e.type}:${e.value}`).join(", ")})`
        : "";
    lines.push(`  ${i + 1}. ${card.name} [${card.stance}]${effects}`);
  });
  return lines.join("\n");
}

export function renderBattleGrid(battle: BattleState): string {
  const lines: string[] = [];
  lines.push(`\n=== Battle in ${battle.laneId} | Round ${battle.roundNumber} ===`);

  const { width, height } = battle.grid;

  // Header
  lines.push("    " + Array.from({ length: width }, (_, q) => ` ${q} `).join(""));

  for (let r = 0; r < height; r++) {
    const indent = r % 2 === 1 ? " " : "";
    let row = `${r}  ${indent}`;
    for (let q = 0; q < width; q++) {
      const cell = battle.grid.cells.get(`${q},${r}`);
      if (cell?.occupantId) {
        // Show first 2 chars of occupant ID
        const label = cell.occupantId.substring(0, 2);
        row += `[${label}]`;
      } else {
        row += "[ ]";
      }
    }
    lines.push(row);
  }

  // Unit list
  lines.push("\nUnits:");
  for (const bc of battle.champions) {
    const c = bc.championRef;
    const pos = c.battlePosition;
    lines.push(
      `  ${c.championId} (${c.ownerId}) HP:${c.currentHp}/${c.maxHp} E:${c.currentEnergy} @(${pos?.q},${pos?.r})${c.isAlive ? "" : " DEAD"}`
    );
  }
  for (const m of battle.minions) {
    if (m.isAlive) {
      lines.push(
        `  ${m.minionId} (${m.ownerId}) HP:${m.hp}/${m.maxHp} @(${m.position.q},${m.position.r})`
      );
    }
  }

  return lines.join("\n");
}
