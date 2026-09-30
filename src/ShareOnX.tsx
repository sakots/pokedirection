import type { Pokemon } from './pokemon';
import { buildPartyShareText, buildXShareUrl, getSharePageUrl, SHARE_HASHTAG } from './share';

export function ShareOnX({ party }: { party: Pokemon[] }) {
  const text = buildPartyShareText(party);
  const pageUrl = getSharePageUrl(window.location.href, import.meta.env.VITE_PUBLIC_URL);
  return <div className="share-section">
    <a className="share-x-button" href={buildXShareUrl(text, pageUrl)} target="_blank" rel="noopener noreferrer" aria-label="6匹のパーティをXにシェア（新しいタブで投稿画面を開く）"><span className="x-mark" aria-hidden="true">𝕏</span> Xにシェア <span aria-hidden="true">↗</span></a>
    <p className="chart-note">Xの投稿画面で内容を確認・編集できます。</p>
    <details className="share-preview"><summary>投稿内容を見る</summary><p>{text}{pageUrl ? `\n${pageUrl}` : ''}{`\n#${SHARE_HASHTAG}`}</p></details>
  </div>;
}
