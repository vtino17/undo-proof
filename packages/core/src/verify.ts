import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import type {
  PackVerification,
  RecoveryPack,
  ReversibilityPlan,
} from "./types.js";
import { assertPlan } from "./validation.js";

export function verifyRecoveryPack(input: {
  pack: RecoveryPack;
  plan?: unknown;
}): PackVerification {
  const { pack } = input;
  const base = {
    packVersion: pack.packVersion,
    planId: pack.planId,
    planHash: pack.planHash,
    generatedAt: pack.generatedAt,
    executionOrder: pack.executionOrder,
    rollbackSteps: pack.rollbackSteps,
    irreversibleActions: pack.irreversibleActions,
    estimatedRecoveryMinutes: pack.estimatedRecoveryMinutes,
    content: pack.content,
  };
  const checks = {
    packHash: sha256(canonicalJson(base)) === pack.packHash,
    planHash: true,
    order: pack.rollbackSteps.every(
      (step, index) => step.order === index + 1,
    ),
    recoveryTime:
      pack.rollbackSteps.reduce(
        (sum, step) => sum + step.expectedMinutes,
        0,
      ) === pack.estimatedRecoveryMinutes,
  };
  if (input.plan !== undefined) {
    assertPlan(input.plan);
    checks.planHash = hashValue(input.plan as ReversibilityPlan) === pack.planHash;
  }
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}
