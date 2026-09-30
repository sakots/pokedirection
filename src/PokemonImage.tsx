import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import type { Pokemon } from './pokemon';

export function Ball({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`ball ${className}`}><span /></span>;
}

type PokemonImageProps = { pokemon: Pokemon } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'onError'>;

export function PokemonImage({ pokemon, ...props }: PokemonImageProps) {
  const [failed, setFailed] = useState(false);
  return pokemon.image && !failed
    ? <img src={pokemon.image} alt={pokemon.name} onError={() => setFailed(true)} {...props} />
    : <span className="image-fallback"><Ball /><span>画像がありません</span></span>;
}
