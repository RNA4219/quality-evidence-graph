import { createHash, randomUUID } from "crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "fs/promises";
import { createServer } from "net";
import { join } from "path";
import { CliError } from "./cli/errors.js";

const POINTER = ".qeg-current.json";
const GENERATIONS = ".qeg-generations";
const digest = (bytes: string | Buffer) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const filename = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== "generation.json";
interface Generation { version: "qeg-generation/v1"; id: string; previous?: Pointer; files: { name: string; hash: string }[]; }
interface Pointer { version: "qeg-pointer/v1"; id: string; hash: string; }
export interface PublishedOutputs { readonly generation: string; readonly files: ReadonlyMap<string, string>; }
/** Process-level acceptance instrumentation; never selected through environment variables. */
export interface PublishOptions { readonly onBoundary?: (boundary: string) => Promise<void>; }

async function regular(path: string): Promise<void> {
  if (!(await lstat(path)).isFile()) throw new CliError(`Output is not a regular file: ${path}`);
}
async function writeSynced(path: string, bytes: string): Promise<void> {
  const file = await open(path, "wx");
  try { await file.writeFile(bytes, "utf8"); await file.sync(); } finally { await file.close(); }
}
async function replace(root: string, name: string, bytes: string): Promise<void> {
  const target = join(root, name);
  try { await regular(target); } catch (error) { if (!missing(error)) throw error; }
  const temporary = join(root, `.qeg-replace-${randomUUID()}`);
  await writeSynced(temporary, bytes);
  try { await rename(temporary, target); }
  catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}

/** OS-owned lease, released on process death without stale-PID removal races.
 * Windows named pipes and Linux abstract sockets have no stale filesystem entry.
 * Other platforms use an exclusive loopback port; collisions fail explicitly.
 */
export async function withOutputLease<T>(directory: string, operation: (root: string) => Promise<T>): Promise<T> {
  const root = await realpath(directory);
  const identity = process.platform === "win32" ? root.toLowerCase() : root;
  const hash = createHash("sha256").update(identity).digest();
  const endpoint = process.platform === "win32" ? { path: `\\\\.\\pipe\\qeg-output-${hash.toString("hex")}` }
    : process.platform === "linux" ? { path: `\0qeg-output-${hash.toString("hex")}` }
    : { host: "127.0.0.1", port: 20000 + hash.readUInt32BE(0) % 40000, exclusive: true };
  const server = createServer(socket => socket.destroy());
  await new Promise<void>((accept, reject) => {
    server.once("error", error => reject(new CliError(`Output busy or lease unavailable (${root}): ${error}`)));
    server.listen(endpoint, accept);
  });
  try { return await operation(root); }
  finally { await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept())); }
}

async function generation(root: string, selected?: Pointer): Promise<(PublishedOutputs & { previous?: Pointer }) | undefined> {
  let pointerBytes: string;
  try { if (selected) pointerBytes = JSON.stringify(selected); else { await regular(join(root, POINTER)); pointerBytes = await readFile(join(root, POINTER), "utf8"); } }
  catch (error) { if (missing(error)) return undefined; throw error; }
  const pointer = JSON.parse(pointerBytes) as Pointer;
  if (pointer.version !== "qeg-pointer/v1" || !/^[0-9a-f-]{36}$/.test(pointer.id) || !/^sha256:[0-9a-f]{64}$/.test(pointer.hash)) throw new CliError("Invalid output generation pointer");
  const directory = join(root, GENERATIONS, pointer.id);
  if (!(await lstat(join(root, GENERATIONS))).isDirectory() || !(await lstat(directory)).isDirectory()) throw new CliError("Invalid generation directory");
  await regular(join(directory, "generation.json"));
  const bytes = await readFile(join(directory, "generation.json"), "utf8");
  if (digest(bytes) !== pointer.hash) throw new CliError("Generation manifest hash mismatch");
  const manifest = JSON.parse(bytes) as Generation;
  if (manifest.version !== "qeg-generation/v1" || manifest.id !== pointer.id || !Array.isArray(manifest.files) || !manifest.files.length) throw new CliError("Invalid generation manifest");
  const files = new Map<string, string>();
  for (const file of manifest.files) {
    if (!filename(file.name) || files.has(file.name)) throw new CliError("Invalid or duplicate generation filename");
    await regular(join(directory, file.name));
    const content = await readFile(join(directory, file.name), "utf8");
    if (digest(content) !== file.hash) throw new CliError(`Generation hash mismatch: ${file.name}`);
    files.set(file.name, content);
  }
  return { generation: pointer.id, files, previous: manifest.previous };
}

