import { resolve } from "path";
import type { ResilienceAdapter } from "../../types.js";
import { CliError } from "../errors.js";
import { type NormalizeOptions } from "./model.js";


export function parseArgs(args: readonly string[]): NormalizeOptions {
  let adapter: ResilienceAdapter | undefined;
  let input: string | undefined;
  let context: string | undefined;
  let out: string | undefined;
  let baseDir = process.cwd();
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") { force = true; continue; }
    if (arg === "--adapter" || arg === "--input" || arg === "--context" || arg === "--out" || arg === "--base-dir") {
      const value = args[index + 1];
      if (!value) throw new CliError(`Expected value after ${arg}`);
      if (arg === "--adapter") adapter = value as ResilienceAdapter;
      if (arg === "--input") input = value;
      if (arg === "--context") context = value;
      if (arg === "--out") out = value;
      if (arg === "--base-dir") baseDir = value;
      index += 1;
      continue;
    }
    throw new CliError(`Unknown normalize argument: ${arg}`);
  }
  if (!adapter || !input || !context || !out) {
    throw new CliError("Usage: qeg evidence normalize --adapter <kind> --input <raw.json> --context <context.json> --out <evidence.json> [--base-dir <dir>] [--force]");
  }
  return { adapter, input, context, out, baseDir: resolve(baseDir), force };
}
