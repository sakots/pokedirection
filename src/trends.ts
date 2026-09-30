import { STAT_LABELS } from './pokemon';
import type { Pokemon, PokemonStats, StatName } from './pokemon';

export function percentage(left: number, right: number): number {
  return left + right === 0 ? 50 : left / (left + right) * 100;
}

export function summarizeSelections(selections: readonly Pokemon[]) {
  const averages = {} as PokemonStats;
  for (const stat of Object.keys(STAT_LABELS) as StatName[]) {
    averages[stat] = selections.length
      ? selections.reduce((sum, pokemon) => sum + pokemon.stats[stat], 0) / selections.length : 0;
  }
  const typeCounts: Record<string, number> = {};
  for (const pokemon of selections) {
    for (const type of pokemon.types) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  }
  // A transparent stat-based proxy, not a classification of learned moves.
  const support = selections.reduce((sum, pokemon) => sum +
    (pokemon.stats.hp + pokemon.stats.defense + pokemon.stats['special-defense']) / 3, 0);
  const attacker = selections.reduce((sum, pokemon) => sum +
    Math.max(pokemon.stats.attack, pokemon.stats['special-attack']), 0);
  return {
    averages,
    attackPercent: percentage(averages.attack + averages['special-attack'], averages.defense + averages['special-defense']),
    physicalPercent: percentage(averages.attack, averages['special-attack']),
    supportPercent: percentage(support, attacker),
    types: Object.entries(typeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}
