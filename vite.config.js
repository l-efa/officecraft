import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative asset paths, so the build works at any URL (e.g. username.github.io/officecraft/)
  base: './',
  // build into docs/ so GitHub Pages can serve it straight from the main branch
  build: { outDir: 'docs', emptyOutDir: true },
});
