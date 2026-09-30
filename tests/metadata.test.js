import test from 'node:test';
import assert from 'node:assert/strict';
import { getMetadataUrls } from '../src/metadata.ts';

test('public deployment emits absolute page and image URLs', () => {
  assert.deepEqual(getMetadataUrls('https://example.com/'), {
    pageUrl: 'https://example.com/', imageUrl: 'https://example.com/ogp.png',
  });
});

test('subdirectory deployment preserves paths and normalizes the trailing slash', () => {
  assert.deepEqual(getMetadataUrls('https://example.com/pokedirection?preview=1#results'), {
    pageUrl: 'https://example.com/pokedirection/',
    imageUrl: 'https://example.com/pokedirection/ogp.png',
  });
});

test('development never injects placeholder public URLs', () => {
  assert.deepEqual(getMetadataUrls(), { pageUrl: undefined, imageUrl: './ogp.png' });
});

test('invalid and development URLs are rejected when configured as the public URL', () => {
  for (const href of ['invalid', 'javascript:alert(1)', 'http://localhost:5173/', 'http://192.168.0.1/']) {
    assert.throws(() => getMetadataUrls(href), /VITE_PUBLIC_URL/);
  }
});
