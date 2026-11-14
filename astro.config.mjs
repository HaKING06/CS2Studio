import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cs2studio.haking.tr',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          tr: 'tr',
          ru: 'ru',
          de: 'de',
          pt: 'pt',
          es: 'es',
          pl: 'pl',
          fr: 'fr',
          zh: 'zh',
          uk: 'uk',
          sv: 'sv',
          da: 'da',
          fi: 'fi',
          nl: 'nl',
          it: 'it',
          ja: 'ja',
          ko: 'ko',
          ar: 'ar',
          cs: 'cs',
          ro: 'ro',
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 900,
    },
  },
});
