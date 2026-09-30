import { getSharePageUrl } from './share';

export const PAGE_TITLE = 'pokedirection — 好きからはじまる、ポケモン選び。';
export const PAGE_DESCRIPTION = '2匹から好きなポケモンを10回選ぶと、能力・役割・タイプの好みからあなたの6匹パーティを選出します。';
export const OGP_ALT = 'pokedirectionの紹介画像。10回の選択から、あなたの6匹パーティを見つけるポケモン選び。';

export function getMetadataUrls(publicHref = '') {
  const configured = publicHref.trim();
  const href = getSharePageUrl('', configured);
  if (configured && !href) throw new Error('VITE_PUBLIC_URLには公開先のhttp(s) URLを設定してください。');
  if (!href) return { base: '/', pageUrl: undefined, imageUrl: '/ogp.png' };
  const url = new URL(href);
  // The app is deployed in a directory, including subdirectory hosting.
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return { base: url.pathname, pageUrl: url.href, imageUrl: new URL('ogp.png', url).href };
}
