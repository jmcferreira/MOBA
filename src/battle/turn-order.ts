import { ChampionRole, LaneStance } from "../types/enums.js";
import { Champion } from "../types/champion.js";
import { BattleMinion } from "../types/minion.js";

const ROLE_INITIATIVE: Record<ChampionRole, number> = {
  [ChampionRole.Assassin]: 5,
  [ChampionRole.Mage]: 4,
  [ChampionRole.Fighter]: 3,
  [ChampionRole.Support]: 2,
  [ChampionRole.Tank]: 1,
};

export function getChampionInitiative(champion: Champion, stance: LaneStance | null): number {
  let init = ROLE_INITIATIVE[champion.role];
  if (stance === LaneStance.Ambush) init += 3;
  if (stance === LaneStance.Defend) init -= 1;
  return init;
}

export interface BattleUnit {
  id: string;
  isChampion: boolean;
  ownerId: string;
}

export function buildTurnOrder(
  p1Champion: Champion,
  p2Champion: Champion,
  p1Stance: LaneStance | null,
  p2Stance: LaneStance | null,
  p1Minions: BattleMinion[],
  p2Minions: BattleMinion[]
): string[] {
  const p1Init = getChampionInitiative(p1Champion, p1Stance);
  const p2Init = getChampionInitiative(p2Champion, p2Stance);

  let firstChamp: Champion;
  let secondChamp: Champion;
  let firstMinions: BattleMinion[];
  let secondMinions: BattleMinion[];

  if (p1Init >= p2Init) {
    firstChamp = p1Champion;
    secondChamp = p2Champion;
    firstMinions = p1Minions;
    secondMinions = p2Minions;
  } else {
    firstChamp = p2Champion;
    secondChamp = p1Champion;
    firstMinions = p2Minions;
    secondMinions = p1Minions;
  }

  const order: string[] = [];
  order.push(firstChamp.championId);
  for (const m of firstMinions) order.push(m.minionId);
  order.push(secondChamp.championId);
  for (const m of secondMinions) order.push(m.minionId);

  return order;
}
