import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const checks = JSON.parse(await readFile('src/cli/enum-contracts.json', 'utf8'));
const enums = {};
for (const check of checks) {
  const source = await readFile(check.typeFile, 'utf8');
  const match = source.match(new RegExp(`export type ${check.typeName} =([\\s\\S]*?);`));
  const values = match ? [...match[1].matchAll(/"([^"]+)"/g)].map(value => value[1]).sort() : [];
  if (!values.length) throw new Error(`Missing enum source: ${check.typeName}`);
  enums[check.typeName] = values;
}
await writeFile('qeg-report-action/runtime-metadata.json', JSON.stringify({ runtimeVersion: 'qeg-runtime/v1',
  package: { name: pkg.name, version: pkg.version, engines: pkg.engines }, enums }, null, 2) + '\n');
await build({ entryPoints: ['src/cli.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node20',
  outfile: 'qeg-report-action/dist/cli.mjs', logLevel: 'warning',
  banner: { js: "import { createRequire as qegCreateRequire } from 'node:module'; const require = qegCreateRequire(import.meta.url);" } });
