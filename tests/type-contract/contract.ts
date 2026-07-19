import type {
  ExecutionEvidenceNode,
  ExecutionEvidenceNodeBase,
  LegacyExecutionEvidenceNode,
  LegacyTestNode,
  ResilienceExecutionEvidenceNode,
  ResilienceScenario,
  ResilienceTestNode,
  TestNode,
  TestNodeBase,
} from "@quality-harness/quality-evidence-graph";

declare const testBase: TestNodeBase;
declare const scenario: ResilienceScenario;

const legacyTest: TestNode = testBase;
const explicitLegacyTest: LegacyTestNode = { ...testBase, testType: "functional" };
const resilienceTest: ResilienceTestNode = {
  ...testBase,
  testType: "resilience",
  resilienceScenario: scenario,
  coveredRiskIds: ["risk-1"],
};
const resilienceAsUnion: TestNode = resilienceTest;

function inspectTest(test: TestNode): string {
  if (test.testType === "resilience") {
    return test.resilienceScenario.faultModel;
  }
  const absent: undefined = test.resilienceScenario;
  return absent ?? "legacy";
}

void legacyTest;
void explicitLegacyTest;
void resilienceAsUnion;
void inspectTest;

// @ts-expect-error resilience discriminator requires resilienceScenario
const missingScenario: TestNode = { ...testBase, testType: "resilience" };

// @ts-expect-error legacy discriminator forbids resilienceScenario
const legacyWithScenario: TestNode = {
  ...testBase,
  testType: "functional",
  resilienceScenario: scenario,
};

declare const evidenceBase: ExecutionEvidenceNodeBase;
declare const resilienceEvidence: ResilienceExecutionEvidenceNode;

const legacyEvidence: ExecutionEvidenceNode = evidenceBase;
const explicitLegacyEvidence: LegacyExecutionEvidenceNode = evidenceBase;
const resilienceEvidenceAsUnion: ExecutionEvidenceNode = resilienceEvidence;

function inspectEvidence(evidence: ExecutionEvidenceNode): string {
  if (evidence.evidenceType === "resilience") {
    return evidence.testId;
  }
  const absent: undefined = evidence.evidenceType;
  return absent ?? "legacy";
}

void legacyEvidence;
void explicitLegacyEvidence;
void resilienceEvidenceAsUnion;
void inspectEvidence;

// @ts-expect-error resilience discriminator requires the resilience evidence fields
const incompleteResilienceEvidence: ExecutionEvidenceNode = {
  ...evidenceBase,
  evidenceType: "resilience",
};

void missingScenario;
void legacyWithScenario;
void incompleteResilienceEvidence;
