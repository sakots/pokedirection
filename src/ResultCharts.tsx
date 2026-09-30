import { useState } from 'react';
import { STAT_LABELS, TYPES } from './pokemon';
import type { PokemonStats, StatName } from './pokemon';
import type { Pokemon } from './pokemon';
import { summarizeSelections } from './trends';

const stats = Object.keys(STAT_LABELS) as StatName[];

function BalanceChart({ title, left, right, value, note }: {
  title: string; left: string; right: string; value: number; note: string;
}) {
  const tendency = value > 55 ? `${left}寄り` : value < 45 ? `${right}寄り` : 'バランス型';
  const leftPercent = Math.round(value);
  const rightPercent = 100 - leftPercent;
  return <div className="balance-chart">
    <div className="balance-title"><h3>{title}</h3><span>{tendency}</span></div>
    <div className="balance-labels"><span>{left} {leftPercent}%</span><span>{right} {rightPercent}%</span></div>
    <div className="balance-track" role="img" aria-label={`${title}：${left} ${leftPercent}%、${right} ${rightPercent}%`}>
      <span style={{ width: `${value}%` }} /><span style={{ width: `${100 - value}%` }} />
      <i aria-hidden="true" />
    </div>
    <p>{note}</p>
  </div>;
}

export function StatsRadar({ values, label, comparison }: {
  values: PokemonStats; label: string; comparison?: { values: PokemonStats; label: string };
}) {
  const scale = Math.max(50, Math.ceil(Math.max(...Object.values(values), ...Object.values(comparison?.values ?? {})) / 50) * 50);
  function point(index: number, amount: number) {
    const angle = (index * 60 - 90) * Math.PI / 180;
    return [180 + Math.cos(angle) * 105 * amount, 150 + Math.sin(angle) * 105 * amount];
  }
  function polygon(amount: number) {
    return stats.map((_, index) => point(index, amount).join(',')).join(' ');
  }
  const shape = stats.map((stat, index) => point(index, values[stat] / scale).join(',')).join(' ');
  return <div className="radar-wrap">
    <svg viewBox="0 0 360 310" role="img" aria-label={`${label}の種族値。${stats.map(stat => `${STAT_LABELS[stat]} ${values[stat].toFixed(1)}`).join('、')}。${comparison ? `${comparison.label}：${stats.map(stat => `${STAT_LABELS[stat]} ${comparison.values[stat].toFixed(1)}`).join('、')}。` : ''}軸の最大値 ${scale}。`}>
      {[.25, .5, .75, 1].map(level => <polygon key={level} points={polygon(level)} className="radar-grid" />)}
      {stats.map((stat, index) => {
        const [x, y] = point(index, 1);
        const [labelX, labelY] = point(index, 1.32);
        return <g key={stat}><line x1="180" y1="150" x2={x} y2={y} className="radar-axis" /><text x={labelX} y={labelY - 4} textAnchor="middle" className="radar-label">{STAT_LABELS[stat]}</text><text x={labelX} y={labelY + 13} textAnchor="middle" className="radar-value">{Number(values[stat].toFixed(1))}</text></g>;
      })}
      <polygon points={shape} className="radar-shape" />
      {comparison && <polygon points={stats.map((stat, index) => point(index, comparison.values[stat] / scale).join(',')).join(' ')} className="radar-comparison" />}
      {stats.map((stat, index) => { const [x, y] = point(index, values[stat] / scale); return <circle key={stat} cx={x} cy={y} r="3" className="radar-dot" />; })}
    </svg>
    <p className="chart-note">種族値 / 軸の最大値 {scale}（表示対象に合わせて調整）</p>
  </div>;
}

export function ResultCharts({ selections }: { selections: Pokemon[] }) {
  const [view, setView] = useState('average');
  const summary = summarizeSelections(selections);
  const selected = view === 'average' ? null : selections[Number(view)];
  const label = selected?.name ?? '10匹の平均';

  return <section className="results-section" aria-labelledby="results-heading">
    <div className="results-heading"><span className="eyebrow">YOUR POKÉMON PROFILE</span><h2 id="results-heading">あなたの「好き」の傾向</h2><p>選んだ10匹を、能力と役割の傾向で振り返ろう。</p></div>
    <div className="results-card">
      <h3 className="chart-heading">選んだ10匹のバランス</h3>
      <BalanceChart title="攻撃と防御" left="攻撃" right="防御" value={summary.attackPercent} note="攻撃＝こうげき＋とくこう、防御＝ぼうぎょ＋とくぼう。10匹の種族値の合計を比較しています。" />
      <BalanceChart title="物理と特殊" left="物理" right="特殊" value={summary.physicalPercent} note="10匹のこうげきと、とくこうの合計を比較しています。実際の技構成とは異なります。" />
      <BalanceChart title="サポートとアタッカー" left="サポート" right="アタッカー" value={summary.supportPercent} note="サポート＝各ポケモンのHP・ぼうぎょ・とくぼうの平均、アタッカー＝こうげき・とくこうの高い方。10匹分を合計して比較した能力上の目安です。実際の役割は技構成によって変わります。" />
    </div>
    <div className="results-grid">
      <div className="results-card"><div className="radar-heading"><h3 className="chart-heading">能力のかたち</h3><label><span className="sr-only">種族値チャートの表示対象</span><select value={view} onChange={event => setView(event.target.value)}><option value="average">10匹の平均</option>{selections.map((pokemon, index) => <option key={index} value={index}>{index + 1}. {pokemon.name}</option>)}</select></label></div><StatsRadar values={selected?.stats ?? summary.averages} label={label} /></div>
      <div className="results-card"><h3 className="chart-heading">好きが集まったタイプ</h3><p className="chart-note">複合タイプはそれぞれ1匹として数えます。</p><div className="type-chart">{summary.types.map(([type, count]) => <div className="type-chart-row" key={type}><span className={`type type-${type}`}>{TYPES[type] ?? type}</span><div className="type-chart-track"><span style={{ width: `${count / selections.length * 100}%` }} /></div><span>{count}匹</span></div>)}</div></div>
    </div>
    <p className="chart-note results-method">各選択を1匹として集計します。同じポケモンを複数回選んだ場合も、その回数を反映します。割合は能力の比率で、ポケモンの人数比ではありません。能力のデータ：<a href="https://pokeapi.co/docs/v2/#pokemon" target="_blank" rel="noreferrer">PokéAPI</a>。</p>
  </section>;
}
