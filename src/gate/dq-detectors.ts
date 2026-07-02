import type { Disqualification } from "../types.js";
import type { DQDetector, DQDetectorInput } from "./context.js";
import {
  detectDQ01,
  detectDQ02,
  detectDQ03,
  detectDQ04,
  detectDQ05,
  detectDQ06,
  detectDQ07,
} from "./dq/basic.js";
import {
  detectDQ08,
  detectDQ09,
  detectDQ10,
  detectDQ11,
  detectDQ12,
  detectDQ13,
} from "./dq/evidence.js";
import { detectDQ15, detectDQ16, detectDQ17 } from "./dq/ipo.js";
import { detectDQ14 } from "./dq/placement-change.js";

export {
  detectDQ01,
  detectDQ02,
  detectDQ03,
  detectDQ04,
  detectDQ05,
  detectDQ06,
  detectDQ07,
  detectDQ08,
  detectDQ09,
  detectDQ10,
  detectDQ11,
  detectDQ12,
  detectDQ13,
  detectDQ14,
  detectDQ15,
  detectDQ16,
  detectDQ17,
};

const DQ_DETECTORS: readonly DQDetector[] = [
  detectDQ01,
  detectDQ02,
  detectDQ03,
  detectDQ04,
  detectDQ05,
  detectDQ06,
  detectDQ07,
  detectDQ08,
  detectDQ09,
  detectDQ10,
  detectDQ11,
  detectDQ12,
  detectDQ13,
  detectDQ14,
  detectDQ15,
  detectDQ16,
  detectDQ17,
];

export function detectAllDQs(input: DQDetectorInput): Disqualification[] {
  const results: Disqualification[] = [];
  for (const detector of DQ_DETECTORS) {
    const detected = detector(input);
    if (Array.isArray(detected)) {
      results.push(...detected);
    } else if (detected !== null) {
      results.push(detected);
    }
  }
  return results;
}
