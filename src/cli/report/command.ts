import { appendFile, mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { exit } from "process";
import { CliError } from "../errors.js";
import { createCiReport } from "./core.js";
import { formatCiReportText, formatGithubSummary } from "./formatter.js";
import type { CiReport, ReportFormat, ReportOptions } from "./model.js";
function parseReportArgs(args: readonly string[]): { options: ReportOptions; targets: string[] } {
  const targets: string[] = [];
  let format: ReportFormat = "text";
  let outPath: string | undefined;
  let githubSummary = false;
  let baselinePath: string | undefined;
  let changedOnly = false;
  let diffPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "text" && value !== "json") {
        throw new CliError("Expected --format text|json");
      }
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected output path after --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    if (arg === "--github-summary") {
      githubSummary = true;
      continue;
    }
    if (arg === "--baseline") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected baseline path after --baseline");
      }
      baselinePath = value;
      index += 1;
      continue;
    }
    if (arg === "--changed-only") {
      changedOnly = true;
      continue;
    }
    if (arg === "--diff") {
      const value = args[index + 1];
      if (!value) {
        throw new CliError("Expected previous report path after --diff");
      }
      diffPath = value;
      index += 1;
      continue;
    }
    targets.push(arg);
  }

  if (targets.length === 0) {
    throw new CliError(
      "Usage: qeg report [--json|--format text|json] [--out <path>] [--github-summary] [--baseline <path>] [--changed-only] [--diff <previous-report.json>] <fixture-dir-or-parent> [...]"
    );
  }

  return { options: { format, outPath, githubSummary, baselinePath, changedOnly, diffPath }, targets };
}

function formatReport(report: CiReport, format: ReportFormat): string {
  return format === "json"
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatCiReportText(report);
}

function reportExitCode(report: CiReport): number {
  if (report.summary.cliErrors > 0) return 1;
  if (report.summary.gateFailed > 0) return 2;
  return 0;
}

export async function runReportCommand(args: readonly string[]): Promise<void> {
  const { options, targets } = parseReportArgs(args);
  const report = await createCiReport(targets, {
    baselinePath: options.baselinePath,
    changedOnly: options.changedOnly,
    diffPath: options.diffPath,
  });
  const output = formatReport(report, options.format);

  if (options.outPath) {
    const outputPath = resolve(options.outPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf-8");
  }

  if (options.githubSummary) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new CliError("--github-summary requires GITHUB_STEP_SUMMARY to be set");
    }
    await appendFile(summaryPath, formatGithubSummary(report), "utf-8");
  }

  console.log(output.trimEnd());
  exit(reportExitCode(report));
}
