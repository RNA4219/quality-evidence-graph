import type {
  DisqualificationCode,
  GateProfile,
  GateVerdict,
  IsoDateTime,
  StableId,
} from "./primitives.js";
import type { QegMetadata, SourceRef } from "./evidence.js";

export interface ExitCodePolicy {
  readonly go: 0;
  readonly conditional_go: 2;
  readonly no_go: 2;
  readonly disqualified: 2;
}

export interface GatePolicy {
  readonly policyId: string;
  readonly policyHash: string;
  readonly profile: GateProfile;
  readonly effectiveDate: IsoDateTime;
  readonly approver: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly dqScope: readonly DisqualificationCode[];
  readonly exitCodePolicy: ExitCodePolicy;
}

export interface Disqualification {
  readonly code: DisqualificationCode;
  readonly message: string;
  readonly nodeIds: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface GateBlocker {
  readonly id: StableId;
  readonly message: string;
  readonly riskIds: readonly StableId[];
  readonly sourceRefs: readonly SourceRef[];
}

export interface GateResult {
  readonly metadata: QegMetadata;
  readonly verdict: GateVerdict;
  readonly reasons: readonly string[];
  readonly disqualifications: readonly Disqualification[];
  readonly blockers: readonly GateBlocker[];
  readonly residualRisks: readonly StableId[];
  readonly requiredHumanReview: readonly StableId[];
}
