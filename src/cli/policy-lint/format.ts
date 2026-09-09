import { type PolicyLintReport } from "./model.js";


export function formatPolicyLintText(report: PolicyLintReport): string {
  const lines = [
    "QEG Policy Lint",
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.status.toUpperCase()}`,
    "",
  ];
  for (const item of report.items) {
    lines.push(`- ${item.severity.toUpperCase()} ${item.target}: ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}
