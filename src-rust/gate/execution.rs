use super::*;
use sha2::{Digest, Sha256};
use std::cmp::Reverse;

pub(super) fn full_revision(v: &Value) -> bool {
    v.as_str()
        .is_some_and(|s| matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit()))
}
pub(super) fn valid_hash(v: &Value) -> bool {
    v.as_str()
        .and_then(|s| s.strip_prefix("sha256:"))
        .is_some_and(|h| {
            h.len() == 64
                && h.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
}
fn valid_ref(v: &Value) -> bool {
    fields_valid(v, &["id", "path"])
        && valid_hash(&v["contentHash"])
        && full_revision(&v["revision"])
}
fn valid_target(t: &Value) -> bool {
    fields_valid(t, &["projectId", "buildId", "environmentId"]) && full_revision(&t["revision"])
}
fn valid_identity(t: &Value) -> bool {
    fields_valid(t, &["producer", "projectId", "featureId", "caseId"])
}
fn valid_sources(v: &Value) -> bool {
    !items(v).is_empty() && items(v).iter().all(|r| fields_valid(r, &["id", "path"]))
}
pub fn valid_execution_policy(v: &Value) -> bool {
    valid_target(&v["target"])
        && num(v, "maxEvidenceAgeHours") > 0.
        && (num(v, "maxEvidenceAgeHours") * 3600000.).is_finite()
        && valid_ref(&v["buildBindingRef"])
        && valid_sources(&v["sourceRefs"])
}
pub fn valid_execution(v: &Value) -> bool {
    v["executionVersion"] == "qeg-execution/v1"
        && valid_identity(&v["identity"])
        && valid_target(&v["target"])
        && fields_valid(v, &["testId", "producerVersion", "runId"])
        && valid_ref(&v["rawArtifactRef"])
        && matches!(
            field(v, "status"),
            "pass" | "fail" | "skipped" | "blocked" | "cancelled" | "unknown" | "running"
        )
        && matches!(field(v, "executionMode"), "real" | "mock")
        && v.get("historySourceRefs").is_none_or(valid_sources)
}
fn normal<'a>(input: &'a Value, kind: &str) -> Vec<&'a Value> {
    let tag = if kind == "test" {
        "testType"
    } else {
        "evidenceType"
    };
    let mut nodes: Vec<_> = list(&input["graph"], "nodes")
        .iter()
        .filter(|n| n["kind"] == kind && n[tag] != "resilience")
        .collect();
    nodes.sort_by(|a, b| id(a).encode_utf16().cmp(id(b).encode_utf16()));
    nodes
}
fn sorted(values: &[Value]) -> Vec<&Value> {
    let mut v: Vec<_> = values.iter().collect();
    v.sort_by(|a, b| id(a).encode_utf16().cmp(id(b).encode_utf16()));
    v
}
fn canonical(v: &Value) -> String {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            format!(
                "{{{}}}",
                keys.into_iter()
                    .map(|k| format!("{}:{}", json!(k), canonical(&map[k])))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        Value::Array(a) => format!(
            "[{}]",
            a.iter().map(canonical).collect::<Vec<_>>().join(",")
        ),
        Value::Number(n) => ryu_js::Buffer::new()
            .format_finite(n.as_f64().expect("finite JSON number"))
            .to_owned(),
        _ => v.to_string(),
    }
}
pub fn execution_fingerprint(input: &Value) -> String {
    let mut meta = input["metadata"].clone();
    meta["inputArtifacts"] = json!(sorted(list(&meta, "inputArtifacts")));
    let mut graph_meta = input["graph"]["metadata"].clone();
    graph_meta["inputArtifacts"] = json!(sorted(list(&graph_meta, "inputArtifacts")));
    let mut obj = json!({
        "metadata": meta, "graphMetadata": graph_meta,
        "tests": normal(input,"test"), "evidence": normal(input,"execution_evidence"),
        "edges": sorted(list(&input["graph"], "edges")),
    });
    if let Some(p) = input["policy"].get("executionPolicy") {
        obj["policy"] = p.clone()
    }
    format!("{:x}", Sha256::digest(canonical(&obj).as_bytes()))
}
fn add(c: &Context, out: &mut Vec<Value>, code: &str, msg: &str, ids: Vec<&str>) {
    let mut refs = vec![source("/policy/executionPolicy", msg)];
    for n in c.nodes.iter().filter(|n| ids.contains(&id(n))) {
        refs.extend(list(&n["traceability"], "sourceRefs").iter().cloned())
    }
    let b = &c.policy["executionPolicy"]["buildBindingRef"];
    if b.is_object() {
        let mut v = json!({});
        for k in ["id", "path", "revision"] {
            if let Some(x) = b.get(k) {
                v[k] = x.clone()
            }
        }
        v["label"] = json!("EAC-01 target build binding");
        refs.push(v)
    }
    out.push(dq(code, msg, json!(ids), json!(unique(refs))))
}
fn decision(n: &Value) -> Value {
    let mut v = n["execution"].clone();
    let r = &v["rawArtifactRef"];
    v["rawArtifactRef"] = json!({"contentHash":r["contentHash"],"revision":r["revision"]});
    v
}
fn latest(
    test: &Value,
    candidates: &[&Value],
    now: i128,
    age: i128,
    mut excluded: Vec<Value>,
) -> (Value, Option<&'static str>) {
    let empty = |reason: &'static str, excluded: &[Value]| {
        (
            json!({"testId":id(test),"reason":reason,"consecutivePasses":0,"excluded":excluded}),
            Some(reason),
        )
    };
    let mut runs = HashMap::new();
    let mut ordered = vec![];
    for &n in candidates {
        let run = field(&n["execution"], "runId");
        if let Some(&previous) = runs.get(run) {
            if decision(previous) != decision(n) {
                return empty("EAC-03 conflicting execution identity", &excluded);
            }
            excluded.push(json!({"evidenceId":id(n),"reason":"duplicate"}));
        } else {
            runs.insert(run, n);
            ordered.push(n)
        }
    }
    let completed =
        |e: &Value| timestamp_nanos(&e["execution"]["completedAt"]).expect("qualified timestamp");
    ordered.sort_by_key(|n| Reverse(completed(n)));
    let Some(first) = ordered.first() else {
        return empty("EAC-06 no current execution", &excluded);
    };
    if ordered
        .get(1)
        .is_some_and(|e| completed(e) == completed(first))
    {
        return empty("EAC-03 ambiguous latest completion time", &excluded);
    }
    if now - completed(first) > age {
        return empty("EAC-02 latest execution is stale", &excluded);
    }
    let mut passes = 0;
    for (i, e) in ordered.iter().enumerate() {
        let stale = now - completed(e) > age;
        if i > 0 {
            excluded.push(
                json!({"evidenceId":id(e),"reason":if stale{"superseded_stale"}else{"superseded"}}),
            )
        }
        if passes == i
            && e["execution"]["status"] == "pass"
            && !stale
            && !ordered
                .get(i + 1)
                .is_some_and(|next| completed(next) == completed(e))
        {
            passes += 1
        }
    }
    excluded.sort_by(|a, b| field(a, "evidenceId").cmp(field(b, "evidenceId")));
    (
        json!({
            "testId": id(test), "selectedEvidenceId": id(first),
            "selectedRunId": first["execution"]["runId"], "selectedStatus": first["execution"]["status"],
            "reason": "latest_qualified_execution", "consecutivePasses": passes, "excluded": excluded,
        }),
        None,
    )
}
fn linked(c: &Context, t: &Value, e: &Value) -> bool {
    e["execution"]["testId"] == t["id"]
        || c.edges.iter().any(|edge| {
            edge["kind"] == "evidenced_by" && edge["from"] == t["id"] && edge["to"] == e["id"]
        })
}
fn check_candidate(
    c: &Context,
    t: &Value,
    e: &Value,
    now: Option<i128>,
    out: &mut Vec<Value>,
    excluded: &mut Vec<Value>,
) -> bool {
    let d = &e["execution"];
    let policy = &c.policy["executionPolicy"];
    if !valid_execution(d) {
        add(
            c,
            out,
            "DQ-01",
            "EAC-01/04 execution contract is incomplete",
            vec![id(t), id(e)],
        );
        return false;
    }
    let from: HashSet<_> = c
        .edges
        .iter()
        .filter(|edge| edge["kind"] == "evidenced_by" && edge["to"] == e["id"])
        .map(|edge| field(edge, "from"))
        .collect();
    if d["testId"] != t["id"]
        || d["identity"] != t["executionIdentity"]
        || from.len() != 1
        || !from.contains(id(t))
    {
        add(
            c,
            out,
            "DQ-03",
            "EAC-04 test, case, feature, producer or graph link disagrees",
            vec![id(t), id(e)],
        );
        return false;
    }
    if valid_sources(&d["historySourceRefs"]) {
        excluded.push(json!({"evidenceId":id(e),"reason":"explicit_history"}));
        return false;
    }
    if d["target"] != policy["target"]
        || d["identity"]["projectId"] != policy["target"]["projectId"]
        || d["rawArtifactRef"]["revision"] != policy["target"]["revision"]
    {
        add(
            c,
            out,
            "DQ-12",
            "EAC-01 execution target differs from Gate target",
            vec![id(e)],
        )
    }
    let completed = timestamp_nanos(&d["completedAt"]);
    if now.zip(completed).is_none_or(|(n, t)| t > n) {
        add(
            c,
            out,
            "DQ-05",
            "EAC-02 invalid or future completion time",
            vec![id(e)],
        )
    }
    if d["executionMode"] != "real" {
        add(
            c,
            out,
            "DQ-05",
            "EAC-06 mock execution cannot qualify",
            vec![id(e)],
        )
    }
    if e.get("passed").is_some()
        && (!matches!(field(d, "status"), "pass" | "fail")
            || e["passed"] != (d["status"] == "pass"))
    {
        add(
            c,
            out,
            "DQ-03",
            "EAC-03 passed flag contradicts execution status",
            vec![id(e)],
        )
    }
    if list(e, "evidenceRefs").is_empty()
        || list(e, "evidenceRefs").iter().any(|r| {
            !valid_ref(r)
                || r["revision"] != d["target"]["revision"]
                || (r["evidenceKind"] == "test_result"
                    && timestamp_nanos(&r["capturedAt"]) != completed)
        })
    {
        add(
            c,
            out,
            "DQ-06",
            "EAC-05 execution evidence refs need matching revision, hash and capture time",
            vec![id(e)],
        )
    }
    let raw = &d["rawArtifactRef"];
    if d["identity"]["producer"] == "manual-bb-test-harness"
        && (!contains(&e["sourceArtifactIds"], id(raw))
            || !list(c.meta, "inputArtifacts").iter().any(|a| {
                a["adapter"] == d["identity"]["producer"]
                    && a["kind"] == "execution_evidence"
                    && ["id", "path", "contentHash", "revision"]
                        .iter()
                        .all(|k| a[k] == raw[k])
            }))
    {
        add(
            c,
            out,
            "DQ-06",
            "EAC-04/05 raw execution disagrees with its source artifact descriptor",
            vec![id(e), id(raw)],
        )
    }
    true
}
pub(super) fn assess(c: &Context) -> Assessment {
    let tests = normal(c.input, "test");
    let evidence = normal(c.input, "execution_evidence");
    let required: HashSet<_> = list(c.plan, "obligations")
        .iter()
        .filter(|o| {
            (o["gateRelevance"] == "blocking" || !list(o, "changedCodeIds").is_empty())
                && !c.all_waived(&strings(&o["riskIds"]))
        })
        .map(id)
        .collect();
    let selected: HashSet<_> = list(c.plan, "placements")
        .iter()
        .filter(|p| {
            flag(&c.policy["inputContract"], "requireExecutedTests")
                && p["disposition"] != "blocked"
                && required.contains(field(p, "obligationId"))
        })
        .flat_map(|p| strings(&p["selectedTestIds"]))
        .collect();
    let active: Vec<_> = tests
        .iter()
        .copied()
        .filter(|t| {
            selected.contains(id(t))
                || t.get("evidenceStrength").is_some()
                || t.get("recentGreenRuns").is_some()
                || evidence.iter().any(|e| linked(c, t, e))
        })
        .collect();
    let mut out = Assessment::default();
    if active.is_empty() && !evidence.iter().any(|e| e["execution"].is_object()) {
        return out;
    }
    let policy = &c.policy["executionPolicy"];
    out.accounting = json!({"evaluatedAt":c.meta["createdAt"]});
    if valid_target(&policy["target"]) {
        out.accounting["target"] = policy["target"].clone()
    }
    out.accounting["selections"] = json!([]);
    if !valid_execution_policy(policy) {
        add(
            c,
            &mut out.dqs,
            "DQ-01",
            "EAC-01/02 explicit source-backed executionPolicy is required",
            active.iter().map(|t| id(t)).collect(),
        );
        return out;
    }
    let revision = &policy["target"]["revision"];
    if revision != &c.meta["headRef"]
        || revision != &c.input["graph"]["metadata"]["headRef"]
        || revision != &policy["buildBindingRef"]["revision"]
    {
        add(
            c,
            &mut out.dqs,
            "DQ-12",
            "EAC-01 policy, build binding and Gate revisions disagree",
            vec![],
        )
    }
    let now = timestamp_nanos(&c.meta["createdAt"]);
    if now.is_none() {
        add(
            c,
            &mut out.dqs,
            "DQ-05",
            "EAC-02 invalid evaluation clock (timezone and valid calendar required)",
            vec![],
        )
    }
    let verified = &c.input["evidenceVerification"];
    if verified["executionFingerprint"] != execution_fingerprint(c.input)
        || verified["status"] == "fail"
    {
        add(
            c,
            &mut out.dqs,
            "DQ-06",
            "EAC-05 verified artifacts and matching execution fingerprint are required",
            evidence.iter().map(|e| id(e)).collect(),
        )
    }
    for t in &active {
        let aliases: Vec<_> = tests
            .iter()
            .filter(|other| {
                other["id"] != t["id"]
                    && valid_identity(&t["executionIdentity"])
                    && other["executionIdentity"] == t["executionIdentity"]
            })
            .map(|n| id(n))
            .collect();
        if !aliases.is_empty() {
            let mut ids = vec![id(t)];
            ids.extend(aliases);
            add(
                c,
                &mut out.dqs,
                "DQ-03",
                "EAC-04 one execution identity maps to multiple tests",
                ids,
            )
        }
    }
    let invalid = !out.dqs.is_empty();
    for e in evidence.iter().filter(|e| {
        e["execution"].is_object() && !tests.iter().any(|t| t["id"] == e["execution"]["testId"])
    }) {
        add(
            c,
            &mut out.dqs,
            "DQ-03",
            "EAC-04 execution references missing or incompatible test",
            vec![id(e)],
        )
    }
    let mut selections = vec![];
    for t in active {
        let candidates: Vec<_> = evidence
            .iter()
            .copied()
            .filter(|e| linked(c, t, e))
            .collect();
        let before = out.dqs.len();
        if !valid_identity(&t["executionIdentity"]) {
            add(
                c,
                &mut out.dqs,
                "DQ-01",
                "EAC-04 test executionIdentity is required",
                vec![id(t)],
            )
        }
        if t["testExecutionMode"] != "real" || flag(t, "deleted") {
            add(
                c,
                &mut out.dqs,
                "DQ-05",
                "EAC-06 test is mock or deleted",
                vec![id(t)],
            )
        }
        let mut excluded = vec![];
        let current: Vec<_> = candidates
            .iter()
            .copied()
            .filter(|e| check_candidate(c, t, e, now, &mut out.dqs, &mut excluded))
            .collect();
        if invalid || before != out.dqs.len() {
            let excluded: Vec<_> = candidates
                .iter()
                .map(|e| json!({"evidenceId":id(e),"reason":"qualification_failed"}))
                .collect();
            selections.push(json!({
                "testId": id(t), "reason": "invalid_current_evidence",
                "consecutivePasses": 0, "excluded": excluded,
            }));
            continue;
        }
        let age_ms = num(policy, "maxEvidenceAgeHours") * 3600000.;
        let age = age_ms.floor() as i128;
        let age = age
            .saturating_mul(1000000)
            .saturating_add((age_ms.fract() * 1000000.).floor() as i128);
        let (sel, error) = latest(
            t,
            &current,
            now.expect("verified evaluation time"),
            age,
            excluded,
        );
        if let Some(reason) = error {
            let ids = std::iter::once(id(t))
                .chain(current.iter().map(|e| id(e)))
                .collect();
            add(
                c,
                &mut out.dqs,
                if reason.contains("conflicting") {
                    "DQ-03"
                } else {
                    "DQ-05"
                },
                reason,
                ids,
            )
        } else if !matches!(field(&sel, "selectedStatus"), "pass" | "fail") {
            add(
                c,
                &mut out.dqs,
                "DQ-05",
                "EAC-06 latest execution is not completed pass/fail",
                vec![id(t)],
            )
        }
        if sel["selectedStatus"] == "fail" {
            let e = c.node(field(&sel, "selectedEvidenceId"));
            let oids: HashSet<_> = list(c.plan, "placements")
                .iter()
                .filter(|p| p["disposition"] != "blocked" && contains(&p["selectedTestIds"], id(t)))
                .map(|p| field(p, "obligationId"))
                .collect();
            let risks: BTreeSet<_> = strings(&t["coveredRiskIds"])
                .into_iter()
                .chain(
                    list(c.plan, "obligations")
                        .iter()
                        .filter(|o| oids.contains(id(o)))
                        .flat_map(|o| strings(&o["riskIds"])),
                )
                .collect();
            out.blockers.push(json!({
                "id": format!("qeg:failed-{}-{}",id(t),id(e)),
                "message": format!("EAC-03 latest qualified test \"{}\" failed", field(t,"title")),
                "testId": id(t), "evidenceId": id(e), "riskIds": risks,
                "sourceRefs": prefer_refs(refs(e),json!([source("/graph/nodes",id(e))])),
            }));
        }
        selections.push(sel)
    }
    out.accounting["selections"] = json!(selections);
    out
}
