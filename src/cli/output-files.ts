import { lstat, mkdir, mkdtemp, rename, rmdir, unlink, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { CliError } from "./errors.js";

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

/** 検証済みファイル群をstageし、公開途中の失敗は元のファイルへ戻す。 */
export async function publishFiles(directory: string, files: ReadonlyMap<string, string>): Promise<void> {
  const root = resolve(directory);
  for (const name of files.keys()) if (basename(name) !== name || name === "." || name === "..") throw new CliError(`Invalid output filename: ${name}`);
  await mkdir(root, { recursive: true });
  const stage = await mkdtemp(join(root, ".qeg-output-"));
  const transactions: { name: string; backedUp: boolean; published: boolean }[] = [];
  try {
    for (const [name, content] of files) await writeFile(join(stage, name), content, "utf8");
    for (const name of files.keys()) {
      try { if (!(await lstat(join(root, name))).isFile()) throw new CliError(`Output is not a regular file: ${join(root, name)}`); }
      catch (error) { if (!missing(error)) throw error; }
    }
    for (const name of files.keys()) {
      const tx = { name, backedUp: false, published: false };
      transactions.push(tx);
      try { await rename(join(root, name), join(stage, `${name}.previous`)); tx.backedUp = true; }
      catch (error) { if (!missing(error)) throw error; }
      await rename(join(stage, name), join(root, name));
      tx.published = true;
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const tx of [...transactions].reverse()) {
      try {
        if (tx.published) await unlink(join(root, tx.name));
        if (tx.backedUp) await rename(join(stage, `${tx.name}.previous`), join(root, tx.name));
      } catch (rollback) { rollbackErrors.push(String(rollback)); }
    }
    throw new CliError(`Publishing outputs in ${root} failed: ${String(error)}; recovery files: ${stage}${rollbackErrors.length ? `; rollback: ${rollbackErrors.join("; ")}` : ""}`);
  }
  for (const tx of transactions) if (tx.backedUp) await unlink(join(stage, `${tx.name}.previous`));
  await rmdir(stage);
}
