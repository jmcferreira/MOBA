import { LaneStance } from "../../types/enums.js";

export const COLORS = {
  // Background
  bg: "#0d0d1a",

  // Map terrain
  mapGrassP1: "#2a4a1a",
  mapGrassP2: "#1a3a2a",
  mapGrassCenter: "#2d3a20",
  lanePath: "#5a4a30",
  lanePathEdge: "#3a3020",
  riftLight: "#2dd4bf",
  riftDark: "#0d6b5e",

  // Player colors
  p1: "#c03050",
  p1Light: "#e05070",
  p1Dark: "#6b1a2a",
  p2: "#2060b0",
  p2Light: "#4080d0",
  p2Dark: "#0a2a5a",

  // Structures
  towerStone: "#8a7a60",
  towerCrystalP1: "#ff6b6b",
  towerCrystalP2: "#6bafff",
  baseWallP1: "#5a2020",
  baseWallP2: "#20205a",
  rubble: "#4a4a4a",

  // UI panels
  panel: "#0d0d20",
  panelBorder: "#2a2a40",
  panelLight: "#1a1a30",

  // Text
  text: "#e8e8f0",
  textDim: "#6a6a80",
  textGold: "#f0c020",

  // Functional
  hpHigh: "#40c040",
  hpMid: "#d0b030",
  hpLow: "#e04040",
  energy: "#40a0e0",
  shield: "#a0a0c0",
  gold: "#f0c020",

  // Cards
  cardBg: "#161628",
  cardBorder: "#3a3a50",
  cardSelected: "#1a5a3a",
  cardSelectedBorder: "#40c060",

  // Stances
  stanceAggro: "#d04040",
  stanceDefend: "#3080c0",
  stanceNeutral: "#80809a",
  stanceAmbush: "#8040b0",

  // Buttons
  button: "#2a6b3a",
  buttonBorder: "#1a4a2a",
  buttonText: "#e8e8f0",

  // Battle
  hexBg: "#2a3a2a",
  hexBorder: "#4a5a4a",
  hexP1Tint: "rgba(192, 48, 80, 0.08)",
  hexP2Tint: "rgba(32, 96, 176, 0.08)",
  hexHighlight: "#f0c020",
  hexActive: "rgba(240, 192, 32, 0.3)",

  // Vegetation
  treeDark: "#1a4d0a",
  treeLight: "#2d6b16",
  treeTrunk: "#4a3520",
};

export function stanceColor(stance: LaneStance): string {
  switch (stance) {
    case LaneStance.Aggro: return COLORS.stanceAggro;
    case LaneStance.Defend: return COLORS.stanceDefend;
    case LaneStance.Neutral: return COLORS.stanceNeutral;
    case LaneStance.Ambush: return COLORS.stanceAmbush;
  }
}

export function playerColor(playerId: string): string {
  return playerId === "PLAYER_1" ? COLORS.p1 : COLORS.p2;
}

export function playerColorLight(playerId: string): string {
  return playerId === "PLAYER_1" ? COLORS.p1Light : COLORS.p2Light;
}

export function playerColorDark(playerId: string): string {
  return playerId === "PLAYER_1" ? COLORS.p1Dark : COLORS.p2Dark;
}

export function hpColor(pct: number): string {
  if (pct > 0.5) return COLORS.hpHigh;
  if (pct > 0.25) return COLORS.hpMid;
  return COLORS.hpLow;
}
