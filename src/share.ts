import type { Pokemon } from './pokemon';
import { summarizeSelections } from './trends';

export const SHARE_HASHTAG = 'pokedirection';

function tendency(value: number, left: string, right: string): string {
  return value > 55 ? `${left}寄り` : value < 45 ? `${right}寄り` : 'バランス型';
}

export function buildPartyShareText(party: readonly Pokemon[]): string {
  if (party.length !== 6) throw new Error('シェアには6匹のパーティが必要です。');
  const summary = summarizeSelections(party);
  const tendencies = [
    tendency(summary.attackPercent, '攻撃', '防御'),
    tendency(summary.physicalPercent, '物理', '特殊'),
    tendency(summary.supportPercent, 'サポート', 'アタッカー'),
  ];
  return [
    '私の6匹パーティ！',
    party.map(pokemon => pokemon.name).join(' / '),
    `傾向：${[...new Set(tendencies)].join('・')}（種族値の目安）`,
  ].join('\n');
}

export function getSharePageUrl(currentHref: string, publicHref = ''): string | undefined {
  for (const candidate of [publicHref.trim(), currentHref]) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
        || host === '[::1]' || /^(127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
      if (!['https:', 'http:'].includes(url.protocol) || local) continue;
      url.search = '';
      url.hash = '';
      url.username = '';
      url.password = '';
      return url.href;
    } catch { /* An unset or invalid public URL falls back to the current page. */ }
  }
  return undefined;
}

export function buildXShareUrl(text: string, pageUrl?: string): string {
  const url = new URL('https://x.com/intent/tweet');
  url.searchParams.set('text', text);
  url.searchParams.set('hashtags', SHARE_HASHTAG);
  if (pageUrl) url.searchParams.set('url', pageUrl);
  return url.href;
}
