import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPartyShareText, buildXShareUrl, getSharePageUrl } from '../src/share.ts';

const party = ['フシギバナ', 'リザードン', 'カメックス', 'ピカチュウ', 'カビゴン', 'ミュウツー'].map((name, index) => ({
  id: index + 1, name, image: null, types: ['normal'],
  stats: { hp: 50, attack: 120, defense: 40, 'special-attack': 40, 'special-defense': 40, speed: 80 },
}));

test('share text includes all six selected party members and computed tendencies', () => {
  const text = buildPartyShareText(party);
  for (const pokemon of party) assert.ok(text.includes(pokemon.name));
  assert.match(text, /攻撃寄り・物理寄り・アタッカー寄り/);
  assert.match(text, /種族値の目安/);
  assert.throws(() => buildPartyShareText(party.slice(0, 5)), /6匹/);
});

test('balanced tendencies are not duplicated in the share text', () => {
  const balanced = party.map(pokemon => ({ ...pokemon, stats: Object.fromEntries(Object.keys(pokemon.stats).map(stat => [stat, 80])) }));
  assert.equal(buildPartyShareText(balanced).match(/バランス型/g).length, 1);
});

test('intent parameters preserve Japanese, newlines, and reserved characters', () => {
  const text = buildPartyShareText(party) + '\nテスト & # + ?';
  const pageUrl = 'https://example.com/pokedirection/';
  const intent = new URL(buildXShareUrl(text, pageUrl));
  assert.equal(intent.origin, 'https://x.com');
  assert.equal(intent.pathname, '/intent/tweet');
  assert.equal(intent.searchParams.get('text'), text);
  assert.equal(intent.searchParams.get('url'), pageUrl);
  assert.equal(intent.searchParams.get('hashtags'), 'pokedirection');
  assert.equal(new URL(buildXShareUrl(text)).searchParams.has('url'), false);
});

test('public URLs retain deployment paths and remove query, fragment, and credentials', () => {
  assert.equal(getSharePageUrl('https://example.com/pokedirection/?debug=1#results'), 'https://example.com/pokedirection/');
  assert.equal(getSharePageUrl('http://localhost:5173/', 'https://example.com/app/'), 'https://example.com/app/');
  assert.equal(getSharePageUrl('https://example.com/', 'invalid'), 'https://example.com/');
  assert.equal(getSharePageUrl('https://user:password@example.com/app/'), 'https://example.com/app/');
});

test('development addresses and non-HTTP URLs are omitted', () => {
  for (const href of ['http://localhost:5173/', 'http://127.0.0.1/', 'http://[::1]/', 'http://192.168.1.10/', 'http://10.0.0.1/', 'http://172.16.1.1/', 'http://dev.local/', 'javascript:alert(1)']) {
    assert.equal(getSharePageUrl(href), undefined);
  }
});
