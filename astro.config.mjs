import { defineConfig } from 'astro/config';

// https://astro.build/config
const BASE = (process.env.MODAFIED_BASE ?? '/modafied-site').replace(/\/$/, '');

export default defineConfig({
  site: process.env.MODAFIED_SITE_ORIGIN ?? 'https://alexchouck-hash.github.io',
  base: BASE === '' ? undefined : BASE,
  output: 'static',
  build: {
    format: 'directory'
  }
});
