import { STAT_LABELS, TYPES } from './pokemon';
import type { Pokemon, StatName } from './pokemon';

export const PARTY_SIZE = 6;
const statNames = Object.keys(STAT_LABELS) as StatName[];
const typeNames = Object.keys(TYPES);

// Six stats, support score, attacker score, then one count per type.
function features(pokemon: Pokemon): number[] {
  const stats = pokemon.stats;
  return [
    ...statNames.map(name => stats[name]),
    (stats.hp + stats.defense + stats['special-defense']) / 3,
    Math.max(stats.attack, stats['special-attack']),
    ...typeNames.map(type => Number(pokemon.types.includes(type))),
  ];
}

function totals(pokemon: readonly Pokemon[]): number[] {
  const sum = Array(8 + typeNames.length).fill(0) as number[];
  for (const item of pokemon) features(item).forEach((value, index) => { sum[index] += value; });
  return sum;
}

function makeScorer(selections: readonly Pokemon[]) {
  if (!selections.length) throw new Error('選択履歴がありません。');
  const target = totals(selections).map(value => value / selections.length);
  const targetRole = target[6] / (target[6] + target[7] || 1);
  return (sum: number[], size: number) => {
    let statError = 0;
    let typeError = 0;
    for (let index = 0; index < 6; index++) {
      statError += ((sum[index] / size - target[index]) / Math.max(40, target[index])) ** 2 / 6;
    }
    for (let index = 8; index < sum.length; index++) {
      typeError += (sum[index] / size - target[index]) ** 2 / 4;
    }
    const role = sum[6] / (sum[6] + sum[7] || 1);
    const roleError = ((role - targetRole) / .5) ** 2;
    return .65 * statError + .20 * roleError + .15 * typeError;
  };
}

export function scoreParty(party: readonly Pokemon[], selections: readonly Pokemon[]): number {
  if (!party.length) throw new Error('パーティが空です。');
  return makeScorer(selections)(totals(party), party.length);
}

/** Multi-start greedy construction followed by strictly improving swaps.
 * Optimizes the team average; it does not simply pick six similar individuals.
 */
export function selectParty(catalog: readonly Pokemon[], selections: readonly Pokemon[]): Pokemon[] {
  const unique = [...new Map(catalog.map(pokemon => [pokemon.id, pokemon])).values()]
    .sort((a, b) => a.id - b.id);
  if (unique.length < PARTY_SIZE) throw new Error('6種類以上のパーティ候補が必要です。');
  const score = makeScorer(selections);
  const vectors = unique.map(features);
  const ranked = unique.map((_, index) => index)
    .sort((a, b) => score(vectors[a], 1) - score(vectors[b], 1) || unique[a].id - unique[b].id);
  // Some broader seeds allow contrasting Pokémon to complement each other.
  const seedPositions = [...Array.from({ length: Math.min(8, ranked.length) }, (_, index) => index),
    ...[.2, .4, .6, .8].map(fraction => Math.floor((ranked.length - 1) * fraction))];
  let bestParty: number[] = [];
  let bestScore = Infinity;

  for (const seed of new Set(seedPositions.map(position => ranked[position]))) {
    const team = [seed];
    let sum = [...vectors[seed]];
    while (team.length < PARTY_SIZE) {
      let choice = -1;
      let choiceScore = Infinity;
      for (let candidate = 0; candidate < unique.length; candidate++) {
        if (team.includes(candidate)) continue;
        const next = sum.map((value, index) => value + vectors[candidate][index]);
        const candidateScore = score(next, team.length + 1);
        if (candidateScore < choiceScore) { choice = candidate; choiceScore = candidateScore; }
      }
      team.push(choice);
      sum = sum.map((value, index) => value + vectors[choice][index]);
    }

    let currentScore = score(sum, PARTY_SIZE);
    for (let iteration = 0; iteration < 12; iteration++) {
      let swap: { slot: number; candidate: number; sum: number[]; score: number } | null = null;
      for (let slot = 0; slot < PARTY_SIZE; slot++) {
        const without = sum.map((value, index) => value - vectors[team[slot]][index]);
        for (let candidate = 0; candidate < unique.length; candidate++) {
          if (team.includes(candidate)) continue;
          const next = without.map((value, index) => value + vectors[candidate][index]);
          const nextScore = score(next, PARTY_SIZE);
          if (nextScore + 1e-12 < (swap?.score ?? currentScore)) {
            swap = { slot, candidate, sum: next, score: nextScore };
          }
        }
      }
      if (!swap) {
        // Two simultaneous exchanges can escape a local minimum where one
        // strong and one weak Pokémon must be added together to match the mean.
        const shortlists = team.map(member => {
          const without = sum.map((value, index) => value - vectors[member][index]);
          return unique.map((_, candidate) => candidate).filter(candidate => !team.includes(candidate))
            .map(candidate => ({ candidate, score: score(without.map((value, index) => value + vectors[candidate][index]), PARTY_SIZE) }))
            .sort((a, b) => a.score - b.score || unique[a.candidate].id - unique[b.candidate].id)
            .slice(0, 24).map(item => item.candidate);
        });
        let pairSwap: { first: number; second: number; a: number; b: number; sum: number[]; score: number } | null = null;
        for (let first = 0; first < PARTY_SIZE; first++) {
          for (let second = first + 1; second < PARTY_SIZE; second++) {
            const without = sum.map((value, index) => value - vectors[team[first]][index] - vectors[team[second]][index]);
            for (const a of shortlists[first]) for (const b of shortlists[second]) {
              if (a === b) continue;
              const next = without.map((value, index) => value + vectors[a][index] + vectors[b][index]);
              const nextScore = score(next, PARTY_SIZE);
              if (nextScore + 1e-12 < (pairSwap?.score ?? currentScore)) {
                pairSwap = { first, second, a, b, sum: next, score: nextScore };
              }
            }
          }
        }
        if (!pairSwap) break;
        team[pairSwap.first] = pairSwap.a;
        team[pairSwap.second] = pairSwap.b;
        sum = pairSwap.sum;
        currentScore = pairSwap.score;
        continue;
      }
      team[swap.slot] = swap.candidate;
      sum = swap.sum;
      currentScore = swap.score;
    }
    if (currentScore < bestScore) { bestScore = currentScore; bestParty = team; }
  }
  return bestParty.map(index => unique[index]).sort((a, b) => a.id - b.id);
}
