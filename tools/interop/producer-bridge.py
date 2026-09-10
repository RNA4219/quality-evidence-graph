"""Run pinned RanD APIs and manual-bb CLI against an actual isolated CLI target.

Manual risk/case inputs are operator-authored designs. Observations below come
from subprocess execution, never from a preselected pass value. Producer output
files are not rewritten by QEG or by this bridge after generation.
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

p = argparse.ArgumentParser()
for key in ["rand", "manual", "target", "out", "run", "build", "node"]:
    p.add_argument("--" + key, required=True)
a = p.parse_args()
sys.path[:0] = [str(Path(a.rand) / "research-runtime/src"), str(Path(a.manual) / "src")]
from rand_research.models import NormalizedItem
from rand_research.kano import build_kano_artifacts, build_audit_artifacts
from rand_research.artifact_schema import validate_artifact_payload
from bb_harness.cli import main as manual_cli
from bb_harness.gate_engine import main as manual_gate
from bb_harness.tools.validate_artifact import validate_artifact

out = Path(a.out)
out.mkdir(parents=True, exist_ok=False)
target = Path(a.target)

def save(name, payload):
    (out / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

item = NormalizedItem(id="increment-requirement", kind="spec", source_name="isolated-target", url="spec.md",
    title="The CLI increments a supplied integer", summary=(target / "spec.md").read_text(encoding="utf-8"),
    metadata={"requirement_id": "REQ-001", "source_tier": "primary", "kano_type": "performance", "confidence": 0.9,
      "bias_note": "A small isolated CLI does not establish production readiness", "kill_condition": "Reject if observed CLI output differs from the specification",
      "testability": "high", "implementation_alignment": "high"})
preset = {"name": "QEG isolated interoperability", "audit_document_ref": "spec.md", "audit_document_id": "rand:isolated-cli",
    "assumptions": ["Locally authored specification; no survey or production claim"]}
for kind, payload in {**build_kano_artifacts([item], preset, a.run), **build_audit_artifacts([item], preset, a.run)}.items():
    if kind == "kano":
        continue
    validation = validate_artifact_payload(payload, kind)
    save(kind + ".json", payload)
    save(kind + ".validation.json", validation)

assert manual_cli(["ingest", "--source", "markdown", "--input", str(target / "spec.md"), "--output", str(out / "feature_spec.json")]) == 0
feature = "CLI-INCREMENT"
risks = {"feature_id": feature, "risks": [{"id": "RISK-01", "scenario": "The result is not the specified successor", "impact": 4, "likelihood": 2,
    "priority": "P1", "trace_to": ["TC-001"], "rationale": "spec.md AC-1: 41 must produce 42"}]}
cases = {"feature_id": feature, "manual_cases": [{"tc_id": "TC-001", "title": "Observe the increment CLI", "priority": "P1", "primary_view": "black",
    "techniques": ["equivalence"], "source_ref": {"type": "acceptance", "refs": ["AC-1"]}, "steps": ["Run node src/cli.mjs 41 and observe exit status and stdout"],
    "expected_results": ["exit=0; stdout=42"], "oracle": {"type": "specified", "refs": ["spec.md#acceptance-criteria"]}, "trace_to": ["RISK-01"]}],
    "exploratory_charters": [], "platform_matrix": [], "role_matrix": []}
save("risk_register.json", risks)
save("manual_case_set.json", cases)
observed = subprocess.run([a.node, "src/cli.mjs", "41"], cwd=target, capture_output=True, text=True, check=False)
actual = f"exit={observed.returncode}; stdout={observed.stdout.strip()}"
save("observation.json", {"command": ["node", "src/cli.mjs", "41"], "exitCode": observed.returncode, "stdout": observed.stdout, "stderr": observed.stderr})
evidence = {"run_id": "RUN-" + a.run, "feature_id": feature, "build_id": a.build, "timestamp": datetime.now(timezone.utc).isoformat(),
    "tc_id": "TC-001", "result": "pass" if actual == "exit=0; stdout=42" else "fail", "env": "isolated-local", "tester": "QEG acceptance runner (agent-operated CLI observation)",
    "oracle_type": "specified", "oracle_refs": ["spec.md#acceptance-criteria"], "expected": ["exit=0; stdout=42"], "actual": [actual], "attachments": []}
save("execution_evidence.json", evidence)
for name in ["feature_spec", "risk_register", "manual_case_set", "execution_evidence"]:
    report = validate_artifact(out / (name + ".json"), name)
    save(name + ".validation.json", report)
    if report.get("errors"):
        raise RuntimeError(report)
assert manual_gate(["--evidence", str(out / "execution_evidence.json"), "--risk", str(out / "risk_register.json"),
    "--cases", str(out / "manual_case_set.json"), "--feature", str(out / "feature_spec.json"), "--build-id", a.build,
    "--profile", "lean", "--output", str(out / "gate_decision.json")]) == 0
