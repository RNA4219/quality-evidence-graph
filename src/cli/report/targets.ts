import { readdir, stat } from "fs/promises";
import type { Dirent } from "fs";
import { join, relative, resolve } from "path";

export async function safeStat(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

export function portable(path: string): string {
  return path.split(String.fromCharCode(92)).join("/");
}

export function relativeTarget(target: string): string {
  return portable(relative(process.cwd(), target));
}
async function isFixtureLikeDirectory(path: string): Promise<boolean> {
  const input = await safeStat(join(path, "gate-input.json"));
  const expected = await safeStat(join(path, "expected-gate-verdict.json"));
  return Boolean(input?.isFile() || expected?.isFile());
}

async function collectChildFixtures(path: string, children: readonly Dirent[]): Promise<string[]> {
  const fixtures: string[] = [];
  for (const child of children) {
    if (!child.isDirectory()) continue;

    const childPath = join(path, child.name);
    if (await isFixtureLikeDirectory(childPath)) {
      fixtures.push(childPath);
    }
  }
  return fixtures.sort();
}

export async function collectReportTargets(rawTargets: readonly string[]): Promise<string[]> {
  const targets: string[] = [];

  for (const rawTarget of rawTargets) {
    const target = resolve(rawTarget);
    const targetStat = await safeStat(target);

    if (!targetStat?.isDirectory()) {
      targets.push(target);
      continue;
    }

    if (await isFixtureLikeDirectory(target)) {
      targets.push(target);
      continue;
    }

    const childFixtures = await collectChildFixtures(target, await readdir(target, { withFileTypes: true }));
    targets.push(...(childFixtures.length > 0 ? childFixtures : [target]));
  }

  return [...new Set(targets)];
}

