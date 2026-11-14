import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://cs2studio.haking.tr',
  output: 'static',
  trailingSlash: 'never',
  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 900,
    },
  },
});
