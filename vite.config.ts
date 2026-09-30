import { defineConfig, loadEnv } from 'vite';
import type { HtmlTagDescriptor } from 'vite';
import { getMetadataUrls, OGP_ALT, PAGE_DESCRIPTION, PAGE_TITLE } from './src/metadata';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_PUBLIC_URL');
  const urls = getMetadataUrls(env.VITE_PUBLIC_URL);
  const meta = (key: 'name' | 'property', name: string, content: string): HtmlTagDescriptor => ({
    tag: 'meta', attrs: { [key]: name, content }, injectTo: 'head',
  });
  return {
    base: urls.base,
    plugins: [{
      name: 'pokedirection-social-metadata',
      transformIndexHtml() {
        const tags: HtmlTagDescriptor[] = [
          meta('property', 'og:type', 'website'),
          meta('property', 'og:site_name', 'pokedirection'),
          meta('property', 'og:locale', 'ja_JP'),
          meta('property', 'og:title', PAGE_TITLE),
          meta('property', 'og:description', PAGE_DESCRIPTION),
          meta('property', 'og:image', urls.imageUrl),
          meta('property', 'og:image:type', 'image/png'),
          meta('property', 'og:image:width', '1200'),
          meta('property', 'og:image:height', '630'),
          meta('property', 'og:image:alt', OGP_ALT),
          meta('name', 'twitter:card', 'summary_large_image'),
          meta('name', 'twitter:title', PAGE_TITLE),
          meta('name', 'twitter:description', PAGE_DESCRIPTION),
          meta('name', 'twitter:image', urls.imageUrl),
          meta('name', 'twitter:image:alt', OGP_ALT),
        ];
        if (urls.pageUrl) tags.push(
          meta('property', 'og:url', urls.pageUrl),
          { tag: 'link', attrs: { rel: 'canonical', href: urls.pageUrl }, injectTo: 'head' },
        );
        return tags;
      },
    }],
  };
});
