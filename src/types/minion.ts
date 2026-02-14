import { PlayerId } from "./enums.js";
import { HexCoord } from "./hex.js";

export interface MinionTemplate {
  templateId: string;
  hp: number;
  attack: number;
  goldCost: number;
  goldBounty: number;
}

export interface BattleMinion {
  minionId: string;
  templateId: string;
  ownerId: PlayerId;
  hp: number;
  maxHp: number;
  attack: number;
  position: HexCoord;
  isAlive: boolean;
}
