import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { publishFiles, readPublishedOutputs, recoverOutputs } from '../dist/index.js';
import { verifyOutputManifest } from '../dist/cli/output-integrity.js';

const files = value => new Map(['a.json', 'b.json', 'output-manifest.json'].map(name => [name, JSON.stringify({ value }) + '\n']));
const boundaries = ['staged-directory', ...[...files('').keys()].map(name => `staged:${name}`), 'sealed', ...[...files('').keys()].map(name => `alias:${name}`), 'committed'];
async function paused(directory, boundary) {
  const child = fork(new URL('./helpers/publication-child.mjs', import.meta.url), [directory, boundary], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let errors = ''; child.stderr.on('data', bytes => { errors += bytes; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('child boundary timeout: ' + errors)); }, 10000);
    child.once('message', message => { clearTimeout(timeout); assert.equal(message.boundary, boundary); resolve(); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`child exited ${code}: ${errors}`)); });
  });
  return child;
}

for (const existing of [false, true]) test(`EAC-08 TC20/22: process termination at every boundary, existing=${existing}`, async t => {
  for (const boundary of boundaries) await t.test(boundary, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qeg-process-'));
    if (existing) await publishFiles(dir, files('old'));
    const child = await paused(dir, boundary);
    await assert.rejects(readPublishedOutputs(dir), /busy|lease/);
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
    if (boundary === 'committed') assert.deepEqual((await readPublishedOutputs(dir)).files, files('new'));
    else if (existing) {
      if (boundary.startsWith('alias:')) await assert.rejects(readPublishedOutputs(dir), /hash mismatch/);
      else assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
      await recoverOutputs(dir);
      assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
    } else {
      await assert.rejects(readPublishedOutputs(dir), /No completed/);
      assert.match((await verifyOutputManifest(dir)).join(' '), /interrupted|missing/);
      await assert.rejects(recoverOutputs(dir), /No completed/);
    }
    await publishFiles(dir, files('rerun'));
    assert.deepEqual((await readPublishedOutputs(dir)).files, files('rerun'));
  });
});

test('EAC-08 TC21: another writer and recovery explicitly reject while a process owns publication', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-race-'));
  const writer = await paused(dir, 'alias:a.json');
  try {
    const other = spawnSync(process.execPath, [new URL('./helpers/publication-child.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), dir, 'never'], { encoding: 'utf8' });
    assert.equal(other.status, 1, other.stderr); assert.match(other.stderr, /busy|lease/);
    await assert.rejects(recoverOutputs(dir), /busy|lease/);
    const exited = once(writer, 'exit'); writer.send('continue'); assert.equal((await exited)[0], 0);
    assert.deepEqual((await readPublishedOutputs(dir)).files, files('new'));
  } finally { if (writer.exitCode === null) writer.kill(); }
});

test('EAC-08 TC19/22: I/O rollback, alias repair, sealed history and pointer tamper fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-recovery-'));
  await publishFiles(dir, files('old'));
  await assert.rejects(publishFiles(dir, files('new'), { onBoundary: async point => { if (point === 'alias:a.json') throw new Error('injected I/O boundary failure'); } }), /Publishing outputs failed/);
  assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
  await writeFile(join(dir, 'a.json'), 'tampered');
  await assert.rejects(readPublishedOutputs(dir), /hash mismatch/);
  await recoverOutputs(dir);
  const snapshot = await readPublishedOutputs(dir);
  await writeFile(join(dir, '.qeg-generations', snapshot.generation, 'generation.json'), '{}');
  await assert.rejects(recoverOutputs(dir), /manifest hash mismatch/);
  await assert.rejects(publishFiles(dir, files('new')), /manifest hash mismatch/);
  await writeFile(join(dir, '.qeg-current.json'), '{"version":"qeg-pointer/v1","id":"../outside"}');
  await assert.rejects(readPublishedOutputs(dir), /Invalid output generation pointer/);
});

test('EAC-08 TC19: invalid output path or existing directory never replaces files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-io-fail-'));
  await assert.rejects(publishFiles(dir, new Map([['../outside', 'x']])), /Invalid output filename/);
  await mkdir(join(dir, 'b.json'));
  await assert.rejects(publishFiles(dir, files('new')), /not a regular file/);
  assert.deepEqual(await readdir(dir), ['b.json']);
});

test('EAC-08 TC19: real rename failure preserves the previously completed generation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-rename-fail-'));
  await publishFiles(dir, files('old'));
  const original = fs.rename;
  let injected = false;
  const replacement = t.mock.method(fs, 'rename', async (from, to) => {
    if (!injected && to === join(dir, 'b.json')) { injected = true; throw Object.assign(new Error('rename denied'), { code: 'EACCES' }); }
    return original(from, to);
  });
  syncBuiltinESMExports();
  try { await assert.rejects(publishFiles(dir, files('new')), /rename denied/); }
  finally { replacement.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(injected, true);
  assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
});
