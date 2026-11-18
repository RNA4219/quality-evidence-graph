use crate::common::{items, s, timestamp_nanos};
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use std::collections::{BTreeSet, HashMap, HashSet};

mod coverage;
mod evidence;
mod execution;
mod integrity;
mod manual;
mod reliability;
mod semantics;

pub use execution::{execution_fingerprint, valid_execution, valid_execution_policy};
pub use semantics::reliability_semantics;

fn list<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    items(&v[key])
}
fn id(v: &Value) -> &str {
    s(&v["id"])
}
fn field<'a>(v: &'a Value, key: &str) -> &'a str {
    s(&v[key])
}
fn flag(v: &Value, key: &str) -> bool {
    v[key] == true
}
fn num(v: &Value, key: &str) -> f64 {
    v[key].as_f64().unwrap_or(f64::NAN)
}
fn nonblank(v: &Value) -> bool {
    v.as_str().is_some_and(|x| !x.trim().is_empty())
}
fn strings(v: &Value) -> Vec<&str> {
    items(v).iter().filter_map(Value::as_str).collect()
}
fn contains(v: &Value, id: &str) -> bool {
    items(v).iter().any(|x| x == id)
}
fn only<'a>(nodes: &'a [Value], kind: &'a str) -> impl Iterator<Item = &'a Value> {
    nodes.iter().filter(move |n| n["kind"] == kind)
}
fn unique<T: PartialEq>(values: impl IntoIterator<Item = T>) -> Vec<T> {
    let mut result = vec![];
    for v in values {
        if !result.contains(&v) {
            result.push(v);
        }
    }
    result
}
fn source(pointer: &str, label: &str) -> Value {
    let escaped = crate::common::encode(pointer);
    json!({"id":format!("qeg:input-{escaped}"),"path":"gate-input.json","label":format!("{pointer}: {label}")})
}
fn dq(code: &str, message: impl Into<String>, ids: Value, refs: Value) -> Value {
    json!({"code":code,"message":message.into(),"nodeIds":ids,"sourceRefs":refs})
}
fn refs(v: &Value) -> Value {
    json!(list(&v["traceability"], "sourceRefs"))
}
fn doc_refs(v: &Value) -> Vec<Value> {
    items(v)
        .iter()
        .cloned()
        .map(|mut r| {
            if let Some(o) = r.as_object_mut() {
                o.remove("evidenceKind");
                o.remove("capturedAt");
            }
            r
        })
        .collect()
}
fn prefer_refs(value: Value, fallback: Value) -> Value {
    if items(&value).is_empty() {
        fallback
    } else {
        value
    }
}
fn fields_valid(value: &Value, fields: &[&str]) -> bool {
    fields.iter().all(|k| nonblank(&value[k]))
}

pub fn validate_waiver(waiver: &Value, graph: &Value, execution_time: &Value) -> Value {
    let risks = only(list(graph, "nodes"), "risk")
        .map(id)
        .collect::<HashSet<_>>();
    check_waiver(waiver, &risks, timestamp_nanos(execution_time))
}
fn check_waiver(w: &Value, risks: &HashSet<&str>, clock: Option<i128>) -> Value {
    let mut reasons = vec![];
    for risk in strings(&w["linkedRiskIds"]) {
        if !risks.contains(risk) {
            reasons.push(format!(
                "linkedRiskId \"{risk}\" does not resolve to a risk node"
            ));
        }
    }
    for k in ["approver", "approvalAuthority"] {
        if !nonblank(&w[k]) {
            reasons.push(format!("{k} is empty"));
        }
    }
    if list(w, "sourceRefs").is_empty() {
        reasons.push("sourceRefs is empty (minimum 1 required)".into())
    }
    if clock
        .zip(timestamp_nanos(&w["expiry"]))
        .is_none_or(|(now, end)| end <= now)
    {
        reasons.push(format!(
            "expiry \"{}\" is invalid or not after the evaluation time",
            w["expiry"].as_str().unwrap_or("undefined")
        ))
    }
    for k in [
        "impactScope",
        "rollbackOrContainment",
        "followUpOwner",
        "recheckCondition",
        "reason",
    ] {
        if !nonblank(&w[k]) {
            reasons.push(format!("{k} is empty"));
        }
    }
    if reasons.is_empty() {
        json!({"valid":true})
    } else {
        json!({"valid":false,"invalidReason":reasons.join("; ")})
    }
}

