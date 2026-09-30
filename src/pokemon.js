const API = 'https://pokeapi.co/api/v2';
export const TOTAL_ROUNDS = 10;

export const TYPES = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき',
  grass: 'くさ', ice: 'こおり', fighting: 'かくとう', poison: 'どく',
  ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく',
  steel: 'はがね', fairy: 'フェアリー',
};

// Each round is independent. The two candidates within a round are distinct.
export function samplePair(items, random = Math.random) {
  if (items.length < 2) throw new Error('候補のポケモンが足りません。');
  const first = Math.floor(random() * items.length);
  const second = Math.floor(random() * (items.length - 1));
  return [items[first], items[second >= first ? second + 1 : second]];
}

export function addSelection(history, pokemon) {
  return history.length < TOTAL_ROUNDS ? [...history, pokemon] : history;
}

export function createPokemonClient(fetcher = globalThis.fetch, storage = globalThis.localStorage) {
  const memory = new Map();
  async function get(url) {
    if (memory.has(url)) return memory.get(url);
    const key = `pokedirection:v1:${url}`;
    try {
      const cached = JSON.parse(storage?.getItem(key) ?? 'null');
      if (cached && Date.now() - cached.time < 86400000) {
        memory.set(url, Promise.resolve(cached.data));
        return cached.data;
      }
    } catch { /* Caching is optional when storage is unavailable. */ }
    const request = (async () => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`PokéAPI: ${response.status}`);
      const data = await response.json();
      try { storage?.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* Storage may be full. */ }
      return data;
    })();
    memory.set(url, request);
    try { return await request; } catch (error) { memory.delete(url); throw error; }
  }

  return {
    async getSpecies() {
      const species = [];
      let url = `${API}/pokemon-species?limit=20000`;
      while (url) {
        const page = await get(url);
        species.push(...page.results);
        url = page.next;
      }
      return species;
    },
    async getPokemon(resource) {
      const species = await get(resource.url);
      const variety = species.varieties.find((item) => item.is_default);
      if (!variety) throw new Error('ポケモンのデータを取得できませんでした。');
      const pokemon = await get(variety.pokemon.url);
      return {
        id: species.id,
        name: species.names.find((item) => item.language.name === 'ja-Hrkt')?.name
          ?? species.names.find((item) => item.language.name === 'ja')?.name ?? species.name,
        image: pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default,
        types: pokemon.types.map((item) => item.type.name),
      };
    },
  };
}
