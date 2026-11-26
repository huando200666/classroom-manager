import { build as viteBuild } from 'vite';
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
await viteBuild();
await build({
  entryPoints: ['apps/extension/background.ts'],
  outfile: 'dist/extension/background.js',
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  sourcemap: true,
});
await build({
  entryPoints: ['apps/extension/content.ts'],
  outfile: 'dist/extension/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: true,
});
await mkdir('dist/extension', { recursive: true });
await copyFile('apps/extension/manifest.json', 'dist/extension/manifest.json');
console.log('Bản cài đặt: dist/extension');
