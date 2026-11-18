#!/usr/bin/env bash
set -euo pipefail

output_dir=$(dirname "$QEG_OUTPUT_PATH")
mkdir -p "$output_dir"
staging=$(mktemp -d "$output_dir/.qeg-report-XXXXXXXX")
trap 'rm -rf -- "$staging"' EXIT
report="$staging/report.json"

export QEG_DISTRIBUTION_ROOT
QEG_DISTRIBUTION_ROOT=$(cd "$QEG_ACTION_PATH/.." && pwd)
manifest="$QEG_DISTRIBUTION_ROOT/Cargo.toml"
native=(cargo run --quiet --locked --manifest-path "$manifest" --bin qeg --)
if [[ -n "$QEG_REPORT_COMMAND" ]]; then
  read -r -a command <<< "$QEG_REPORT_COMMAND"
else
  command=("${native[@]}")
fi

args=(report --json --out "$report")
if [[ "$QEG_GITHUB_SUMMARY" == true ]]; then args+=(--github-summary); fi
if [[ -n "$QEG_BASELINE" ]]; then args+=(--baseline "$QEG_BASELINE"); fi
if [[ "$QEG_CHANGED_ONLY" == true ]]; then args+=(--changed-only); fi
if [[ -n "$QEG_PREVIOUS_REPORT" ]]; then args+=(--diff "$QEG_PREVIOUS_REPORT"); fi
read -r -a targets <<< "${QEG_TARGETS//$'\n'/ }"
if (( ${#targets[@]} == 0 )); then targets=(.qeg); fi

export QEG_EFFECTIVE_REPORT_COMMAND="${command[*]}"
report_exit=0
"${command[@]}" "${args[@]}" "${targets[@]}" || report_exit=$?
if "${native[@]}" __action-summary "$report" "$report_exit"; then exit 0; fi

# A runner with a missing toolchain still uploads diagnostics before enforcement.
message="The tagged Rust Action runtime could not finalize the report."
generated_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat > "$QEG_OUTPUT_PATH" <<EOF
{
  "reportVersion":"qeg-ci-report-v2","generatedAt":"$generated_at",
  "selection":{"mode":"all","status":"detection_failed","strategy":"all","changedFileCount":0,"selectedTargetCount":0,"error":"$message"},
  "errors":[{"code":"ACTION_REPORT_FAILED","message":"$message"}],
  "summary":{"totalTargets":1,"passed":0,"baselineAccepted":0,"gateFailed":0,"cliErrors":1,"dqCounts":[],"blockerCount":0,"residualRiskCount":0,"humanReviewCount":0},
  "targets":[{"target":"qeg","status":"cli_error","exitCode":1,"reasons":[],"disqualifications":[],"blockers":[],"residualRisks":[],"requiredHumanReview":[],"error":"$message"}]
}
EOF
printf '## QEG CI Report\n\n%s\n' "$message" > "$QEG_SUMMARY_PATH"
if [[ "$QEG_GITHUB_SUMMARY" == true && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then cat "$QEG_SUMMARY_PATH" >> "$GITHUB_STEP_SUMMARY"; fi
printf '1\n' > "$output_dir/qeg-report-exit-code.txt"
printf 'gate_failed=0\ncli_errors=1\ndq_count=0\nreport_path=%s\nsummary_markdown_path=%s\nexit_code=1\n' "$QEG_OUTPUT_PATH" "$QEG_SUMMARY_PATH" >> "$GITHUB_OUTPUT"
