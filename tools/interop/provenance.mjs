import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export const sha256 = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export async function sourceFingerprint(root, prefixes) {
  const entries = [];
  async function walk(path) {
    for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
      if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
      const name = path + '/' + entry.name;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) entries.push([name, sha256(await readFile(join(root, name)))]);
      else throw new Error(`Unexpected producer source entry ${name}`);
    }
  }
  for (const prefix of prefixes) await walk(prefix);
  return sha256(JSON.stringify(entries.sort((a, b) => a[0].localeCompare(b[0], 'en'))));
}
