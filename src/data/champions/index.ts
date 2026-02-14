import { ChampionDefinition } from "../../types/champion.js";
import { IRONCLAD } from "./ironclad.js";
import { PYROX } from "./pyrox.js";

export const CHAMPION_REGISTRY: Record<string, ChampionDefinition> = {
  IRONCLAD,
  PYROX,
};

export { IRONCLAD, PYROX };
