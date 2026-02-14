import { PlanningCard } from "../types/card.js";
import { PlayerState } from "../types/game-state.js";
import { PlanningEffectType } from "../types/enums.js";
import { HAND_SIZE } from "../types/constants.js";

export function drawToHandLimit(player: PlayerState): void {
  while (player.hand.length < HAND_SIZE && player.deck.length > 0) {
    player.hand.push(player.deck.pop()!);
  }
  // If deck empty and hand not full, shuffle discard into deck and keep drawing
  if (player.hand.length < HAND_SIZE && player.deck.length === 0 && player.discard.length > 0) {
    player.deck = shuffleDeck(player.discard);
    player.discard = [];
    while (player.hand.length < HAND_SIZE && player.deck.length > 0) {
      player.hand.push(player.deck.pop()!);
    }
  }
}

export function playCard(player: PlayerState, cardId: string): PlanningCard | null {
  const idx = player.hand.findIndex((c) => c.cardId === cardId);
  if (idx === -1) return null;
  const [card] = player.hand.splice(idx, 1);
  player.discard.push(card);
  return card;
}

export function sumCardEffects(card: PlanningCard | null, effectType: PlanningEffectType): number {
  if (!card) return 0;
  return card.effects
    .filter((e) => e.type === effectType)
    .reduce((sum, e) => sum + e.value, 0);
}

/** Deterministic shuffle using a seed for reproducibility in tests. */
export function shuffleDeck(cards: PlanningCard[], seed?: number): PlanningCard[] {
  const result = [...cards];
  // Fisher-Yates with optional seeded PRNG
  let s = seed ?? Date.now();
  const random = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createPlayerDeck(cardPool: PlanningCard[]): {
  deck: PlanningCard[];
  hand: PlanningCard[];
  discard: PlanningCard[];
} {
  // Each player gets a copy of the full card pool as their deck.
  // For a 8-card pool with DECK_SIZE=10, duplicate 2 cards (the two Neutral stance).
  const deck = [...cardPool];
  // If pool is smaller than desired deck size, pad by duplicating (cyclic).
  // For MVP the 8 unique cards are fine as-is.
  return { deck: shuffleDeck(deck), hand: [], discard: [] };
}