/** Internal: completion ancestry distinguishes committed history from abandoned sealed stages. */
export async function hasCommittedFile(root: string, name: string, bytes: string): Promise<boolean> {
  let current = await generation(root);
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.generation)) throw new CliError("Cyclic output generation history");
    seen.add(current.generation);
    if (current.files.get(name) === bytes) return true;
    current = current.previous ? await generation(root, current.previous) : undefined;
  }
  return false;
}

export async function readPublishedOutputs(directory: string): Promise<PublishedOutputs> {
  return withOutputLease(directory, async root => {
    const current = await generation(root);
    if (!current) throw new CliError("No completed output generation; rerun the original producer command");
    for (const [name, bytes] of current.files) {
      await regular(join(root, name));
      if (digest(await readFile(join(root, name))) !== digest(bytes)) throw new CliError(`Output alias hash mismatch: ${name}; run outputs recover`);
    }
    return current;
  });
}

/** Restore only a verified completed generation; retain uncommitted stages for diagnosis. */
export async function recoverOutputs(directory: string): Promise<string> {
  return withOutputLease(directory, async root => {
    const current = await generation(root);
    if (!current) throw new CliError("No completed generation to recover; rerun the original producer command");
    for (const [name, bytes] of current.files) await replace(root, name, bytes);
    return current.generation;
  });
}

/** Immutable files first, aliases second, atomic completion pointer last. */
export async function publishFiles(directory: string, files: ReadonlyMap<string, string>, options: PublishOptions = {}): Promise<void> {
  if (!files.size || [...files.keys()].some(name => !filename(name))) throw new CliError("Invalid output filename or empty publication");
  await mkdir(directory, { recursive: true });
  await withOutputLease(directory, root => publishFilesUnderLease(root, files, options));
}

/** Internal: caller must hold withOutputLease through its read/compare/write transaction. */
export async function publishFilesUnderLease(root: string, files: ReadonlyMap<string, string>, options: PublishOptions = {}): Promise<void> {
  if (!files.size || [...files.keys()].some(name => !filename(name))) throw new CliError("Invalid output filename or empty publication");
  const previous = await generation(root);
  const before = new Map<string, string | undefined>();
  for (const name of files.keys()) {
    try { await regular(join(root, name)); before.set(name, await readFile(join(root, name), "utf8")); }
    catch (error) { if (!missing(error)) throw error; before.set(name, undefined); }
  }
  const id = randomUUID();
  await mkdir(join(root, GENERATIONS), { recursive: true });
  if (!(await lstat(join(root, GENERATIONS))).isDirectory()) throw new CliError("Invalid generation root");
  const stage = join(root, GENERATIONS, id);
  await mkdir(stage);
  const boundary = async (name: string) => options.onBoundary?.(name);
  const published: string[] = [];
  let committed = false;
  try {
    await boundary("staged-directory");
    for (const [name, bytes] of files) { await writeSynced(join(stage, name), bytes); await boundary(`staged:${name}`); }
    const manifest: Generation = { version: "qeg-generation/v1", id,
      ...(previous ? { previous: JSON.parse(await readFile(join(root, POINTER), "utf8")) as Pointer } : {}),
      files: [...files].map(([name, bytes]) => ({ name, hash: digest(bytes) })) };
    const bytes = JSON.stringify(manifest) + "\n";
    await writeSynced(join(stage, "generation.json"), bytes);
    await boundary("sealed");
    for (const [name, content] of files) {
      await replace(root, name, content); published.push(name); await boundary(`alias:${name}`);
    }
    await replace(root, POINTER, JSON.stringify({ version: "qeg-pointer/v1", id, hash: digest(bytes) }) + "\n");
    committed = true;
    await boundary("committed");
  } catch (error) {
    const recovery: string[] = [];
    if (!committed) for (const name of published.reverse()) {
      try {
        const bytes = previous?.files.get(name) ?? before.get(name);
        if (bytes === undefined) await unlink(join(root, name)); else await replace(root, name, bytes);
      } catch (failure) { recovery.push(String(failure)); }
    }
    throw new CliError(`Publishing outputs failed: ${error}; recovery files: ${stage}; ${committed ? "new generation committed" : "previous generation retained"}${recovery.length ? `; recovery errors: ${recovery.join("; ")}` : ""}`);
  }
}
