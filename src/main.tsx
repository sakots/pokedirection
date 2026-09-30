import React, { useEffect, useRef, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import { addSelection, createPokemonClient, samplePair, TOTAL_ROUNDS, TYPES } from './pokemon';
import type { Pokemon } from './pokemon';
import './styles.css';

const client = createPokemonClient();

function Ball({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`ball ${className}`}><span /></span>;
}

type PokemonImageProps = { pokemon: Pokemon } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'onError'>;

function PokemonImage({ pokemon, ...props }: PokemonImageProps) {
  const [failed, setFailed] = useState(false);
  return pokemon.image && !failed
    ? <img src={pokemon.image} alt={pokemon.name} onError={() => setFailed(true)} {...props} />
    : <span className="image-fallback"><Ball /><span>画像がありません</span></span>;
}

type Status = 'loading' | 'ready' | 'error' | 'complete';

function App() {
  const [pair, setPair] = useState<Pokemon[]>([]);
  const [history, setHistory] = useState<Pokemon[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const locked = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = history.length === TOTAL_ROUNDS;

  async function loadPair() {
    const current = ++requestId.current;
    locked.current = true;
    setStatus('loading');
    setError('');
    try {
      const species = await client.getSpecies();
      const candidates = await Promise.all(samplePair(species).map(client.getPokemon));
      if (current !== requestId.current) return;
      setPair(candidates);
      setStatus('ready');
      locked.current = false;
    } catch {
      if (current !== requestId.current) return;
      setError('ポケモンを読み込めませんでした。通信環境を確認して、もう一度お試しください。');
      setStatus('error');
    }
  }

  useEffect(() => {
    loadPair();
    return () => { requestId.current += 1; };
  }, []);

  function select(pokemon: Pokemon) {
    if (locked.current || complete) return;
    locked.current = true;
    const next = addSelection(history, pokemon);
    setHistory(next);
    if (next.length < TOTAL_ROUNDS) loadPair();
    else { setStatus('complete'); heading.current?.focus(); }
  }

  function restart() {
    setHistory([]);
    setPair([]);
    loadPair();
    heading.current?.focus();
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="./" aria-label="pokedirection ホーム"><Ball />pokedirection<span className="brand-dot">.</span></a>
      <span className="header-note">好きからはじまる、ポケモン選び。</span>
    </header>

    <main>
      <section className="intro">
        <span className="eyebrow"><span /> A LITTLE POKÉMON DISCOVERY</span>
        <h1 ref={heading} tabIndex={-1}>{complete ? <>10回の「好き」が、集まりました。</> : <>直感で選ぼう。<br /><span>あなたは、どっちが好き？</span></>}</h1>
        <p>{complete ? '出会ったポケモンの中から、あなたが選んだ10匹を振り返ってみましょう。' : <>ランダムに出会う2匹から、気になる1匹を。<br className="mobile-break" />10回の小さな選択を楽しもう。</>}</p>
      </section>

      <section className="selection-area" aria-label="ポケモンの選択">
        <div className="progress-heading"><span>{complete ? 'DISCOVERY COMPLETE' : 'YOUR DISCOVERY'}</span><span><strong>{history.length.toString().padStart(2, '0')}</strong> / 10 <span className="progress-caption">選択済み</span></span></div>
        <div className="progress" role="progressbar" aria-label="選択の進捗" aria-valuemin={0} aria-valuemax={10} aria-valuenow={history.length}>
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < history.length ? 'filled' : ''} />)}
        </div>

        {complete ? <div className="completion-panel"><span className="complete-icon">✓</span><h2>選択完了！</h2><p>あなたの「好き」を、下の履歴に並べました。</p><button className="primary-button" onClick={restart}>もう一度、出会いにいく <span aria-hidden="true">↗</span></button></div>
          : <>
            <div className="round-caption"><span className="round-tag">ROUND {String(history.length + 1).padStart(2, '0')}</span><span>好きなポケモンをタップして選択</span></div>
            {status === 'error' ? <div className="message-panel" role="alert"><Ball /><p>{error}</p><button className="primary-button" onClick={loadPair}>もう一度読み込む</button></div>
              : <div className="choice-grid" aria-busy={status === 'loading'}>
                {(status === 'ready' ? pair : [null, null]).map((pokemon, i) => pokemon
                  ? <button key={pokemon.id} className={`pokemon-card card-${i}`} onClick={() => select(pokemon)} aria-label={`${pokemon.name}を選ぶ`}>
                    <div className="card-top"><span>NO. {String(pokemon.id).padStart(4, '0')}</span><span className="card-spark" aria-hidden="true">✧</span></div>
                    <div className="art-stage"><span className="art-circle" /><PokemonImage key={pokemon.id} pokemon={pokemon} /></div>
                    <h2>{pokemon.name}</h2>
                    <div className="types">{pokemon.types.map(type => <span key={type} className={`type type-${type}`}>{TYPES[type] ?? type}</span>)}</div>
                    <span className="choose-label">このポケモンを選ぶ <span aria-hidden="true">→</span></span>
                  </button>
                  : <div key={i} className={`pokemon-card skeleton card-${i}`}><span className="skeleton-line" /><div className="art-stage"><span className="art-circle" /><Ball /></div><span className="skeleton-line wide" /><span className="loading-label">ポケモンを探しています…</span></div>)}
                <span className="versus" aria-hidden="true">or</span>
              </div>}
            <p className="choice-note" role="status">{status === 'loading' ? '新しい2匹を読み込み中…' : '強さや相性は気にせず、あなたの「好き」で選んでください。'}</p>
          </>}
      </section>

      <section className="history-section" aria-labelledby="history-heading">
        <div className="history-heading"><h2 id="history-heading"><span aria-hidden="true">♡</span> あなたの選択</h2><span>{history.length} / 10</span></div>
        {history.length ? <ol className="history-grid">{history.map((pokemon, i) => <li key={`${i}-${pokemon.id}`}><span className="history-number">{String(i + 1).padStart(2, '0')}</span><PokemonImage pokemon={pokemon} /><span>{pokemon.name}</span></li>)}</ol>
          : <div className="empty-history"><span aria-hidden="true">↖</span><p>最初の「好き」を選んでみよう。<small>選んだポケモンがここに並びます。</small></p></div>}
      </section>
      <div className="how-it-works"><span className="small-label">HOW IT WORKS</span><span><b>01</b> 2匹と出会う</span><span aria-hidden="true">→</span><span><b>02</b> 好きな1匹を選ぶ</span><span aria-hidden="true">→</span><span><b>03</b> 10回楽しむ</span></div>
    </main>
    <footer><span>ちょっとした出会いが、好きのきっかけに。</span><span>Pokémon data by <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokéAPI ↗</a></span></footer>
  </div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('アプリの表示先が見つかりません。');
createRoot(root).render(<App />);
