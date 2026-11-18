import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pausedProbe, finishProbe, runProbe } from './helpers/command-transaction-child.mjs';
import { publishFiles, readPublishedOutputs, recoverOutputs } from '../dist/index.js';
import { verifyOutputManifest } from '../dist/cli/output-integrity.js';

const files = value => new Map(['a.json', 'b.json', 'output-manifest.json'].map(name => [name, JSON.stringify({ value }) + '\n']));
const boundaries = ['staged-directory', ...[...files('').keys()].map(name => `staged:${name}`), 'sealed', 'prepared', ...[...files('').keys()].map(name => `alias:${name}`), 'pointer-committed', 'committed'];
function paused(directory, boundary) {
  return pausedProbe(['publication', directory, boundary], boundary);
}

for (const existing of [false, true]) test(`EAC-08 TC20/22: process termination at every boundary, existing=${existing}`, async t => {
  for (const boundary of boundaries) await t.test(boundary, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qeg-process-'));
    if (existing) await publishFiles(dir, files('old'));
    const child = await paused(dir, boundary);
    await assert.rejects(readPublishedOutputs(dir), /busy|lease/);
    await finishProbe(child, true);
    if (['pointer-committed', 'committed'].includes(boundary)) assert.deepEqual((await readPublishedOutputs(dir)).files, files('new'));
    else if (existing) {
      if (boundary.startsWith('alias:') || boundary === 'prepared') await assert.rejects(readPublishedOutputs(dir), /Interrupted/);
      else assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
      await recoverOutputs(dir);
      assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
    } else {
      await assert.rejects(readPublishedOutputs(dir), /No completed|Interrupted/);
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
    const other = runProbe(['publication', dir, 'never']);
    assert.equal(other.status, 1, other.stderr); assert.match(other.stderr, /busy|lease/);
    await assert.rejects(recoverOutputs(dir), /busy|lease/);
    assert.equal(await finishProbe(writer), 0);
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

test('EAC-08 TC19: rename failure preserves the previously completed generation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qeg-rename-fail-'));
  await publishFiles(dir, files('old'));
  const result = runProbe(['rename-failure', dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /rename denied/);
  assert.deepEqual((await readPublishedOutputs(dir)).files, files('old'));
});
