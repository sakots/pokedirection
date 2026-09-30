import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSelections } from '../src/trends.ts';

const attacker = {
  id: 1, name: 'アタッカー', image: null, types: ['fire', 'flying'],
  stats: { hp: 30, attack: 120, defense: 30, 'special-attack': 40, 'special-defense': 30, speed: 100 },
};
const support = {
  id: 2, name: 'サポート', image: null, types: ['water'],
  stats: { hp: 150, attack: 30, defense: 150, 'special-attack': 30, 'special-defense': 150, speed: 40 },
};

test('offensive physical picks produce an attacker tendency with exact stat ratios', () => {
  const summary = summarizeSelections(Array(10).fill(attacker));
  assert.equal(summary.attackPercent, 160 / 220 * 100);
  assert.equal(summary.physicalPercent, 75);
  assert.equal(summary.supportPercent, 20);
  assert.deepEqual(summary.averages, attacker.stats);
  assert.deepEqual(summary.types, [['fire', 10], ['flying', 10]]);
});

test('HP and defensive stats favor support; equal attacking stats remain balanced', () => {
  const summary = summarizeSelections(Array(10).fill(support));
  assert.equal(summary.attackPercent, 60 / 360 * 100);
  assert.equal(summary.physicalPercent, 50);
  assert.equal(summary.supportPercent, 150 / 180 * 100);
});

test('averages, duplicate picks, and dual types reflect each selection', () => {
  const summary = summarizeSelections([attacker, support, attacker]);
  assert.equal(summary.averages.hp, 70);
  assert.equal(summary.averages.attack, 90);
  assert.equal(summary.averages.speed, 80);
  assert.equal(summary.supportPercent, 210 / 480 * 100);
  assert.deepEqual(summary.types, [['fire', 2], ['flying', 2], ['water', 1]]);
});

test('empty input does not produce NaN or Infinity', () => {
  const summary = summarizeSelections([]);
  assert.equal(summary.attackPercent, 50);
  assert.equal(summary.physicalPercent, 50);
  assert.equal(summary.supportPercent, 50);
  assert.deepEqual(summary.types, []);
  assert.ok(Object.values(summary.averages).every(value => value === 0));
});
