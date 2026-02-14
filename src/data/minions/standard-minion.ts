import { MinionTemplate } from "../../types/minion.js";
import { MINION_BASE_HP, MINION_BASE_ATTACK, MINION_SPAWN_COST, MINION_KILL_GOLD } from "../../types/constants.js";

export const STANDARD_MINION: MinionTemplate = {
  templateId: "STANDARD_MINION",
  hp: MINION_BASE_HP,
  attack: MINION_BASE_ATTACK,
  goldCost: MINION_SPAWN_COST,
  goldBounty: MINION_KILL_GOLD,
};
