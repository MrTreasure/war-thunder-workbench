import { miniappManifest } from '@heybox/hb-sdk/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [miniappManifest()],
});
