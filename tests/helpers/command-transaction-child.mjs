import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--no-deps', '--format-version', '1'], { encoding: 'utf8' }));
const binary = join(metadata.target_directory, 'debug', 'examples', 'transaction-probe' + (process.platform === 'win32' ? '.exe' : ''));

export function runProbe(args, request) {
  return spawnSync(binary, args, { encoding: 'utf8', input: request && JSON.stringify(request), maxBuffer: 16 * 1024 * 1024 });
}
export function deniedEvidence(input, directory, operation, path, strict) {
  const result = runProbe(['evidence-failure', directory, operation, path], { input, strict });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return JSON.parse(result.stdout);
}
// Keep the native process handle, so termination at the boundary also releases its OS lease.
export async function pausedProbe(args, boundary) {
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Boundary timeout: ' + stderr)); }, 15000);
    const finish = (error) => {
      clearTimeout(timer);
      child.off('error', finish);
      child.off('exit', exited);
      lines.off('line', line);
      if (error) reject(error); else resolve();
    };
    const exited = code => finish(new Error('Probe exited ' + code + ': ' + stderr));
    const line = text => { if (text === 'boundary:' + boundary) finish(); };
    child.once('error', finish);
    child.once('exit', exited);
    lines.on('line', line);
  });
  return child;
}
export async function finishProbe(child, kill = false) {
  const exited = once(child, 'exit');
  if (kill) child.kill('SIGKILL'); else child.stdin.end('resume\n');
  return (await exited)[0];
}
