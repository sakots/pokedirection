import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreParty, selectParty } from '../src/party.ts';
import { STAT_LABELS } from '../src/pokemon.ts';
import { summarizeSelections } from '../src/trends.ts';

function pokemon(id, value = 100, types = ['grass']) {
  return { id, name: `pokemon-${id}`, image: null, types, stats: Object.fromEntries(Object.keys(STAT_LABELS).map(stat => [stat, value])) };
}

test('selects six distinct species from the full catalog, including unchosen Pokémon', () => {
  const selections = Array(10).fill(pokemon(1000));
  const ideal = Array.from({ length: 6 }, (_, index) => pokemon(index + 1));
  const decoys = Array.from({ length: 8 }, (_, index) => pokemon(index + 20, 200, ['fire']));
  const party = selectParty([...decoys, ...ideal, ideal[0]], selections);
  assert.equal(party.length, 6);
  assert.equal(new Set(party.map(item => item.id)).size, 6);
  assert.deepEqual(party.map(item => item.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(scoreParty(party, selections), 0);
});

test('type preferences distinguish teams with identical stats and role ratio', () => {
  const selections = Array(10).fill(pokemon(100, 80, ['water', 'ice']));
  const water = Array.from({ length: 6 }, (_, index) => pokemon(index + 10, 80, ['water', 'ice']));
  const fire = Array.from({ length: 6 }, (_, index) => pokemon(index + 1, 80, ['fire']));
  assert.ok(scoreParty(water, selections) < scoreParty(fire, selections));
  assert.deepEqual(selectParty([...fire, ...water], selections).map(item => item.id), water.map(item => item.id));
});

test('support/attacker score uses each Pokémon, even with the same six-stat average', () => {
  const physical = pokemon(1);
  physical.stats.attack = 150;
  physical.stats['special-attack'] = 50;
  const special = pokemon(2);
  special.stats.attack = 50;
  special.stats['special-attack'] = 150;
  const selections = Array.from({ length: 10 }, (_, index) => index % 2 ? physical : special);
  const specialized = Array.from({ length: 6 }, (_, index) => ({ ...(index % 2 ? physical : special), id: index + 10 }));
  const balanced = Array.from({ length: 6 }, (_, index) => pokemon(index + 20));
  assert.deepEqual(summarizeSelections(specialized).averages, summarizeSelections(balanced).averages);
  assert.equal(scoreParty(specialized, selections), 0);
  assert.ok(scoreParty(balanced, selections) > 0);
});

test('team optimization can combine contrasting stats to match the target average', () => {
  const selections = Array(10).fill(pokemon(1000));
  const extremes = Array.from({ length: 6 }, (_, index) => pokemon(index + 1, index < 3 ? 50 : 150));
  const near = Array.from({ length: 6 }, (_, index) => pokemon(index + 20, 110));
  const party = selectParty([...near, ...extremes], selections);
  assert.ok(scoreParty(party, selections) < scoreParty(near, selections));
  assert.equal(scoreParty(party, selections), 0);
});

test('duplicate selections affect the target; output remains deterministic with reversed catalog', () => {
  const selections = [...Array(8).fill(pokemon(100, 60, ['grass'])), ...Array(2).fill(pokemon(101, 180, ['fire']))];
  const candidates = Array.from({ length: 18 }, (_, index) => pokemon(index + 1, 40 + index * 10, index % 3 ? ['grass'] : ['fire']));
  assert.equal(summarizeSelections(selections).averages.hp, 84);
  const party = selectParty(candidates, selections);
  assert.deepEqual(selectParty([...candidates].reverse(), selections), party);
  assert.ok(scoreParty(party, selections) < scoreParty(candidates.slice(-6), selections));
});

test('insufficient distinct species and empty selections are rejected', () => {
  assert.throws(() => selectParty(Array(20).fill(pokemon(1)), [pokemon(2)]), /6種類/);
  assert.throws(() => selectParty(Array.from({ length: 6 }, (_, index) => pokemon(index)), []), /選択履歴/);
});
