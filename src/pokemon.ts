const API = 'https://pokeapi.co/api/v2';
const GRAPHQL = 'https://graphql.pokeapi.co/v1beta2';
export const TOTAL_ROUNDS = 10;

export const STAT_LABELS = {
  hp: 'HP', attack: 'こうげき', defense: 'ぼうぎょ',
  'special-attack': 'とくこう', 'special-defense': 'とくぼう', speed: 'すばやさ',
} as const;

export type StatName = keyof typeof STAT_LABELS;
export type PokemonStats = Record<StatName, number>;

export const TYPES: Record<string, string> = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき',
  grass: 'くさ', ice: 'こおり', fighting: 'かくとう', poison: 'どく',
  ground: 'じめん', flying: 'ひこう', psychic: 'エスパー', bug: 'むし',
  rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン', dark: 'あく',
  steel: 'はがね', fairy: 'フェアリー',
};

export interface Pokemon {
  id: number;
  name: string;
  image: string | null;
  types: string[];
  stats: PokemonStats;
}

export interface ApiResource {
  name: string;
  url: string;
}

interface SpeciesList {
  results: ApiResource[];
  next: string | null;
}

interface SpeciesResponse {
  id: number;
  name: string;
  names: { name: string; language: ApiResource }[];
  varieties: { is_default: boolean; pokemon: ApiResource }[];
}

interface PokemonResponse {
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
  types: { type: ApiResource }[];
  stats: { base_stat: number; stat: ApiResource }[];
}

type CacheStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Fetcher = (url: string, options?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

interface CatalogResponse {
  errors?: { message: string }[];
  data?: { pokemon: {
    id: number;
    name: string;
    pokemon_species_id: number;
    pokemonspecy: { pokemonspeciesnames: { name: string; language_id: number }[] };
    pokemonstats: PokemonResponse['stats'];
    pokemontypes: PokemonResponse['types'];
  }[] };
}

function readStats(entries: PokemonResponse['stats']): PokemonStats {
  const stats = {} as PokemonStats;
  for (const name of Object.keys(STAT_LABELS) as StatName[]) {
    const value = entries.find(item => item.stat.name === name)?.base_stat;
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      throw new Error('ポケモンの種族値を取得できませんでした。');
    }
    stats[name] = value;
  }
  return stats;
}

// The two candidates within a round are distinct.
export function samplePair<T>(items: readonly T[], random = Math.random): [T, T] {
  if (items.length < 2) throw new Error('候補のポケモンが足りません。');
  const first = Math.floor(random() * items.length);
  const second = Math.floor(random() * (items.length - 1));
  return [items[first], items[second >= first ? second + 1 : second]];
}

export function sampleUnseenPair<T extends { url: string }>(
  items: readonly T[], displayed: ReadonlySet<string>, random = Math.random,
): [T, T] {
  return samplePair(items.filter(item => !displayed.has(item.url)), random);
}

export function addSelection<T>(history: T[], pokemon: T): T[] {
  return history.length < TOTAL_ROUNDS ? [...history, pokemon] : history;
}

export function createPokemonClient(fetcher: Fetcher = globalThis.fetch, storage: CacheStorage | undefined = globalThis.localStorage) {
  const memory = new Map<string, Promise<unknown>>();
  async function get<T>(url: string, options?: RequestInit, cacheKey = url): Promise<T> {
    const existing = memory.get(cacheKey);
    if (existing) return await existing as T;
    const key = `pokedirection:v1:${cacheKey}`;
    try {
      const cached = JSON.parse(storage?.getItem(key) ?? 'null') as { time: number; data: T } | null;
      if (cached && Date.now() - cached.time < 86400000) {
        memory.set(cacheKey, Promise.resolve(cached.data));
        return cached.data;
      }
    } catch { /* Caching is optional when storage is unavailable. */ }
    const request = (async () => {
      const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(options?.method === 'POST' ? 30000 : 15000) });
      if (!response.ok) throw new Error(`PokéAPI: ${response.status}`);
      const data: unknown = await response.json();
      const catalog = data as CatalogResponse;
      if (options?.method === 'POST' && (catalog.errors?.length || !catalog.data?.pokemon?.length)) {
        throw new Error('パーティ候補を取得できませんでした。');
      }
      try { storage?.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* Storage may be full. */ }
      return data;
    })();
    memory.set(cacheKey, request);
    try { return await request as T; } catch (error) { memory.delete(cacheKey); throw error; }
  }

  return {
    async getCatalog(): Promise<Pokemon[]> {
      // One bulk query avoids thousands of REST requests for recommendation.
      const response = await get<CatalogResponse>(GRAPHQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: `query PartyCatalog {
          pokemon(where: {is_default: {_eq: true}}, order_by: {id: asc}, limit: 20000) {
            id name pokemon_species_id
            pokemonspecy { pokemonspeciesnames(where: {language_id: {_in: [1, 11]}}) { name language_id } }
            pokemonstats { base_stat stat { name } }
            pokemontypes { type { name } }
          }
        }` }),
      }, `${GRAPHQL}:party-catalog-v1`);
      if (!response.data?.pokemon.length) throw new Error('パーティ候補を取得できませんでした。');
      return response.data.pokemon.map(pokemon => ({
        id: pokemon.pokemon_species_id,
        name: pokemon.pokemonspecy.pokemonspeciesnames.find(item => item.language_id === 1)?.name
          ?? pokemon.pokemonspecy.pokemonspeciesnames.find(item => item.language_id === 11)?.name ?? pokemon.name,
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`,
        types: pokemon.pokemontypes.map(item => item.type.name),
        stats: readStats(pokemon.pokemonstats),
      }));
    },
    async getSpecies(): Promise<ApiResource[]> {
      const species: ApiResource[] = [];
      let url: string | null = `${API}/pokemon-species?limit=20000`;
      while (url) {
        const page: SpeciesList = await get<SpeciesList>(url);
        species.push(...page.results);
        url = page.next;
      }
      return species;
    },
    async getPokemon(resource: ApiResource): Promise<Pokemon> {
      const species = await get<SpeciesResponse>(resource.url);
      const variety = species.varieties.find((item) => item.is_default);
      if (!variety) throw new Error('ポケモンのデータを取得できませんでした。');
      const pokemon = await get<PokemonResponse>(variety.pokemon.url);
      const stats = readStats(pokemon.stats);
      return {
        id: species.id,
        name: species.names.find((item) => item.language.name === 'ja-Hrkt')?.name
          ?? species.names.find((item) => item.language.name === 'ja')?.name ?? species.name,
        image: pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default,
        types: pokemon.types.map((item) => item.type.name),
        stats,
      };
    },
  };
}
