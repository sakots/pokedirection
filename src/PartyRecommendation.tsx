import { useEffect, useState } from 'react';
import { STAT_LABELS, TYPES } from './pokemon';
import type { Pokemon, StatName } from './pokemon';
import type { PartyRequest, PartyResponse } from './party.worker';
import { summarizeSelections } from './trends';
import { StatsRadar } from './ResultCharts';
import { Ball, PokemonImage } from './PokemonImage';
import { ShareOnX } from './ShareOnX';

const stats = Object.keys(STAT_LABELS) as StatName[];

export function PartyRecommendation({ selections, getCatalog }: {
  selections: Pokemon[]; getCatalog: () => Promise<Pokemon[]>;
}) {
  const [party, setParty] = useState<Pokemon[]>([]);
  const [status, setStatus] = useState<'loading' | 'searching' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [candidateCount, setCandidateCount] = useState(0);

  useEffect(() => {
    let canceled = false;
    let worker: Worker | undefined;
    setStatus('loading');
    setParty([]);
    async function recommend() {
      try {
        const catalog = await getCatalog();
        if (canceled) return;
        // Include the exact REST values that defined this user's target.
        const candidates = [...new Map([...catalog, ...selections].map(pokemon => [pokemon.id, pokemon])).values()];
        setCandidateCount(candidates.length);
        setStatus('searching');
        worker = new Worker(new URL('./party.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<PartyResponse>) => {
          if (canceled) return;
          if (event.data.type === 'ready') { setParty(event.data.party); setStatus('ready'); }
          else setStatus('error');
          worker?.terminate();
        };
        worker.onerror = () => { if (!canceled) setStatus('error'); worker?.terminate(); };
        const request: PartyRequest = { catalog: candidates, selections };
        worker.postMessage(request);
      } catch {
        if (!canceled) setStatus('error');
      }
    }
    void recommend();
    return () => { canceled = true; worker?.terminate(); };
  }, [getCatalog, selections, attempt]);

  const target = summarizeSelections(selections);
  const actual = summarizeSelections(party);
  const typeNames = Object.keys(TYPES).filter(type => target.types.some(([name]) => name === type) || actual.types.some(([name]) => name === type));
  const typeCount = (distribution: [string, number][], type: string) => distribution.find(([name]) => name === type)?.[1] ?? 0;
  const statDifference = stats.reduce((sum, stat) => sum + Math.abs(target.averages[stat] - actual.averages[stat]), 0) / stats.length;

  return <section className="party-section" aria-labelledby="party-heading" aria-busy={status === 'loading' || status === 'searching'}>
    <div className="results-heading"><span className="eyebrow">YOUR IDEAL SIX</span><h2 id="party-heading">「好き」のかたちから、6匹のパーティへ。</h2><p>10匹の平均能力と、役割・タイプの傾向に近い6匹を選びます。</p></div>
    {status === 'error' ? <div className="message-panel" role="alert"><Ball /><p>パーティを選出できませんでした。<br />選択結果はそのままです。もう一度お試しください。</p><button className="primary-button" onClick={() => setAttempt(value => value + 1)}>パーティを再選出する</button></div>
      : status !== 'ready' ? <div className="party-loading" role="status"><Ball /><p>{status === 'loading' ? '全ポケモンの能力・タイプを読み込み中…' : `${candidateCount}種類から、あなたに近い組み合わせを探しています…`}</p><small>下のチャートで、選んだ10匹の傾向も見られます。</small></div>
        : <>
          <ol className="party-grid">{party.map((pokemon, index) => {
            const role = summarizeSelections([pokemon]).supportPercent;
            return <li className="party-member" key={pokemon.id}><span className="party-number">{String(index + 1).padStart(2, '0')} <span>NO. {String(pokemon.id).padStart(4, '0')}</span></span><PokemonImage pokemon={pokemon} /><h3>{pokemon.name}</h3><div className="types">{pokemon.types.map(type => <span className={`type type-${type}`} key={type}>{TYPES[type] ?? type}</span>)}</div><span className="party-role">{role > 55 ? 'サポート寄り' : role < 45 ? 'アタッカー寄り' : 'バランス型'}</span></li>;
          })}</ol>
          <ShareOnX party={party} />
          <div className="party-fit"><span>平均種族値の差 <strong>{statDifference.toFixed(1)}</strong></span><span>サポート比率の差 <strong>{Math.abs(actual.supportPercent - target.supportPercent).toFixed(1)}pt</strong></span></div>
          <div className="results-grid">
            <div className="results-card"><h3 className="chart-heading">目標のかたちと、6匹のかたち</h3><div className="chart-legend"><span className="legend-target">選んだ10匹の平均</span><span className="legend-party">パーティ6匹の平均</span></div><StatsRadar values={actual.averages} label="パーティ6匹の平均" comparison={{ values: target.averages, label: '選んだ10匹の平均' }} /></div>
            <div className="results-card"><h3 className="chart-heading">能力・役割を比較</h3><table className="comparison-table"><caption className="sr-only">選んだ10匹とパーティ6匹の平均種族値・役割の比較</caption><thead><tr><th scope="col">項目</th><th scope="col">10匹</th><th scope="col">6匹</th></tr></thead><tbody>{stats.map(stat => <tr key={stat}><th scope="row">{STAT_LABELS[stat]}</th><td>{target.averages[stat].toFixed(1)}</td><td>{actual.averages[stat].toFixed(1)}</td></tr>)}<tr><th scope="row">サポート</th><td>{target.supportPercent.toFixed(1)}%</td><td>{actual.supportPercent.toFixed(1)}%</td></tr><tr><th scope="row">アタッカー</th><td>{(100 - target.supportPercent).toFixed(1)}%</td><td>{(100 - actual.supportPercent).toFixed(1)}%</td></tr></tbody></table></div>
          </div>
          <div className="results-card party-types"><h3 className="chart-heading">好みのタイプを、パーティにも</h3><p className="chart-note">各タイプを持つポケモンの割合を比較します。複合タイプはそれぞれに数えます。</p><table className="comparison-table"><caption className="sr-only">タイプ分布の比較</caption><thead><tr><th scope="col">タイプ</th><th scope="col">選んだ10匹</th><th scope="col">パーティ6匹</th></tr></thead><tbody>{typeNames.map(type => {
            const before = typeCount(target.types, type);
            const after = typeCount(actual.types, type);
            return <tr key={type}><th scope="row"><span className={`type type-${type}`}>{TYPES[type]}</span></th><td>{before}匹 <small>({Math.round(before / selections.length * 100)}%)</small></td><td>{after}匹 <small>({Math.round(after / party.length * 100)}%)</small></td></tr>;
          })}</tbody></table></div>
          <p className="chart-note results-method">{candidateCount}種類の標準の姿から、同じ種族を重複させずに選出。平均種族値を優先し、役割とタイプ分布も近づけています。完全に一致しない場合もあります。役割は種族値からの目安で、技構成によって変わります。</p>
        </>}
  </section>;
}
