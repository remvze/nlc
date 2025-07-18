import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  entry: ['bin/nlc.ts'],
  format: 'esm',
  outDir: 'dist/bin',
  sourcemap: false,
  splitting: false,
});
