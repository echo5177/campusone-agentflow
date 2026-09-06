import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: `${root}/static-demo`,
  base: process.env.PAGES_BASE_PATH || '/campusone-agentflow/',
  publicDir: false,
  plugins: [
    {
      name: 'pages-local-fonts',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/app/globals.css')) {
          return code.replace(
            /@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);/g,
            '',
          );
        }
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      {
        find: '@/lib/client/api',
        replacement: `${root}/lib/demo/pages-client.ts`,
      },
      { find: '@', replacement: root },
    ],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: `${root}/dist-pages`, emptyOutDir: true },
});
