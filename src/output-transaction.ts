import { lstat, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { CliError } from "./cli/errors.js";
import { digest, filename, GENERATIONS, missing, optionalRegular, POINTER, regular, replace, writeSynced } from "./output-storage.js";

const PENDING = ".qeg-pending.json";
interface Journal { version: "qeg-transaction/v1"; id: string; previous?: string; next: string; files: { name: string; hash?: string }[]; }
export interface PendingPublication { readonly id: string; readonly committed: boolean; readonly before: ReadonlyMap<string, string | undefined>; }

/** Caller holds the output lease. Persist every before-image before the first alias changes. */
export async function preparePublication(root: string, id: string, before: ReadonlyMap<string, string | undefined>, next: string): Promise<void> {
  const stage = join(root, GENERATIONS, id);
  await mkdir(join(stage, ".qeg-rollback"));
  const files: Journal["files"] = [];
  for (const [name, bytes] of before) {
    if (bytes !== undefined) await writeSynced(join(stage, ".qeg-rollback", name), bytes);
    files.push({ name, ...(bytes === undefined ? {} : { hash: digest(bytes) }) });
  }
  const journal: Journal = { version: "qeg-transaction/v1", id, previous: await optionalRegular(join(root, POINTER)), next, files };
  const bytes = JSON.stringify(journal) + "\n";
  await writeSynced(join(stage, ".qeg-transaction.json"), bytes);
  await replace(root, PENDING, JSON.stringify({ version: "qeg-pending/v1", id, hash: digest(bytes) }) + "\n");
}

export async function pendingPublication(root: string): Promise<PendingPublication | undefined> {
  const bytes = await optionalRegular(join(root, PENDING));
  if (bytes === undefined) return undefined;
  const ref = JSON.parse(bytes);
  if (ref.version !== "qeg-pending/v1" || !/^[0-9a-f-]{36}$/.test(ref.id) || !/^sha256:[0-9a-f]{64}$/.test(ref.hash)) throw new CliError("Invalid pending publication pointer");
  const stage = join(root, GENERATIONS, ref.id);
  for (const path of [join(root, GENERATIONS), stage, join(stage, ".qeg-rollback")]) if (!(await lstat(path)).isDirectory()) throw new CliError("Invalid publication rollback directory");
  await regular(join(stage, ".qeg-transaction.json"));
  const journalBytes = await readFile(join(stage, ".qeg-transaction.json"), "utf8");
  if (digest(journalBytes) !== ref.hash) throw new CliError("Publication journal hash mismatch");
  const journal = JSON.parse(journalBytes) as Journal;
  if (journal.version !== "qeg-transaction/v1" || journal.id !== ref.id || typeof journal.next !== "string" ||
    (journal.previous !== undefined && typeof journal.previous !== "string") || !Array.isArray(journal.files) || !journal.files.length) throw new CliError("Invalid publication journal");
  const next = JSON.parse(journal.next);
  if (next.version !== "qeg-pointer/v1" || next.id !== ref.id || !/^sha256:[0-9a-f]{64}$/.test(next.hash)) throw new CliError("Invalid publication commit pointer");
  const current = await optionalRegular(join(root, POINTER));
  if (current !== journal.next && current !== journal.previous) throw new CliError("Publication pointer differs from both journal generations");
  const before = new Map<string, string | undefined>();
  for (const file of journal.files) {
    if (!file || !filename(file.name) || before.has(file.name)) throw new CliError("Invalid publication rollback filename");
    if (file.hash === undefined) before.set(file.name, undefined);
    else {
      const original = await optionalRegular(join(stage, ".qeg-rollback", file.name));
      if (original === undefined || digest(original) !== file.hash) throw new CliError(`Publication rollback hash mismatch: ${file.name}`);
      before.set(file.name, original);
    }
  }
  return { id: ref.id, committed: current === journal.next, before };
}

export async function assertPublicationComplete(root: string): Promise<void> {
  const pending = await pendingPublication(root);
  if (pending && !pending.committed) throw new CliError("Interrupted output publication; run outputs recover before reading or writing this input");
}

/** Idempotent recovery: keep the journal until every before-image has been restored. */
export async function recoverPendingPublication(root: string): Promise<void> {
  const pending = await pendingPublication(root);
  if (!pending) return;
  if (!pending.committed) for (const [name, bytes] of pending.before) {
    if (bytes === undefined) {
      try { await regular(join(root, name)); await unlink(join(root, name)); } catch (error) { if (!missing(error)) throw error; }
    } else await replace(root, name, bytes);
  }
  await unlink(join(root, PENDING));
}
