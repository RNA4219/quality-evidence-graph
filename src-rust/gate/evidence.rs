use super::*;
use regex::Regex;
use std::sync::LazyLock;

fn static_ref(code: &str) -> Value {
    let (path, start, end, label) = match code {
        "09" => (
            "retention-immutability",
            63,
            65,
            "sensitive value redaction requirement",
        ),
        "11" => (
            "gate-policy",
            65,
            66,
            "required connector contract violation",
        ),
        "15-POLICY" => ("gate-policy", 1, 10, "policyHash must match"),
        "15-APPROVAL" => (
            "evidence-package",
            1,
            10,
            "approval evidence required for release_decision",
        ),
        "15-APPROVAL-POLICYID" => (
            "waiver-approval",
            1,
            10,
            "ApprovalEvidence policyId must match GatePolicy",
        ),
        "15-APPROVAL-POLICYHASH" => (
            "waiver-approval",
            1,
            10,
            "ApprovalEvidence policyHash must match GatePolicy",
        ),
        "15-APPROVAL-PKGHASH" => (
            "waiver-approval",
            1,
            10,
            "ApprovalEvidence evidencePackageHash must match EvidencePackage",
        ),
        "15-APPROVAL-SOURCE" => (
            "waiver-approval",
            1,
            10,
            "ApprovalEvidence must have non-empty sourceRefs",
        ),
        "16" => (
            "retention-immutability",
            1,
            10,
            "storage classification must be immutable/versioned",
        ),
        "17" => (
            "waiver-approval",
            69,
            79,
            "ControlRoles required for IPO controlled",
        ),
        _ => unreachable!(),
    };
    json!([{"id":format!("SR-DQ-{code}"),"path":format!("docs/spec/{path}.md"),"startLine":start,"endLine":end,"label":label}])
}
fn input_contract(c: &Context) -> Vec<Value> {
    let mut out = vec![];
    let mut add = |m: &str, p: &str| out.push(dq("DQ-01", m, json!([]), json!([source(p, m)])));
    let k = &c.policy["inputContract"];
    let required = list(k, "requiredArtifacts");
    let scope = &k["evaluationScope"];
    if k.is_null() {
        add(
            "Gate policy inputContract is required; choose an explicit input mode and scope",
            "/policy/inputContract",
        );
        return out;
    }
    if !matches!(field(k, "mode"), "native_graph" | "upstream_artifacts")
        || !k["requiredArtifacts"].is_array()
        || required
            .iter()
            .any(|r| field(r, "adapter").is_empty() || field(r, "kind").is_empty())
        || !k["requireExecutedTests"].is_boolean()
        || !matches!(
            field(scope, "kind"),
            "fixture" | "isolated_consumer" | "real_environment"
        )
        || !nonblank(&scope["target"])
        || !scope["notEvaluated"].is_array()
        || !list(scope, "notEvaluated").iter().all(Value::is_string)
        || list(k, "sourceRefs").is_empty()
        || list(k, "sourceRefs")
            .iter()
            .any(|r| id(r).is_empty() || field(r, "path").is_empty())
    {
        add(
            "Gate inputContract has invalid mode, requirements, scope or source references",
            "/policy/inputContract",
        );
        return out;
    }
    let key = |r: &Value| format!("{}/{}", field(r, "adapter"), field(r, "kind"));
    let mut expected: BTreeSet<_> = required.iter().map(key).collect();
    if expected.is_empty() || expected.len() != required.len() {
        add(
            "Required artifact set must be non-empty and unique",
            "/policy/inputContract/requiredArtifacts",
        )
    }
    if k["mode"] == "upstream_artifacts" {
        let prev = expected.len();
        for (adapter, kinds) in [
            (
                "RanD",
                &["requirements_packet", "requirements_audit_packet"][..],
            ),
            (
                "code-to-gate",
                &[
                    "normalized_repo_graph",
                    "diff_analysis",
                    "findings",
                    "risk_register",
                    "test_seeds",
                    "release_readiness",
                    "audit",
                ],
            ),
            (
                "manual-bb-test-harness",
                &[
                    "feature_spec",
                    "risk_register",
                    "manual_case_set",
                    "gate_decision",
                    "execution_evidence",
                ],
            ),
        ] {
            expected.extend(kinds.iter().map(|k| format!("{adapter}/{k}")))
        }
        if expected.len() != prev {
            add(
                "Upstream input contract cannot omit any of the fourteen required artifact kinds",
                "/policy/inputContract/requiredArtifacts",
            )
        }
    }
    let available = list(c.meta, "inputArtifacts").iter().map(key).collect();
    let missing: Vec<_> = expected.difference(&available).cloned().collect();
    if !missing.is_empty() {
        add(
            &format!("Missing required artifacts: {}", missing.join(", ")),
            "/metadata/inputArtifacts",
        )
    }
    let absent: BTreeSet<_> = expected
        .iter()
        .filter_map(|k| k.split_once('/').map(|(a, _)| a))
        .filter(|a| c.meta["requiredConnectorStatus"].get(a).is_none())
        .collect();
    if !absent.is_empty() {
        add(
            &format!(
                "Required producer status missing: {}",
                absent.into_iter().collect::<Vec<_>>().join(", ")
            ),
            "/metadata/requiredConnectorStatus",
        )
    }
    if c.nodes.is_empty() {
        add(
            "Empty graph is not sufficient for a Gate decision",
            "/graph/nodes",
        )
    }
    out
}
fn ipo(c: &Context) -> Vec<Value> {
    let mut out = vec![];
    let p = c.package;
    let approvals = list(p, "approvalEvidence");
    for w in list(c.input, "waivers")
        .iter()
        .filter(|w| !flag(w, "valid") && list(w, "sourceRefs").is_empty())
    {
        out.push(dq(
            "DQ-15",
            format!("Waiver \"{}\" is not source-backed", id(w)),
            json!([id(w)]),
            json!([]),
        ))
    }
    if p.is_object() {
        if p["gatePolicy"]["policyHash"] != c.policy["policyHash"] {
            out.push(dq(
                "DQ-15",
                "Gate policy hash mismatch - policy integrity violated",
                json!([]),
                static_ref("15-POLICY"),
            ))
        }
        if p["phase"] == "release_decision" && approvals.is_empty() {
            out.push(dq(
                "DQ-15",
                "Approval evidence missing in release_decision phase",
                json!([]),
                static_ref("15-APPROVAL"),
            ))
        }
        if !matches!(
            field(p, "phase"),
            "implementation_preparation" | "pre_release_review" | "release_decision"
        ) || !p["approvalEvidence"].is_array()
        {
            out.push(dq(
                "DQ-15",
                "Evidence package phase or approval collection is invalid",
                json!([]),
                static_ref("15-APPROVAL"),
            ))
        } else {
            let clock = timestamp_nanos(&c.meta["createdAt"]);
            let mut seen = HashSet::new();
            for a in approvals {
                let time = timestamp_nanos(&a["approvedAt"]);
                if !fields_valid(
                    a,
                    &[
                        "id",
                        "approver",
                        "roleOrAuthority",
                        "approvedDecision",
                        "policyId",
                        "policyHash",
                        "evidencePackageHash",
                    ],
                ) || time.is_none()
                    || clock.zip(time).is_some_and(|(c, t)| t > c)
                    || !a["sourceRefs"].is_array()
                    || list(a, "sourceRefs")
                        .iter()
                        .any(|r| !fields_valid(r, &["id", "path"]))
                {
                    out.push(dq("DQ-15","Approval evidence has invalid identity, authority, decision, timestamp or sources",if nonblank(&a["id"]){json!([id(a)])}else{json!([])},static_ref("15-APPROVAL")))
                } else if seen.contains(id(a)) {
                    out.push(dq(
                        "DQ-15",
                        "Approval evidence IDs must be unique",
                        json!([id(a)]),
                        static_ref("15-APPROVAL"),
                    ))
                }
                seen.insert(id(a));
            }
        }
        for a in approvals.iter().filter(|a| !a.is_null()) {
            for (k, expected, src) in [
                ("policyId", &c.policy["policyId"], "15-APPROVAL-POLICYID"),
                (
                    "policyHash",
                    &c.policy["policyHash"],
                    "15-APPROVAL-POLICYHASH",
                ),
                (
                    "evidencePackageHash",
                    &p["evidencePackageHash"],
                    "15-APPROVAL-PKGHASH",
                ),
            ] {
                if (k != "evidencePackageHash" || nonblank(expected)) && &a[k] != expected {
                    out.push(dq(
                        "DQ-15",
                        format!(
                            "ApprovalEvidence \"{}\" {k} mismatch - expected \"{}\", got \"{}\"",
                            id(a),
                            s(expected),
                            field(a, k)
                        ),
                        json!([id(a)]),
                        static_ref(src),
                    ))
                }
            }
            if list(a, "sourceRefs").is_empty() {
                out.push(dq(
                    "DQ-15",
                    format!("ApprovalEvidence \"{}\" has no sourceRefs", id(a)),
                    json!([id(a)]),
                    static_ref("15-APPROVAL-SOURCE"),
                ))
            }
        }
        let class = field(&p["retention"], "storageClassification");
        if matches!(class, "unknown" | "mutable") {
            out.push(dq("DQ-16",if class=="unknown"{"Evidence storage immutability is unknown; release judgment requires a verified storage classification"}else{"Evidence used for release judgment exists only in silent-overwrite capable storage"},json!([]),static_ref("16")))
        }
    }
    if c.meta["profile"] == "ipo_controlled"
        && !fields_valid(
            &p["controlRoles"],
            &[
                "producer",
                "reviewer",
                "approver",
                "waiverApprover",
                "releaseOwner",
            ],
        )
    {
        out.push(dq(
            "DQ-17",
            "Control roles (producer/reviewer/approver/waiverApprover/releaseOwner) not recorded",
            json!([]),
            static_ref("17"),
        ))
    }
    out
}
fn revisions(c: &Context) -> Vec<Value> {
    let mut out = vec![];
    let head = field(c.meta, "headRef");
    let checks = list(c.meta, "producerChecks");
    if !head.is_empty() {
        for a in list(c.meta, "inputArtifacts")
            .iter()
            .filter(|a| !field(a, "revision").is_empty() && a["revision"] != head)
        {
            out.push(dq(
                "DQ-12",
                format!(
                    "Artifact revision \"{}\" mismatch with headRef \"{head}\"",
                    field(a, "revision")
                ),
                json!([id(a)]),
                json!([]),
            ))
        }
        for a in checks
            .iter()
            .filter(|a| !field(a, "headSha").is_empty() && a["headSha"] != head)
        {
            out.push(dq(
                "DQ-12",
                format!(
                    "Producer check \"{}\" headSha \"{}\" mismatch with headRef \"{head}\"",
                    field(a, "name"),
                    field(a, "headSha")
                ),
                json!([id(a)]),
                json!(list(a, "sourceRefs")),
            ))
        }
    }
    for a in checks {
        let ready = field(a, "readinessStatus");
        let end = field(a, "conclusion");
        let valid = match ready {
            "passed" | "passed_with_risk" => end == "success",
            "needs_review" => matches!(end, "neutral" | "action_required"),
            "blocked_input" | "failed" => matches!(end, "failure" | "action_required"),
            _ => true,
        };
        if !valid {
            out.push(dq("DQ-12",format!("Producer check \"{}\" conclusion \"{end}\" contradicts readiness status \"{ready}\"",field(a,"name")),json!([id(a)]),json!(list(a,"sourceRefs"))))
        }
    }
    out
}
pub(super) fn detect(
    c: &Context,
    blockers: &[Value],
    manual: &manual::Manual,
    execution: &Value,
) -> Vec<Value> {
    let preflight = list(c.input, "preflightDisqualifications");
    let mut out: Vec<_> = preflight
        .iter()
        .filter(|d| d["code"] == "DQ-01")
        .cloned()
        .collect();
    if timestamp_nanos(&c.meta["createdAt"]).is_none() {
        out.push(dq(
            "DQ-01",
            format!(
                "metadata.createdAt is not a parseable evaluation clock: {}",
                field(c.meta, "createdAt")
            ),
            json!([]),
            json!([{"id":"qeg:evaluation-clock","path":"docs/spec/reliability-extension.md"}]),
        ))
    }
    let comp = &c.input["graph"]["completeness"];
    for f in list(comp, "parserFailures") {
        out.push(dq(
            f["code"].as_str().unwrap_or("DQ-01"),
            format!("Parser failure: {}", field(f, "reason")),
            json!([]),
            json!(list(f, "sourceRefs")),
        ))
    }
    out.extend(input_contract(c));
    for b in blockers.iter().filter(|b| list(b, "sourceRefs").is_empty()) {
        out.push(dq(
            "DQ-02",
            format!("Blocker \"{}\" has no sourceRefs", field(b, "message")),
            b["riskIds"].clone(),
            json!([]),
        ))
    }
    for claim in list(comp, "unsupportedClaims")
        .iter()
        .filter(|x| flag(x, "gateRelevant"))
    {
        out.push(dq(
            "DQ-03",
            format!("Unsupported claim: {}", field(claim, "claim")),
            claim["nodeIds"].clone(),
            json!([]),
        ))
    }
    for r in only(c.nodes, "risk").filter(|r| {
        matches!(field(r, "priority"), "P0" | "P1")
            && num(r, "evidenceGap") > 0.5
            && !c.waived(id(r))
            && !manual.reviewed.contains(id(r))
    }) {
        out.push(dq(
            "DQ-04",
            format!(
                "P0/P1 risk \"{}\" with oracle gap treated as fact",
                field(r, "title")
            ),
            json!([id(r)]),
            refs(r),
        ))
    }
    out.extend(coverage::coverage(c));
    out.extend(preflight.iter().filter(|d| d["code"] == "DQ-06").cloned());
    if flag(comp, "partial") && comp.get("score").is_none() {
        out.push(dq(
            "DQ-07",
            "Partial graph without explicit completeness score",
            json!([]),
            json!([]),
        ))
    }
    out.extend(manual.dqs.iter().cloned());
    static SENSITIVE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?i:password|api[_-]?key|token|secret)\s*=\s*["'][^"']+["']|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"#).unwrap()
    });
    if c.package.is_object() && SENSITIVE.is_match(&c.package.to_string()) {
        out.push(dq(
            "DQ-09",
            "Unredacted sensitive value detected in evidence package",
            json!([]),
            static_ref("09"),
        ))
    }
    if flag(c.meta, "benchmarkMode") && flag(c.meta, "hiddenOracleAccessed") {
        out.push(dq(
            "DQ-10",
            "Candidate accessed hidden oracle in benchmark mode",
            json!([]),
            json!([]),
        ))
    }
    if let Some(status) = c.meta["requiredConnectorStatus"].as_object() {
        for (adapter, _) in status.iter().filter(|(_, v)| *v == "contract_violation") {
            out.push(dq(
                "DQ-11",
                format!("Required connector \"{adapter}\" contract violation treated as success"),
                json!([]),
                static_ref("11"),
            ))
        }
    }
    out.extend(revisions(c));
    if c.package.is_object() && list(c.package, "sourceRefs").is_empty() {
        out.push(dq(
            "DQ-13",
            "Evidence package sourceRefs is empty",
            json!([]),
            json!([]),
        ))
    }
    out.extend(coverage::retirement(c, execution));
    out.extend(ipo(c));
    out
}