struct Context<'a> {
    input: &'a Value,
    nodes: &'a [Value],
    edges: &'a [Value],
    meta: &'a Value,
    policy: &'a Value,
    plan: &'a Value,
    package: &'a Value,
    by_id: HashMap<&'a str, &'a Value>,
    waivers: Vec<&'a Value>,
    placements: Vec<&'a Value>,
}
impl<'a> Context<'a> {
    fn new(input: &'a Value) -> Self {
        let graph = &input["graph"];
        let nodes = list(graph, "nodes");
        let edges = list(graph, "edges");
        let meta = &input["metadata"];
        let plan = &input["placementPlan"];
        let by_id: HashMap<_, _> = nodes.iter().map(|n| (id(n), n)).collect();
        let now = timestamp_nanos(&meta["createdAt"]);
        let risks = only(nodes, "risk").map(id).collect();
        let waivers = list(input, "waivers")
            .iter()
            .filter(|w| now.is_some() && check_waiver(w, &risks, now)["valid"] == true)
            .collect();
        let mut placements = only(nodes, "test_placement").collect::<Vec<_>>();
        for p in list(plan, "placements") {
            if !placements.contains(&p) {
                placements.push(p)
            }
        }
        Self {
            input,
            nodes,
            edges,
            meta,
            policy: &input["policy"],
            plan,
            package: &input["evidencePackage"],
            by_id,
            waivers,
            placements,
        }
    }
    fn node(&self, id: &str) -> &'a Value {
        self.by_id.get(id).copied().unwrap_or(&Value::Null)
    }
    fn waived(&self, risk: &str) -> bool {
        self.waivers
            .iter()
            .any(|w| contains(&w["linkedRiskIds"], risk))
    }
    fn all_waived(&self, risk_ids: &[&str]) -> bool {
        !risk_ids.is_empty() && risk_ids.iter().all(|r| self.waived(r))
    }
    fn selected(&self, obligation: &Value) -> Vec<&'a str> {
        unique(
            list(self.plan, "placements")
                .iter()
                .filter(|p| p["disposition"] != "blocked" && p["obligationId"] == obligation["id"])
                .flat_map(|p| strings(&p["selectedTestIds"])),
        )
    }
}
#[derive(Default)]
struct Assessment {
    accounting: Value,
    dqs: Vec<Value>,
    blockers: Vec<Value>,
}
fn high(r: &Value) -> bool {
    matches!(field(r, "severity"), "high" | "critical")
}
fn risk_blockers(ctx: &Context) -> Vec<Value> {
    only(ctx.nodes,"risk").filter(|r|high(r)&&num(r,"evidenceGap")>0.5).map(|r|json!({
        "id":format!("blocker-{}",id(r)),"message":format!("High/critical risk \"{}\" with evidence gap",field(r,"title")),
        "riskIds":[id(r)],"sourceRefs":refs(r)})).collect()
}
fn source_diagnostics(items: &mut [Value], ctx: &Context) {
    for item in items
        .iter_mut()
        .filter(|i| list(i, "sourceRefs").is_empty())
    {
        let ids = items_ids(item);
        let values: Vec<_> = ids
            .iter()
            .map(|id| {
                let p = ctx
                    .nodes
                    .iter()
                    .position(|n| n["id"] == *id)
                    .map_or("/".into(), |i| format!("/graph/nodes/{i}"));
                source(&p, &format!("Diagnostic subject {id}"))
            })
            .collect();
        item["sourceRefs"] = if values.is_empty() {
            json!([source("/", field(item, "message"))])
        } else {
            json!(values)
        };
    }
}
fn items_ids(item: &Value) -> Vec<&str> {
    strings(item.get("nodeIds").unwrap_or(&item["riskIds"]))
}
pub fn test_evidence_accounting(graph: &Value, execution: Option<&Value>) -> Value {
    let mut counted = vec![];
    let mut excluded = vec![];
    for n in only(list(graph, "nodes"), "test") {
        if n["testExecutionMode"] != "real" {
            excluded.push(json!({"testId":id(n),"reason":"mock_test","sourceRefs":refs(n)}));
            continue;
        }
        let passed = execution.is_some_and(|x| {
            list(x, "selections")
                .iter()
                .any(|sel| sel["testId"] == n["id"] && sel["selectedStatus"] == "pass")
        });
        if (n["testType"] == "resilience" || passed)
            && (n.get("evidenceStrength").is_some() || n.get("recentGreenRuns").is_some())
        {
            counted.push(id(n))
        }
    }
    json!({"countedTestIds":counted,"excludedMockTests":excluded})
}
fn reasons(
    verdict: &str,
    dqs: &[Value],
    blockers: &[Value],
    residual: usize,
    review: usize,
    waivers: usize,
) -> Vec<String> {
    let mut out = vec![];
    if !dqs.is_empty() {
        out.push(format!("Disqualified: {} DQ code(s)", dqs.len()));
        out.extend(
            dqs.iter()
                .map(|d| format!("- {}: {}", field(d, "code"), field(d, "message"))),
        )
    }
    if !blockers.is_empty() {
        let effective = blockers.iter().filter(|b| b["effective"] != false).count();
        out.push(if effective == blockers.len() {
            format!("No-go blockers: {effective}")
        } else {
            format!(
                "Blockers: {} ({effective} effective, {} waived)",
                blockers.len(),
                blockers.len() - effective
            )
        });
        out.extend(blockers.iter().map(|b| {
            format!(
                "- {}{}",
                field(b, "message"),
                if b["effective"] == false {
                    " (waived)"
                } else {
                    ""
                }
            )
        }))
    }
    if waivers > 0 {
        out.push(format!(
            "Valid waivers: {waivers} (conditional_go required)"
        ))
    }
    if residual > 0 {
        out.push(format!("Residual risks: {residual}"))
    }
    if review > 0 {
        out.push(format!("Required human review: {review}"))
    }
    if verdict == "go" {
        out.push("All gate conditions satisfied".into())
    }
    out
}
pub fn evaluate_gate(input: &Value) -> Result<Value> {
    ensure!(
        input["metadata"].is_object()
            && input["graph"]["nodes"].is_array()
            && input["graph"]["edges"].is_array()
            && input["policy"].is_object(),
        "Invalid Gate evaluation input"
    );
    let ctx = Context::new(input);
    let reliability = reliability::assess(&ctx);
    let execution = execution::assess(&ctx);
    let manual = manual::assess(&ctx, &execution.accounting);
    let mut blockers = risk_blockers(&ctx);
    blockers.extend(reliability.blockers);
    blockers.extend(execution.blockers);
    let mut upstream_dqs = vec![];
    let mut upstream_review = vec![];
    for n in only(ctx.nodes, "gate_verdict") {
        match field(n, "verdict") {
            "disqualified" => upstream_dqs.push(dq(
                "DQ-11",
                format!("Upstream decision is disqualified: {}", field(n, "title")),
                json!([id(n)]),
                refs(n),
            )),
            "no_go" => blockers.push(json!({
                "id": format!("qeg:upstream-{}", id(n)),
                "message": format!("Upstream decision is no_go: {}", field(n,"title")),
                "riskIds": [], "sourceRefs": refs(n),
            })),
            "conditional_go" => upstream_review.push(id(n)),
            _ => (),
        }
    }
    blockers.extend(manual.blockers.iter().cloned());
    let mut dqs = evidence::detect(&ctx, &blockers, &manual, &execution.accounting);
    dqs.extend(integrity::detect(&ctx));
    dqs.extend(coverage::required_executions(
        &ctx,
        &execution.accounting,
        &reliability.accounting,
    ));
    dqs.extend(execution.dqs);
    dqs.extend(upstream_dqs);
    dqs.extend(reliability.dqs);
    source_diagnostics(&mut dqs, &ctx);
    source_diagnostics(&mut blockers, &ctx);
    let residual: Vec<_> = only(ctx.nodes, "risk")
        .filter(|r| ctx.waived(id(r)) || !high(r) && num(r, "evidenceGap") <= 0.5)
        .map(id)
        .collect();
    let mut review = ctx.waivers.iter().map(|w| id(w)).collect::<Vec<_>>();
    review.extend(&residual);
    review.extend(
        only(ctx.nodes, "risk")
            .filter(|r| r["traceability"]["confidence"] == "low")
            .map(id),
    );
    review.extend(
        only(ctx.nodes, "test")
            .filter(|t| {
                t["testType"] != "resilience"
                    && t["oracleType"] == "human"
                    && ctx.placements.iter().any(|p| {
                        p["primaryLayer"] == "manual-scripted"
                            && contains(&p["selectedTestIds"], id(t))
                    })
                    && !coverage::retired(&ctx, t)
            })
            .map(id),
    );
    review.extend(upstream_review);
    review.extend(manual.review.iter().map(String::as_str));
    let pkg = ctx.package;
    if pkg.is_object()
        && pkg["phase"] != "implementation_preparation"
        && (!pkg["approvalEvidence"].is_array()
            || (pkg["phase"] == "pre_release_review" && list(pkg, "approvalEvidence").is_empty())
            || list(pkg, "approvalEvidence")
                .iter()
                .any(|a| field(a, "approvedDecision").trim() != "go"))
    {
        review.push(id(pkg))
    }
    let review = unique(review);
    let verdict = if !dqs.is_empty() {
        "disqualified"
    } else if blockers.iter().any(|b| b["effective"] != false) {
        "no_go"
    } else if !review.is_empty() || !residual.is_empty() || !ctx.waivers.is_empty() {
        "conditional_go"
    } else {
        "go"
    };
    let mut out = json!({});
    if let Some(scope) = ctx.policy.pointer("/inputContract/evaluationScope") {
        out["evaluationScope"] = scope.clone()
    }
    for (k, v) in [
        ("metadata", ctx.meta.clone()),
        ("verdict", json!(verdict)),
        (
            "reasons",
            json!(reasons(
                verdict,
                &dqs,
                &blockers,
                residual.len(),
                review.len(),
                ctx.waivers.len()
            )),
        ),
        ("disqualifications", json!(dqs)),
        ("blockers", json!(blockers)),
        ("residualRisks", json!(residual)),
        ("requiredHumanReview", json!(review)),
        (
            "testEvidenceAccounting",
            test_evidence_accounting(&input["graph"], Some(&execution.accounting)),
        ),
    ] {
        out[k] = v;
    }
    if !execution.accounting.is_null() {
        out["executionAccounting"] = execution.accounting
    }
    out["reliability"] = reliability.accounting;
    Ok(out)
}
