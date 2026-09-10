import { build } from 'esbuild';
await build({ entryPoints: ['src/cli.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node20',
  outfile: 'qeg-report-action/dist/cli.mjs', logLevel: 'warning',
  banner: { js: "import { createRequire as qegCreateRequire } from 'node:module'; const require = qegCreateRequire(import.meta.url);" } });
