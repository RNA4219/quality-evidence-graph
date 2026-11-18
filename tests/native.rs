use quality_evidence_graph::{
    commands,
    common::{items, s},
    runtime,
};
use serde_json::Value;
use std::{fs, path::Path};

#[test]
fn native_runtime_matches_fixture_contracts() -> anyhow::Result<()> {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures");
    let manifest: Value = serde_json::from_slice(&fs::read(fixtures.join("manifest.json"))?)?;
    for fixture in items(&manifest["fixtures"]) {
        let name = s(&fixture["name"]);
        let dir = fixtures.join(name);
        let result = runtime::evaluate(&dir, true);
        if fixture["expected"]["exitCode"] == 1 {
            assert!(result.is_err(), "{name} must reject the input");
            continue;
        }
        let actual = result?;
        let expected: Value =
            serde_json::from_slice(&fs::read(dir.join("expected-gate-verdict.json"))?)?;
        let check = commands::compare_expected(&expected, &actual);
        assert_eq!(check["validationPassed"], true, "{name}: {check}");
        assert_eq!(
            actual["gateResult"]["verdict"], fixture["expected"]["verdict"],
            "{name}"
        );
        runtime::assert_output(&actual["gateResult"], "gate-verdict.schema.json")?;
    }
    Ok(())
}
