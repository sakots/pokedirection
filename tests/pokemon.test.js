import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePair, sampleUnseenPair, addSelection, createPokemonClient, TOTAL_ROUNDS, STAT_LABELS } from '../src/pokemon.ts';

test('random pairs reach every candidate without duplicates within a round', () => {
  const items = ['a', 'b', 'c', 'd'];
  const combinations = new Set();
  for (let first = 0; first < 4; first++) {
    for (let second = 0; second < 3; second++) {
      const values = [(first + 0.5) / 4, (second + 0.5) / 3];
      const pair = samplePair(items, () => values.shift());
      assert.notEqual(pair[0], pair[1]);
      combinations.add(pair.join(''));
    }
  }
  assert.equal(combinations.size, 12);
  assert.throws(() => samplePair(['a']));
});

test('selection ends at ten and preserves the order', () => {
  let history = [];
  for (let i = 0; i < 12; i++) history = addSelection(history, { id: i % 3 });
  assert.equal(history.length, TOTAL_ROUNDS);
  assert.deepEqual(history.map(p => p.id), [0, 1, 2, 0, 1, 2, 0, 1, 2, 0]);
});

test('ten rounds show twenty unique species, including unchosen candidates in exclusion', () => {
  const species = Array.from({ length: 20 }, (_, index) => ({ url: `species/${index + 1}` }));
  const displayed = new Set();
  const history = [];
  for (let round = 0; round < TOTAL_ROUNDS; round++) {
    const pair = sampleUnseenPair(species, displayed, () => 0);
    assert.equal(pair.length, 2);
    for (const pokemon of pair) {
      assert.ok(!displayed.has(pokemon.url));
      displayed.add(pokemon.url);
    }
    history.push(pair[0]);
  }
  assert.equal(displayed.size, 20);
  assert.equal(history.length, 10);
  assert.deepEqual(history.map(item => item.url), Array.from({ length: 10 }, (_, index) => `species/${index * 2 + 1}`));
  assert.throws(() => sampleUnseenPair(species, displayed), /足りません/);
  displayed.clear();
  assert.deepEqual(sampleUnseenPair(species, displayed, () => 0), species.slice(0, 2));
});

test('drawing an unseen pair does not consume candidates until successfully displayed', () => {
  const species = [{ url: 'species/1' }, { url: 'species/2' }, { url: 'species/3' }];
  const displayed = new Set(['species/1']);
  const pair = sampleUnseenPair(species, displayed, () => 0);
  assert.deepEqual(pair, species.slice(1));
  assert.deepEqual([...displayed], ['species/1']);
  assert.deepEqual(sampleUnseenPair(species, displayed, () => 0), pair);
  assert.throws(() => sampleUnseenPair(species, new Set(['species/1', 'species/2'])), /足りません/);
});

test('API client follows pagination, uses default variety and Japanese name, and caches resources', async () => {
  const calls = [];
  const fixtures = {
    'https://pokeapi.co/api/v2/pokemon-species?limit=20000': { results: [{ url: 'species/1' }], next: 'page/2' },
    'page/2': { results: [{ url: 'species/2' }], next: null },
    'species/1': { id: 1, name: 'bulbasaur', names: [{ name: 'フシギダネ', language: { name: 'ja-Hrkt' } }], varieties: [{ is_default: false, pokemon: { url: 'alternate' } }, { is_default: true, pokemon: { url: 'pokemon/1' } }] },
    'pokemon/1': { sprites: { other: { 'official-artwork': { front_default: 'art.png' } } }, types: [{ type: { name: 'grass' } }, { type: { name: 'poison' } }], stats: Object.keys(STAT_LABELS).reverse().map(name => ({ stat: { name }, base_stat: 65 })) },
  };
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const fetcher = async url => {
    calls.push(url);
    assert.ok(fixtures[url], `Unexpected request: ${url}`);
    return { ok: true, json: async () => fixtures[url] };
  };
  const client = createPokemonClient(fetcher, storage);
  const species = await client.getSpecies();
  assert.equal(species.length, 2);
  const [first, second] = await Promise.all([client.getPokemon(species[0]), client.getPokemon(species[0])]);
  assert.deepEqual(first, { id: 1, name: 'フシギダネ', image: 'art.png', types: ['grass', 'poison'], stats: Object.fromEntries(Object.keys(STAT_LABELS).map(name => [name, 65])) });
  assert.deepEqual(second, first);
  assert.equal(calls.length, 4);
  await createPokemonClient(fetcher, storage).getPokemon(species[0]);
  assert.equal(calls.length, 4);
});

test('failed requests can be retried even when persistent storage is blocked', async () => {
  let attempts = 0;
  const client = createPokemonClient(async () => {
    if (++attempts === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ results: ['success'], next: null }) };
  }, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  await assert.rejects(client.getSpecies());
  assert.deepEqual(await client.getSpecies(), ['success']);
});

test('full catalog uses one cached GraphQL POST and maps names, species IDs, stats, types', async () => {
  let calls = 0;
  const client = createPokemonClient(async (url, options) => {
    calls++;
    assert.equal(url, 'https://graphql.pokeapi.co/v1beta2');
    assert.equal(options.method, 'POST');
    assert.match(JSON.parse(options.body).query, /is_default/);
    return { ok: true, json: async () => ({ data: { pokemon: [{
      id: 25, pokemon_species_id: 25, name: 'pikachu',
      pokemonspecy: { pokemonspeciesnames: [{ name: 'ピカチュウ', language_id: 1 }] },
      pokemonstats: Object.keys(STAT_LABELS).map(name => ({ base_stat: 50, stat: { name } })),
      pokemontypes: [{ type: { name: 'electric' } }],
    }] } }) };
  }, { getItem: () => null, setItem() {} });
  const catalog = await client.getCatalog();
  assert.equal(catalog[0].name, 'ピカチュウ');
  assert.equal(catalog[0].stats.attack, 50);
  assert.equal(catalog[0].id, 25);
  assert.deepEqual(catalog[0].types, ['electric']);
  assert.match(catalog[0].image, /25\.png$/);
  await client.getCatalog();
  assert.equal(calls, 1);
});

test('GraphQL errors with HTTP 200 are retryable and never cached', async () => {
  let calls = 0;
  const client = createPokemonClient(async () => ({ ok: true, json: async () => {
    calls++;
    return calls === 1 ? { errors: [{ message: 'Unavailable' }] } : { data: { pokemon: [] } };
  } }), { getItem: () => null, setItem() {} });
  await assert.rejects(client.getCatalog());
  await assert.rejects(client.getCatalog());
  assert.equal(calls, 2);
});
