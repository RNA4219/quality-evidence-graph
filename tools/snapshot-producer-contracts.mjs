import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  { repo: 'code-to-gate', names: ['shared-defs', 'normalized-repo-graph', 'diff-analysis', 'findings', 'risk-register', 'test-seeds', 'release-readiness', 'audit'], notices: ['LICENSE'] },
  { repo: 'manual-bb-test-harness', names: ['shared_defs', 'feature_spec', 'risk_register', 'manual_case_set', 'gate_decision', 'execution_evidence'], notices: ['LICENSE', 'NOTICE'] },
];
const outputs = new Map();
const bundle = {};
const provenance = [];
for (const source of sources) {
  const repo = resolve(root, '..', source.repo);
  const gitArgs = ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, '-C', repo];
  const revision = execFileSync('git', [...gitArgs, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const paths = [...source.names.map(n => `schemas/${n}.schema.json`), ...source.notices];
  const schemas = {};
  const hashes = {};
  for (const path of paths) {
    const bytes = execFileSync('git', [...gitArgs, 'show', `${revision}:${path}`]);
    hashes[path] = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    if (path.startsWith('schemas/')) schemas[path.slice(8)] = JSON.parse(bytes.toString('utf8'));
    else {
      outputs.set(resolve(root, 'docs/third-party', `${source.repo}-${path}`), bytes);
      outputs.set(resolve(root, 'qeg-report-action/licenses', `${source.repo}-${path}.txt`), bytes);
    }
  }
  bundle[source.repo] = schemas;
  provenance.push({ producer: source.repo, revision, source: `https://github.com/RNA4219/${source.repo}`, modified: false, hashes });
}
outputs.set(resolve(root, 'src/adapters/producer-schemas.json'), JSON.stringify(bundle, null, 2) + '\n');
outputs.set(resolve(root, 'docs/spec/producer-schema-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
// Refreshing pinned schemas requires an explicit local maintenance command.
for (const path of outputs.keys()) {
  try { const entry = await lstat(path); if (!process.argv.includes('--refresh') || !entry.isFile()) throw new Error(`Refusing to overwrite ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const [path, content] of outputs) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content, { flag: process.argv.includes('--refresh') ? 'w' : 'wx' }); }
console.log(`Pinned ${sources.reduce((n, s) => n + s.names.length, 0)} producer schemas and retained license notices.`);
