use super::*;

#[derive(Default)]
pub(super) struct Manual {
    pub dqs: Vec<Value>,
    pub blockers: Vec<Value>,
    pub review: Vec<String>,
    pub reviewed: HashSet<String>,
}
pub(super) fn assess(ctx: &Context, execution: &Value) -> Manual {
    let mut out = Manual::default();
    let package = ctx.package;
    if package.is_null() {
        return out;
    }
    let add = |i: usize, id: &str, message: &str| {
        dq(
            "DQ-08",
            message,
            if id.trim().is_empty() {
                json!([])
            } else {
                json!([id])
            },
            json!([source(
                &format!("/evidencePackage/manualEvidence/{i}"),
                message
            )]),
        )
    };
    let Some(entries) = package["manualEvidence"].as_array() else {
        out.dqs.push(add(0, "", "Manual evidence must be an array"));
        return out;
    };
    let mut seen = HashSet::new();
    for (i, item) in entries.iter().enumerate() {
        let case = field(item, "executedCaseId");
        if !seen.insert(case) {
            continue;
        }
        let prefix = format!(
            "Manual evidence \"{}\"",
            item["executedCaseId"].as_str().unwrap_or("unknown")
        );
        let trace = strings(&item["traceTo"]);
        let valid_refs = |key| {
            !list(item, key).is_empty()
                && list(item, key)
                    .iter()
                    .all(|r| fields_valid(r, &["id", "path", "evidenceKind"]))
        };
        if !nonblank(&item["executedCaseId"])
            || !nonblank(&item["expectedResult"])
            || !valid_refs("oracleRefs")
            || !valid_refs("evidenceRefs")
            || trace.is_empty()
            || !list(item, "traceTo").iter().all(nonblank)
        {
            out.dqs.push(dq(
                "DQ-08",
                format!("{prefix} incomplete"),
                if case.trim().is_empty() {
                    json!([])
                } else {
                    json!([case])
                },
                json!([]),
            ));
            continue;
        }
        let note = nonblank(&item["reviewerNote"]);
        let result = field(item, "result");
        let test = ctx.node(case);
        let selection = list(execution, "selections")
            .iter()
            .find(|s| s["testId"] == case)
            .unwrap_or(&Value::Null);
        let risk_review = test.is_null()
            && result == "pass"
            && note
            && trace.iter().all(|r| ctx.node(r)["kind"] == "risk")
            && list(item, "oracleRefs")
                .iter()
                .chain(list(item, "evidenceRefs"))
                .all(|r| r["evidenceKind"] == "human_review");
        let diagnostic = if !matches!(result, "pass" | "fail" | "blocked" | "skipped")
            || item.get("reviewerNote").is_some_and(|v| !v.is_string())
        {
            Some("has an invalid result or reviewer note")
        } else if entries
            .iter()
            .any(|v| v["executedCaseId"] == case && v != item)
        {
            Some("has conflicting current records")
        } else if trace.iter().any(|r| {
            !matches!(
                field(ctx.node(r), "kind"),
                "requirement" | "risk" | "acceptance_criteria"
            )
        }) {
            Some("has unresolved requirement, risk or acceptance references")
        } else if !risk_review
            && (test["kind"] != "test"
                || flag(test, "deleted")
                || test["testExecutionMode"] != "real"
                || !matches!(
                    field(test, "layer"),
                    "manual-scripted" | "manual-exploratory"
                ))
        {
            Some("does not reference a current real manual test")
        } else if selection.get("selectedStatus").is_some() && selection["selectedStatus"] != result
        {
            Some("disagrees with the selected execution result")
        } else {
            None
        };
        if let Some(msg) = diagnostic {
            out.dqs.push(add(i, case, &format!("{prefix} {msg}")));
            continue;
        }
        let risk_ids: Vec<_> = trace
            .iter()
            .copied()
            .filter(|r| ctx.node(r)["kind"] == "risk")
            .collect();
        if result == "fail" && selection["selectedStatus"] != "fail" {
            let refs = [
                doc_refs(&item["evidenceRefs"]),
                doc_refs(&item["oracleRefs"]),
            ]
            .concat();
            out.blockers.push(json!({
                "id": format!("qeg:manual-failed-{case}"), "message": format!("Reported manual execution \"{case}\" failed"),
                "testId": case, "riskIds": unique(risk_ids.iter().copied().chain(strings(&test["coveredRiskIds"]))),
                "sourceRefs": refs,
            }));
        }
        if matches!(result, "blocked" | "skipped") {
            out.review.push(case.into())
        }
        if result == "pass"
            && note
            && (risk_review
                || !flag(&ctx.policy["inputContract"], "requireExecutedTests")
                || selection["selectedStatus"] == "pass")
        {
            out.reviewed
                .extend(risk_ids.into_iter().map(str::to_string))
        }
    }
    out
}
